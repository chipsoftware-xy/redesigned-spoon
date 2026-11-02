import express from "express";
import cors from "cors";
import process from "node:process";
import { Buffer } from "node:buffer";
import { randomUUID, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import {
  getMarket,
  setMode,
  setSensitivity,
  startMarket,
  exportState,
  importState,
  previewOrder,
  executeOrder,
  isOpen,
  marketState,
  setSettler,
  placeOrder,
  attachExits,
  validateBracket,
  cancelOrder,
  listOrders,
} from "./market.js";

import { chargesFor, taxOnSale } from "./fees.js";
import { getReal } from "./realdata.js";
import { createStorage } from "./storage.js";

// ---------- settings (all optional; see .env.example) ----------
const PORT = Number(process.env.PORT) || 3001;
// Which websites may talk to this server, e.g. https://my-app.vercel.app (comma separated).
// Left empty, every website may (fine for learning; the login token protects accounts).
const ORIGINS = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);
const MOOD_COOLDOWN_MS = Number(process.env.MOOD_COOLDOWN_SECONDS ?? 30) * 1000;

const app = express();
app.set("trust proxy", 1); // hosts put a proxy in front; this makes req.ip the visitor's address
app.use(cors({ origin: ORIGINS.length > 0 ? ORIGINS : true }));
app.use(express.json({ limit: "20kb" }));

const VIDEO = "https://youtu.be/k4PMUZ055vc";

// ---------- storage ----------
const storage = createStorage();
const db = await storage.load();
console.log(`Accounts are saved in: ${storage.kind} (${Object.keys(db.users).length} users)`);

const dirty = { users: new Set(), sessions: new Set() };
let saveTimer = null;
const HISTORY_LIMIT = 200;

// Remember that a user (or a login token) changed. Saving is batched to once a second.
function touchUser(username) {
  dirty.users.add(username);
  schedule();
}
function touchSession(token) {
  dirty.sessions.add(token);
  schedule();
}
function schedule() {
  if (!saveTimer) saveTimer = setTimeout(flush, 1000);
}
async function flush() {
  saveTimer = null;
  const changes = { users: [...dirty.users], sessions: [...dirty.sessions] };
  dirty.users.clear();
  dirty.sessions.clear();
  try {
    await storage.flush(db, changes);
  } catch (err) {
    console.error("Could not save, will retry:", err.message);
    changes.users.forEach((u) => dirty.users.add(u));
    changes.sessions.forEach((t) => dirty.sessions.add(t));
    schedule();
  }
}
// hosts stop the server with SIGTERM when they redeploy: save first
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, async () => {
    await flush();
    await saveMarket();
    process.exit(0);
  });
}

// ---------- user data ----------
const round2 = (n) => Math.round(n * 100) / 100;

// Makes sure a user's data has every field (accounts made by older versions lack some)
function normalise(data) {
  data.balance = Number.isFinite(data.balance) ? data.balance : 0;
  data.holdings = data.holdings || {};
  data.watchlist = Array.isArray(data.watchlist) ? data.watchlist : [];
  data.history = Array.isArray(data.history) ? data.history : [];
  if (!data.stats) {
    // an older account: assume everything it holds now was paid for with money it deposited
    let held = 0;
    for (const h of Object.values(data.holdings)) held += h.qty * h.avgPrice;
    data.stats = {
      deposited: round2(data.balance + held),
      realizedGross: 0,
      chargesPaid: 0,
      taxPaid: 0,
      dividends: 0,
      trades: 0,
    };
  }
  return data;
}
for (const u of Object.values(db.users)) normalise(u.data);

function record(data, entry) {
  data.history.unshift({ time: new Date().toISOString(), ...entry });
  if (data.history.length > HISTORY_LIMIT) data.history.length = HISTORY_LIMIT;
}

// ---------- passwords ----------
function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const attempt = scryptSync(password, salt, 64);
  return timingSafeEqual(attempt, Buffer.from(hash, "hex"));
}

// ---------- helpers ----------
function cleanUsername(name) {
  const u = String(name ?? "").trim().toLowerCase();
  return /^[a-z][a-z0-9_]{2,19}$/.test(u) ? u : null;
}

// The browser may only send the watchlist. Balance and holdings
// are changed by the server alone (buy, sell and payments).
function cleanWatchlist(list) {
  return Array.isArray(list)
    ? list.filter((s) => typeof s === "string" && s.length <= 30).slice(0, 100)
    : [];
}

const MAX_SESSIONS_PER_USER = 5;

