import { useState } from "react";
import { API } from "../config";

function Auth({ onLogin }) {
  const [mode, setMode] = useState("login"); // "login" or "register"
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const registering = mode === "register";

  async function submit(e) {
    e.preventDefault(); // stop the browser from reloading the page
    setError("");

    if (registering) {
      if (name.trim().length < 2) return setError("Please enter your name.");
      const years = Number(age);
      if (!Number.isInteger(years) || years < 13 || years > 100) {
        return setError("Age must be a whole number from 13 to 100.");
      }
      if (password !== confirm) return setError("The two passwords do not match.");
    }

    setBusy(true);
    try {
      const res = await fetch(`${API}/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          registering ? { name, age: Number(age), username, password } : { username, password }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        setBusy(false);
      } else {
        onLogin(data);
      }
    } catch {
      setError(
        "Can't reach the server. If it was idle it may be waking up: wait about a minute and try again."
      );
      setBusy(false);
    }
  }

  function switchMode() {
    setMode(registering ? "login" : "register");
    setError("");
    setPassword("");
    setConfirm("");
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <h1>Stock Market(Not Really)</h1>
        <p className="auth-sub">
          {registering ? "Create an account to start learning" : "Log in to see your portfolio"}
        </p>

        <div className="network-note">
          Practice platform: fake money, simulated prices. Please don&apos;t use a
          real password.
        </div>

        {error && <div className="auth-error">{error}</div>}

        {registering && (
          <div className="form-row">
            <div className="field grow">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                maxLength={40}
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="field narrow">
              <label htmlFor="age">Age</label>
              <input
                id="age"
                type="number"
                inputMode="numeric"
                min="13"
                max="100"
                placeholder="18"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="field">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            autoComplete="username"
            placeholder={registering ? "Letters, numbers, underscore" : ""}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete={registering ? "new-password" : "current-password"}
            placeholder={registering ? "At least 6 characters" : ""}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {registering && (
          <div className="field">
            <label htmlFor="confirm">Confirm password</label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
        )}

        <button className="primary-btn" disabled={busy}>
          {busy ? "Please wait..." : registering ? "Create account" : "Log in"}
        </button>

        <p className="auth-switch">
          {registering ? "Already have an account? " : "New here? "}
          <button type="button" className="link-btn" onClick={switchMode}>
            {registering ? "Log in" : "Create an account"}
          </button>
        </p>
      </form>
    </div>
  );
}

export default Auth;
