import { useState } from "react";
import { API } from "../config.js";

function Auth({ onLogin }) {
  const [mode, setMode] = useState("login"); // "login" or "register"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault(); // stop the browser from reloading the page
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        setBusy(false);
      } else {
        onLogin(data);
      }
    } catch {
      setError("Can't reach the server. Is `node server/index.js` running?");
      setBusy(false);
    }
  }

  function switchMode() {
    setMode(mode === "login" ? "register" : "login");
    setError("");
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <h1>Stock Market(Not Really)</h1>
        <p className="auth-sub">
          {mode === "login"
            ? "Log in to see your portfolio"
            : "Create an account to start learning"}
        </p>

        <div className="network-note">
          Practice platform: fake money, simulated prices. Please don't use a
          real password.
        </div>

        {error && <div className="auth-error">{error}</div>}

        <label htmlFor="username">Username</label>
        <input
          id="username"
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button className="primary-btn" disabled={busy}>
          {busy
            ? "Please wait..."
            : mode === "login"
            ? "Log in"
            : "Create account"}
        </button>

        <p className="auth-switch">
          {mode === "login" ? "New here? " : "Already have an account? "}
          <button type="button" className="link-btn" onClick={switchMode}>
            {mode === "login" ? "Create an account" : "Log in"}
          </button>
        </p>
      </form>
    </div>
  );
}

export default Auth;