function newSession(username) {
  const token = randomBytes(32).toString("hex");
  db.sessions[token] = username;
  touchSession(token);
  // keep only the newest few logins per user
  const mine = Object.keys(db.sessions).filter((t) => db.sessions[t] === username);
  while (mine.length > MAX_SESSIONS_PER_USER) {
    const old = mine.shift();
    delete db.sessions[old];
    touchSession(old);
  }
  return token;
}

// Runs before protected routes: checks the token and finds the user
function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const username = Object.hasOwn(db.sessions, token) ? db.sessions[token] : null;
  if (!username || !Object.hasOwn(db.users, username)) {
    return res.status(401).json({ error: "Not logged in" });
  }
  req.username = username;
  req.token = token;
  next();
}

// A very small "too many tries" guard, kept in memory
function limiter(max, windowMs, what) {
  const hits = new Map(); // ip -> [timestamps]
  return (req, res, next) => {
    const now = Date.now();
    const recent = (hits.get(req.ip) || []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      return res.status(429).json({ error: `Too many ${what}. Please wait a few minutes and try again.` });
    }
    recent.push(now);
    hits.set(req.ip, recent);
    if (hits.size > 5000) hits.clear(); // never let it grow forever
    next();
  };
}
const loginLimit = limiter(15, 5 * 60 * 1000, "login attempts");
const registerLimit = limiter(10, 60 * 60 * 1000, "sign-ups");

// ---------- health (hosts ping this; it also wakes a sleeping free server) ----------
app.get("/", (req, res) => res.type("text").send("Sanrio Exchange server is running."));
app.get("/api/health", (req, res) => {
  const ms = marketState();
  res.json({ ok: true, market: ms.state, storage: storage.kind });
});

// ---------- auth routes ----------
app.post("/api/auth/register", registerLimit, (req, res) => {
  const username = cleanUsername(req.body.username);
  const password = String(req.body.password ?? "");
  const name = String(req.body.name ?? "").trim().replace(/\s+/g, " ");
  const age = Number(req.body.age);

  if (name.length < 2 || name.length > 40) {
    return res.status(400).json({ error: "Please enter your name (2-40 characters)." });
  }
  if (!Number.isInteger(age) || age < 13 || age > 100) {
    return res.status(400).json({ error: "Age must be a whole number from 13 to 100." });
  }
  if (!username) {
    return res.status(400).json({
      error: "Username: 3-20 characters, letters/numbers/underscore, starting with a letter.",
    });
  }
  if (password.length < 6 || password.length > 100) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }
  if (Object.hasOwn(db.users, username)) {
    return res.status(409).json({ error: "That username is taken." });
  }

  const { salt, hash } = hashPassword(password);
  db.users[username] = { salt, hash, name, age, data: normalise({}) };
  const token = newSession(username);
  touchUser(username);
  res.json({ token, username, name, data: db.users[username].data });
});

app.post("/api/auth/login", loginLimit, (req, res) => {
  const username = cleanUsername(req.body.username);
  const password = String(req.body.password ?? "");
  const user = username && Object.hasOwn(db.users, username) ? db.users[username] : null;

  if (!user || !verifyPassword(password, user.salt, user.hash)) {
    return res.status(401).json({ error: "Wrong username or password." });
  }

  const token = newSession(username);
  res.json({ token, username, name: user.name || username, data: user.data });
});

app.post("/api/auth/logout", auth, (req, res) => {
  delete db.sessions[req.token];
  touchSession(req.token);
  res.json({ ok: true });
});

// ---------- per-user data ----------
app.get("/api/me", auth, (req, res) => {
  res.json({ username: req.username, name: db.users[req.username].name || req.username, data: db.users[req.username].data });
});

// only the watchlist can be saved from the browser
app.put("/api/me/data", auth, (req, res) => {
  db.users[req.username].data.watchlist = cleanWatchlist(req.body.watchlist);
  touchUser(req.username);
  res.json({ ok: true });
});

// ---------- market ----------
app.get("/api/market", (req, res) => {
  res.json(getMarket());
});

// One mood change at a time, so a crowd of visitors cannot fight over the buttons
let lastMoodChange = 0;
app.post("/api/market/mode", auth, (req, res) => {
  const wait = lastMoodChange + MOOD_COOLDOWN_MS - Date.now();
  if (wait > 0) {
    return res.status(429).json({
      error: `Someone just changed the mood. Try again in ${Math.ceil(wait / 1000)} seconds.`,
    });
  }
  if (!setMode(req.body.mode)) {
    return res.status(400).json({ error: "Unknown mode" });
  }
  lastMoodChange = Date.now();
  res.json({ ok: true });
});

