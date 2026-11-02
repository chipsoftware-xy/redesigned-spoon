// Where accounts are saved.
//
//  - On your own computer: a file (data.json) next to this one. Nothing to set up.
//  - When hosted: free hosts wipe their disk whenever the server restarts, so accounts
//    would vanish. If you set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
//    (a free database from upstash.com), accounts are saved there instead.
//
// index.js only talks to the two functions below, so it does not care which one is used.

import fs from "node:fs";
import process from "node:process";

const SESSION_SECONDS = 30 * 24 * 60 * 60; // logins last 30 days

// ---------- file ----------
function fileStorage() {
  const file = new URL("./data.json", import.meta.url);
  return {
    kind: "file (data.json)",
    async load() {
      try {
        const db = JSON.parse(fs.readFileSync(file, "utf8"));
        return { users: db.users || {}, sessions: db.sessions || {} };
      } catch {
        return { users: {}, sessions: {} };
      }
    },
    async loadMarket() {
      try {
        return fs.readFileSync(new URL("./market.json", import.meta.url), "utf8");
      } catch {
        return null;
      }
    },
    async saveMarket(text) {
      const tmp = new URL("./market.json.tmp", import.meta.url);
      fs.writeFileSync(tmp, text);
      fs.renameSync(tmp, new URL("./market.json", import.meta.url));
    },
    // writes everything; writes to a temp file first so a crash cannot leave half a file
    async flush(db) {
      const tmp = new URL("./data.json.tmp", import.meta.url);
      fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
      fs.renameSync(tmp, file);
    },
  };
}

// ---------- Upstash Redis (over plain HTTPS) ----------
function upstashStorage(url, token) {
  const base = url.replace(/\/$/, "");

  async function pipeline(commands) {
    const res = await fetch(`${base}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Upstash answered ${res.status}`);
    const out = await res.json();
    for (const item of out) if (item.error) throw new Error(item.error);
    return out.map((item) => item.result);
  }

  async function scan(pattern) {
    const keys = [];
    let cursor = "0";
    do {
      const [[next, batch]] = await pipeline([["SCAN", cursor, "MATCH", pattern, "COUNT", "500"]]);
      keys.push(...batch);
      cursor = next;
    } while (cursor !== "0");
    return keys;
  }

  return {
    kind: "Upstash Redis",
    async load() {
      const users = {};
      const sessions = {};
      const userKeys = await scan("user:*");
      for (let i = 0; i < userKeys.length; i += 100) {
        const chunk = userKeys.slice(i, i + 100);
        const [values] = await pipeline([["MGET", ...chunk]]);
        chunk.forEach((key, n) => {
          if (values[n]) users[key.slice(5)] = JSON.parse(values[n]);
        });
      }
      const sessionKeys = await scan("sess:*");
      for (let i = 0; i < sessionKeys.length; i += 100) {
        const chunk = sessionKeys.slice(i, i + 100);
        const [values] = await pipeline([["MGET", ...chunk]]);
        chunk.forEach((key, n) => {
          if (values[n]) sessions[key.slice(5)] = values[n];
        });
      }
      return { users, sessions };
    },
    async loadMarket() {
      const [value] = await pipeline([["GET", "market:state"]]);
      return value || null;
    },
    async saveMarket(text) {
      await pipeline([["SET", "market:state", text]]);
    },
    // only writes what changed
    async flush(db, changes) {
      const commands = [];
      for (const name of changes.users) {
        if (Object.hasOwn(db.users, name)) commands.push(["SET", `user:${name}`, JSON.stringify(db.users[name])]);
      }
      for (const tok of changes.sessions) {
        if (Object.hasOwn(db.sessions, tok)) {
          commands.push(["SET", `sess:${tok}`, db.sessions[tok], "EX", String(SESSION_SECONDS)]);
        } else {
          commands.push(["DEL", `sess:${tok}`]);
        }
      }
      if (commands.length > 0) await pipeline(commands);
    },
  };
}

export function createStorage() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? upstashStorage(url, token) : fileStorage();
}