// How strongly prices react: low, medium or high (shares the cooldown with the mood)
app.post("/api/market/sensitivity", auth, (req, res) => {
  const wait = lastMoodChange + MOOD_COOLDOWN_MS - Date.now();
  if (wait > 0) {
    return res.status(429).json({
      error: `Someone just changed the market. Try again in ${Math.ceil(wait / 1000)} seconds.`,
    });
  }
  if (!setSensitivity(req.body.level)) {
    return res.status(400).json({ error: "Unknown level" });
  }
  lastMoodChange = Date.now();
  res.json({ ok: true });
});

// Moves the money and the shares for one filled order, including fake charges and tax,
// and writes it into the user's history and totals. Returns the breakdown for the screen.
function settle(username, side, symbol, qty, cost, via = "market") {
  const data = db.users[username].data;
  const paid = round2(cost);
  const charges = chargesFor(side, paid);
  let tax = 0;
  let pnl = null;
  if (side === "buy") {
    const current = data.holdings[symbol] || { qty: 0, avgPrice: 0 };
    const newQty = current.qty + qty;
    const newAvg = (current.qty * current.avgPrice + paid) / newQty; // price paid, charges not included
    data.balance = round2(data.balance - paid - charges.total);
    data.holdings[symbol] = { qty: newQty, avgPrice: newAvg };
  } else {
    const current = data.holdings[symbol];
    const basis = current.avgPrice * qty;
    tax = taxOnSale(paid, charges.total, basis);
    data.balance = round2(data.balance + paid - charges.total - tax);
    pnl = round2(paid - basis); // profit on the shares themselves, before charges and tax
    data.stats.realizedGross = round2(data.stats.realizedGross + pnl);
    if (current.qty - qty <= 0) delete data.holdings[symbol];
    else data.holdings[symbol] = { ...current, qty: current.qty - qty };
  }
  data.stats.chargesPaid = round2(data.stats.chargesPaid + charges.total);
  data.stats.taxPaid = round2(data.stats.taxPaid + tax);
  data.stats.trades += 1;
  record(data, {
    kind: side,
    symbol,
    qty,
    price: round2(paid / qty),
    value: paid,
    charges: charges.total,
    tax,
    pnl,
    via,
  });
  touchUser(username);
  return {
    brokerage: charges.brokerage,
    stt: charges.stt,
    exchange: charges.exchange,
    gst: charges.gst,
    stamp: charges.stamp,
    charges: charges.total,
    tax,
    total: round2(charges.total + tax),
  };
}

// ---------- trading (orders trade against the order book) ----------
// The browser only says WHAT it wants. The server decides the price.

const CLOSED_TEXT =
  "The market is closed (open 9:30 am to 3:00 pm India time, Monday to Friday, except exchange holidays). You can still place a limit, stop or trailing order, and it will wait for the open.";

function closedMessage() {
  const ms = marketState();
  return ms.state === "halted"
    ? `Trading is halted: ${ms.reason}. You can still place a limit, stop or trailing order.`
    : CLOSED_TEXT;
}

// Check an order without placing it: "what would I pay, and how far would it move the price?"
app.get("/api/preview", (req, res) => {
  const side = req.query.side;
  const symbol = String(req.query.symbol ?? "");
  const qty = Number(req.query.qty);
  if ((side !== "buy" && side !== "sell") || !Number.isInteger(qty) || qty <= 0 || qty > 100000) {
    return res.json({ ok: false });
  }
  const p = previewOrder(symbol, side, qty);
  if (!p) return res.json({ ok: false });
  // estimated charges (tax on profit is worked out when you sell)
  res.json(p.ok ? { ...p, fees: chargesFor(side, p.cost) } : p);
});

// Buys or sells right now. Returns { ok, message, ... } (used by /api/trade and brackets).
function marketTrade(username, side, symbol, qty) {
  if (side !== "buy" && side !== "sell") return { ok: false, message: "Unknown order type." };
  if (!Number.isInteger(qty) || qty <= 0 || qty > 100000) {
    return { ok: false, message: "Enter a whole number of shares." };
  }
  if (!isOpen()) return { ok: false, message: closedMessage() };

  // 1. ask the order book what this order would get (nothing changes yet)
  const quote = previewOrder(symbol, side, qty);
  if (!quote) return { ok: false, message: "Unknown stock." };
  if (!quote.ok) {
    return {
      ok: false,
      message: `Not enough ${side === "buy" ? "sellers" : "buyers"} in ${symbol} right now. Only ${quote.available} share(s) are available. Try a smaller order. (A stock that has hit its daily price limit can have no sellers or no buyers at all.)`,
    };
  }

  const data = db.users[username].data;
  const value = round2(quote.cost);
  const estimate = chargesFor(side, value);

  // 2. check that the user can afford it / owns it
  if (side === "buy") {
    const need = round2(value + estimate.total);
    if (need > data.balance) {
      return {
        ok: false,
        message: `Not enough balance. You need about ₹${need.toFixed(2)} (₹${value.toFixed(2)} for the shares plus ₹${estimate.total.toFixed(2)} in charges).`,
      };
    }
  } else {
    const owned = data.holdings[symbol] ? data.holdings[symbol].qty : 0;
    if (qty > owned) return { ok: false, message: `You only own ${owned} share(s).` };
  }

  // 3. place the order. It eats real orders from the book, so the price moves for everyone.
  //    (This all runs in one go, so the book cannot change between step 1 and here.)
  const fill = executeOrder(symbol, side, qty);
  if (!fill) return { ok: false, message: "The order could not be filled." };
  const fees = settle(username, side, symbol, qty, fill.cost);

  const moved = `${fill.impactPct >= 0 ? "+" : ""}${fill.impactPct.toFixed(2)}%`;
  const extra = fees.tax > 0 ? ` and ₹${fees.tax.toFixed(2)} tax on your profit` : "";
  return {
    ok: true,
    fill,
    fees,
    message: `${side === "buy" ? "Bought" : "Sold"} ${qty} × ${symbol} at an average of ₹${fill.avg.toFixed(2)} (${fill.levels} price level${fill.levels === 1 ? "" : "s"} used). The price moved ${moved}. Charges: ₹${fees.charges.toFixed(2)}${extra}.`,
  };
}

app.post("/api/trade", auth, (req, res) => {
  const r = marketTrade(req.username, req.body.side, String(req.body.symbol ?? ""), Number(req.body.qty));
  if (!r.ok) return res.json({ ok: false, message: r.message });
  res.json({ ok: true, message: r.message, fees: r.fees, data: db.users[req.username].data });
});

// ---------- waiting orders ----------
// These wait inside the market until the price is right. When one is ready,
// the market asks us to check the user's wallet and then to move the money.
setSettler({
  afford(order, qty, cost) {
    const data = db.users[order.username]?.data;
    if (!data) return "the account no longer exists";
    if (order.side === "buy") {
      return round2(cost) + chargesFor("buy", round2(cost)).total <= data.balance
        ? true
        : "not enough balance";
    }
    const owned = data.holdings[order.symbol] ? data.holdings[order.symbol].qty : 0;
    return qty <= owned ? true : "you do not own enough shares";
  },
  fill(order, result) {
    settle(order.username, order.side, order.symbol, result.qty, result.cost, order.exit || order.type);
  },
  // pays everyone who owns the stock
  dividend(symbol, perShare) {
    for (const [username, user] of Object.entries(db.users)) {
      const held = user.data.holdings[symbol];
      if (!held) continue;
      const amount = round2(held.qty * perShare);
      user.data.balance = round2(user.data.balance + amount);
      user.data.stats.dividends = round2(user.data.stats.dividends + amount);
      record(user.data, {
        kind: "dividend",
        symbol,
        qty: held.qty,
        price: perShare,
        value: amount,
        charges: 0,
        tax: 0,
        pnl: null,
        via: "dividend",
      });
      touchUser(username);
    }
  },
});

// Place an order that waits for the right price
app.post("/api/orders", auth, (req, res) => {
  if (req.body.bracket) return res.json({ ok: false, message: "Use the bracket order form for that." });
  const r = placeOrder({
    username: req.username,
    symbol: String(req.body.symbol ?? ""),
    side: req.body.side,
    type: req.body.type,
    price: Number(req.body.price),
    qty: Number(req.body.qty),
    validity: req.body.validity,
    trailPct: Number(req.body.trailPct),
  });
  if (!r.ok) return res.json({ ok: false, message: r.error });
  res.json({
    ok: true,
    message: `Order placed (${r.order.validity === "day" ? "valid for the day" : "good till cancelled"}). It will run when the price is right and the market is open.`,
  });
});

// A bracket order: buy, then automatically sell at a target OR at a stop-loss (whichever comes first)
app.post("/api/orders/bracket", auth, (req, res) => {
  const symbol = String(req.body.symbol ?? "");
  const qty = Number(req.body.qty);
  const target = Number(req.body.target);
  const stop = Number(req.body.stop);
  const validity = req.body.validity === "gtc" ? "gtc" : "day";

  if (req.body.entry === "limit") {
    const r = placeOrder({
      username: req.username,
      symbol,
      side: "buy",
      type: "limit",
      price: Number(req.body.price),
      qty,
      validity,
      bracket: { target, stop },
    });
    if (!r.ok) return res.json({ ok: false, message: r.error });
    return res.json({
      ok: true,
      message: "Bracket order placed. When your buy fills, the target and stop-loss are placed for you.",
    });
  }

  // entry at the market price: check the exits first, then buy now, then place the exits
  const quote = previewOrder(symbol, "buy", qty);
  if (!quote?.ok) return res.json({ ok: false, message: "That buy cannot be filled right now." });
  const bad = validateBracket(symbol, quote.avg, target, stop);
  if (bad) return res.json({ ok: false, message: bad });
  const r = marketTrade(req.username, "buy", symbol, qty);
  if (!r.ok) return res.json({ ok: false, message: r.message });
  attachExits({ username: req.username, symbol, qty, target, stop, validity });
  res.json({
    ok: true,
    message: `${r.message} A target at ₹${target.toFixed(2)} and a stop-loss at ₹${stop.toFixed(2)} are now waiting; when one runs, the other is cancelled.`,
    fees: r.fees,
    data: db.users[req.username].data,
  });
});

// Your open orders and what happened to the recent ones
app.get("/api/orders", auth, (req, res) => {
  res.json(listOrders(req.username));
});

app.delete("/api/orders/:id", auth, (req, res) => {
  res.json({ ok: cancelOrder(Number(req.params.id), req.username) });
});

// ---------- real stock data (Developers page) ----------
app.get("/api/real/:ticker", async (req, res) => {
  res.json(await getReal(req.params.ticker));
});

// ---------- payments (tied to the logged-in user) ----------
const payments = {}; // id -> { amount, username, paid, claimed, at }
const PAYMENT_LIFETIME_MS = 60 * 60 * 1000;

function prunePayments() {
  const now = Date.now();
  for (const [id, p] of Object.entries(payments)) {
    if (now - p.at > PAYMENT_LIFETIME_MS) delete payments[id];
  }
}

app.post("/api/payments", auth, (req, res) => {
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) {
    return res.status(400).json({ error: "Invalid amount" });
  }
  prunePayments();
  const open = Object.values(payments).filter((p) => p.username === req.username && !p.claimed);
  if (open.length >= 5) {
    return res.status(429).json({ error: "You have too many unfinished top-ups. Finish or wait for them to expire." });
  }
  const id = randomUUID();
  payments[id] = { amount, username: req.username, paid: false, claimed: false, at: Date.now() };
  res.json({ id });
});

// The phone opens this when it scans the QR (no login needed on the phone)
app.get("/scan/:id", (req, res) => {
  const payment = payments[req.params.id];
  if (payment) payment.paid = true;
  res.redirect(VIDEO);
});

app.get("/api/payments/:id", (req, res) => {
  const payment = payments[req.params.id];
  if (!payment) return res.status(404).json({ error: "Not found" });
  res.json({ status: payment.paid ? "paid" : "pending" });
});

// Only the user who started the payment can collect it, and only once
app.post("/api/payments/:id/claim", auth, (req, res) => {
  const payment = payments[req.params.id];
  if (
    !payment ||
    payment.username !== req.username ||
    !payment.paid ||
    payment.claimed
  ) {
    return res.json({ ok: false });
  }
  payment.claimed = true;
  const data = db.users[req.username].data;
  data.balance = round2(data.balance + payment.amount);
  data.stats.deposited = round2(data.stats.deposited + payment.amount);
  record(data, {
    kind: "deposit",
    symbol: "",
    qty: 0,
    price: 0,
    value: payment.amount,
    charges: 0,
    tax: 0,
    pnl: null,
    via: "wallet",
  });
  touchUser(req.username);
  res.json({ ok: true, amount: payment.amount, balance: data.balance });
});

// The market carries on from where it stopped, like a real one does the next morning
try {
  const saved = await storage.loadMarket();
  if (saved && importState(saved)) console.log("Market restored from the last save");
} catch (err) {
  console.error("Could not restore the market, starting fresh:", err.message);
}
let lastMarketSave = "";
async function saveMarket() {
  try {
    const text = exportState();
    // savedAt changes every time, so compare without it to skip pointless writes
    const key = text.replace(/"savedAt":\d+,/, "");
    if (key === lastMarketSave) return;
    await storage.saveMarket(text);
    lastMarketSave = key;
  } catch (err) {
    console.error("Could not save the market:", err.message);
  }
}
setInterval(saveMarket, 30000);

startMarket();

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  if (ORIGINS.length > 0) console.log(`Only these websites may use it: ${ORIGINS.join(", ")}`);
});
