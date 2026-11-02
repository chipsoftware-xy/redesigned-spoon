import { useState, useEffect, useCallback, useRef } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Market from "./pages/market";
import StockDetail from "./pages/stockdetail";
import Wallet from "./pages/wallet";
import Portfolio from "./pages/portfolio";
import Auth from "./pages/auth";
import HowItWorks from "./pages/howitworks";
import Learn from "./pages/learn";
import Developers from "./pages/developers";
import { API } from "./config";


// Shows whether the market is open, halted or closed, with a countdown
function SessionBar({ session, at }) {
  // "now" lives in state and is refreshed every second, so render stays pure
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!session) return null;

  const wrap = (kind, title, side, sub) => (
    <div className="session-wrap">
      <div className={`session-bar ${kind}`}>
        <div className="session-main">
          <strong>{title}</strong>
          <span className="session-side">{side}</span>
        </div>
        {sub && <div className="session-sub">{sub}</div>}
      </div>
    </div>
  );

  if (session.forced) {
    return wrap(
      "forced",
      "Practice override",
      "Market hours are switched off on this server",
      "The real schedule is 9:30 am to 3:00 pm India time, Monday to Friday."
    );
  }

  const left = Math.max(0, session.remainingMs - Math.max(0, now - at));
  const h = Math.floor(left / 3600000);
  const m = Math.floor((left % 3600000) / 60000);
  const sec = Math.floor((left % 60000) / 1000);
  const clock =
    h > 0
      ? `${h}h ${String(m).padStart(2, "0")}m`
      : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;

  if (session.state === "halted") {
    return wrap(
      "halted",
      "Trading halted",
      `Resumes in ${clock}`,
      `${session.reason}. Circuit breakers stop trading when the whole market moves too fast, to give everyone time to think.`
    );
  }

  return wrap(
    session.open ? "open" : "closed",
    session.open ? "Market open" : session.holiday ? "Market closed: holiday" : "Market closed",
    `${session.open ? "Closes" : "Opens"} in ${clock} · Day ${session.day}`,
    session.open
      ? "Trading hours: 9:30 am to 3:00 pm India time, Monday to Friday, except exchange holidays."
      : `${session.holiday ? `Holiday today: ${session.holiday}. ` : ""}Trading hours: 9:30 am to 3:00 pm India time, Monday to Friday, except exchange holidays. Prices are frozen. Limit and stop orders can still be placed and will wait for the open.`
  );
}

// Shown at the bottom of every page
function Footer() {
  return (
    <footer className="site-footer">
      <div className="advisory">
        <strong>Please read.</strong> This is a simulated platform. What you
        learn here does not always apply to a real stock exchange. To build a
        real portfolio, keep up with global and local news. This module was made
        to give a core understanding of the stock market and how its mathematics
        works, intuitively. It is not financial advice.
      </div>
      <p className="copyright">
        Copyright © 2026 mirchika4 on Instagram. All rights reserved. If you
        have any suggestions, send them to the Instagram account{" "}
        <a
          href="https://www.instagram.com/mirchika4/"
          target="_blank"
          rel="noopener noreferrer"
        >
          @mirchika4
        </a>
        .
      </p>
    </footer>
  );
}

function App() {
  const [stocks, setStocks] = useState([]);
  const [mode, setMode] = useState("normal");
  const [sensitivity, setSensitivityState] = useState("medium");
  const [news, setNews] = useState([]);
  const [indices, setIndices] = useState([]);
  const [trades, setTrades] = useState([]);
  const [session, setSession] = useState(null);
  const [sessionAt, setSessionAt] = useState(0);
  const [orders, setOrders] = useState({ open: [], events: [] });

  // "learning" shows how prices work, "realistic" hides it
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem("viewMode") === "realistic"
        ? "realistic"
        : "learning";
    } catch {
      return "learning";
    }
  });
  const learning = viewMode === "learning";

  useEffect(() => {
    try {
      localStorage.setItem("viewMode", viewMode);
    } catch {
      // storage unavailable, the choice just won't be remembered
    }
  }, [viewMode]);

  // dark (default) or light colours
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("theme") === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("theme", theme);
    } catch {
      // storage unavailable, the choice just won't be remembered
    }
  }, [theme]);

  // a small message at the bottom of the screen (for example "wait 20 seconds")
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef(null);
  const showNotice = useCallback((text) => {
    setNotice(text);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 5000);
  }, []);

  // login state
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [username, setUsername] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [authChecked, setAuthChecked] = useState(
    () => !localStorage.getItem("token")
  );
  const [dataLoaded, setDataLoaded] = useState(false);

  // per-user data, loaded from the server
  const [watchlist, setWatchlist] = useState([]);
  const [balance, setBalance] = useState(0);
  const [holdings, setHoldings] = useState({});
  const [stats, setStats] = useState(null); // totals: money put in, charges, tax, dividends...
  const [history, setHistory] = useState([]); // your latest trades

  // copy everything the server knows about the user into the screen's state
  const applyData = useCallback((data) => {
    setBalance(data.balance);
    setHoldings(data.holdings);
    setStats(data.stats || null);
    setHistory(data.history || []);
  }, []);

  const loadSession = useCallback((session) => {
    localStorage.setItem("token", session.token);
    setToken(session.token);
    setUsername(session.username);
    setDisplayName(session.name || session.username);
    applyData(session.data);
    setWatchlist(session.data.watchlist);
    setDataLoaded(true);
    setAuthChecked(true);
  }, [applyData]);

  // Put what the server sent into the screen's state
  const applyMarket = useCallback((data) => {
    setStocks(data.stocks);
    setMode(data.mode);
    setSensitivityState(data.sensitivity || "medium");
    setNews(data.news);
    setIndices(data.indices || []);
    setTrades(data.trades || []);
    setSession(data.session || null);
    setSessionAt(Date.now());
  }, []);

  // Fetch the live market from the server every 2 seconds
  useEffect(() => {
    let cancelled = false;

    async function loadMarket() {
      try {
        const res = await fetch(`${API}/api/market`);
        const data = await res.json();
        if (!cancelled) applyMarket(data);
      } catch {
        // server unreachable, we'll try again on the next tick
      }
    }

    loadMarket();
    const timer = setInterval(loadMarket, 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [applyMarket]);

  // on page load, if a token is saved, ask the server who we are
  useEffect(() => {
    const saved = localStorage.getItem("token");
    if (!saved) return;

    fetch(`${API}/api/me`, { headers: { Authorization: `Bearer ${saved}` } })
      .then(async (res) => {
        if (res.status === 401) {
          localStorage.removeItem("token");
          setToken(null);
          return null;
        }
        if (!res.ok) return null;
        const me = await res.json();
        return { token: saved, username: me.username, name: me.name, data: me.data };
      })
      .then((session) => {
        if (session) loadSession(session);
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, [loadSession]);

  // Your waiting (limit and stop) orders. When one fills, refresh the wallet and holdings.
  const lastEvent = useRef("");
  useEffect(() => {
    if (!dataLoaded || !token) return;
    let cancelled = false;
    const headers = { Authorization: `Bearer ${token}` };

    async function loadOrders() {
      try {
        const res = await fetch(`${API}/api/orders`, { headers });
        if (!res.ok) return;
        const o = await res.json();
        if (cancelled) return;
        setOrders(o);
        const key = o.events[0] ? o.events[0].time + o.events[0].text : "";
        if (key !== lastEvent.current) {
          const first = lastEvent.current === "";
          lastEvent.current = key;
          if (!first || key) {
            const me = await fetch(`${API}/api/me`, { headers });
            if (me.ok && !cancelled) {
              applyData((await me.json()).data);
            }
          }
        }
      } catch {
        // try again on the next round
      }
    }

    loadOrders();
    const timer = setInterval(loadOrders, 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [dataLoaded, token, applyData]);

  // Dividends and expired orders change your account without any click, so look again now and then
  useEffect(() => {
    if (!dataLoaded || !token) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) applyData((await res.json()).data);
      } catch {
        // try again later
      }
    }, 15000);
    return () => clearInterval(timer);
  }, [dataLoaded, token, applyData]);

  // only the watchlist is saved from the browser
  useEffect(() => {
    if (!dataLoaded || !token) return;

    const timer = setTimeout(() => {
      fetch(`${API}/api/me/data`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ watchlist }),
      }).catch(() => {});
    }, 300);

    return () => clearTimeout(timer);
  }, [watchlist, dataLoaded, token]);

  async function logout() {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
    try {
      await fetch(`${API}/api/me/data`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ watchlist }),
      });
      await fetch(`${API}/api/auth/logout`, { method: "POST", headers });
    } catch {
      // server unreachable: log out on this device anyway
    }
    localStorage.removeItem("token");
    setDataLoaded(false);
    setToken(null);
    setUsername(null);
    setBalance(0);
    setHoldings({});
    setStats(null);
    setHistory([]);
    setWatchlist([]);
  }

  // Switch the market mood (changes it for everyone). Learning mode only.
  async function changeMode(newMode) {
    setMode(newMode);
    try {
      const res = await fetch(`${API}/api/market/mode`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mode: newMode }),
      });
      if (!res.ok) {
        const r = await res.json().catch(() => ({}));
        showNotice(r.error || "The mood could not be changed.");
      }
    } catch {
      // the next market refresh will show the real mode
    }
  }

  // How strongly prices react (calm, normal or volatile). Changes it for everyone.
  async function changeSensitivity(level) {
    setSensitivityState(level);
    try {
      const res = await fetch(`${API}/api/market/sensitivity`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ level }),
      });
      if (!res.ok) {
        const r = await res.json().catch(() => ({}));
        showNotice(r.error || "The setting could not be changed.");
      }
    } catch {
      // the next market refresh will show the real setting
    }
  }

  function toggleWatch(symbol) {
    setWatchlist((current) =>
      current.includes(symbol)
        ? current.filter((s) => s !== symbol)
        : [...current, symbol]
    );
  }

  // buy and sell are decided by the server
  async function trade(side, symbol, qty) {
    try {
      const res = await fetch(`${API}/api/trade`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ side, symbol, qty }),
      });
      const result = await res.json();
      if (result.ok) {
        applyData(result.data);
        // show the price your order caused right away
        try {
          const m = await fetch(`${API}/api/market`);
          applyMarket(await m.json());
        } catch {
          // the next regular refresh will catch up
        }
      }
      return {
        ok: Boolean(result.ok),
        message: result.message || result.error || "Trade failed.",
        fees: result.fees || null,
      };
    } catch {
      return { ok: false, message: "Can't reach the server." };
    }
  }

  // A limit or stop order: it waits inside the market until the price is right
  async function placeOrder(order) {
    try {
      const res = await fetch(`${API}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(order),
      });
      const r = await res.json();
      return { ok: Boolean(r.ok), message: r.message || "Order failed." };
    } catch {
      return { ok: false, message: "Can't reach the server." };
    }
  }

  // A bracket: buy, then a target and a stop-loss that cancel each other
  async function placeBracket(order) {
    try {
      const res = await fetch(`${API}/api/orders/bracket`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(order),
      });
      const r = await res.json();
      if (r.ok && r.data) applyData(r.data);
      return { ok: Boolean(r.ok), message: r.message || "Order failed.", fees: r.fees || null };
    } catch {
      return { ok: false, message: "Can't reach the server." };
    }
  }

  async function cancelOrder(id) {
    try {
      await fetch(`${API}/api/orders/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrders((o) => ({ ...o, open: o.open.filter((x) => x.id !== id) }));
    } catch {
      // the next refresh will show the real list
    }
  }

  const buy = (symbol, qty) => trade("buy", symbol, qty);
  const sell = (symbol, qty) => trade("sell", symbol, qty);

  // Gatekeeping. These come AFTER all the hooks above.
  if (!authChecked) {
    return (
      <div className="app">
        <p className="empty">Loading...</p>
      </div>
    );
  }
  if (!username) {
    return (
      <>
        <Auth onLogin={loadSession} />
        <Footer />
      </>
    );
  }
  if (stocks.length === 0) {
    return (
      <div className="app">
        <p className="empty">Connecting to the market...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <nav className="topbar">
        <div className="topbar-left">
          <Link to="/">Market</Link>
          <Link to="/portfolio">Portfolio</Link>
          <Link to="/learn">Learn</Link>
          <Link to="/developers">Developers</Link>
          {learning && <Link to="/how-it-works">How it works</Link>}
        </div>
        <div className="topbar-right">
          <div className="view-toggle">
            <button
              className={learning ? "view-btn active" : "view-btn"}
              onClick={() => setViewMode("learning")}
            >
              Learning
            </button>
            <button
              className={!learning ? "view-btn active" : "view-btn"}
              onClick={() => setViewMode("realistic")}
            >
              Realistic
            </button>
          </div>
          <button
            className="theme-toggle"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title="Switch between dark and light colours"
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          <Link to="/wallet">Wallet: ₹{balance.toFixed(2)}</Link>
          <span className="user" title={`@${username}`}>{displayName}</span>
          <button className="logout" onClick={logout}>
            Log out
          </button>
        </div>
      </nav>

      <SessionBar session={session} at={sessionAt} />

      <Routes>
        <Route
          path="/"
          element={
            <Market
              stocks={stocks}
              watchlist={watchlist}
              toggleWatch={toggleWatch}
              mode={mode}
              changeMode={changeMode}
              sensitivity={sensitivity}
              changeSensitivity={changeSensitivity}
              news={news}
              learning={learning}
              indices={indices}
              trades={trades}
            />
          }
        />
        <Route
          path="/stock/:symbol"
          element={
            <StockDetail
              stocks={stocks}
              watchlist={watchlist}
              toggleWatch={toggleWatch}
              balance={balance}
              holdings={holdings}
              buy={buy}
              sell={sell}
              mode={mode}
              learning={learning}
              session={session}
              orders={orders}
              placeOrder={placeOrder}
              placeBracket={placeBracket}
              cancelOrder={cancelOrder}
            />
          }
        />
        <Route
          path="/portfolio"
          element={
            <Portfolio
              stocks={stocks}
              holdings={holdings}
              balance={balance}
              stats={stats}
              history={history}
            />
          }
        />
        <Route
          path="/wallet"
          element={
            <Wallet token={token} balance={balance} setBalance={setBalance} />
          }
        />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/learn" element={<Learn />} />
        <Route path="/developers" element={<Developers stocks={stocks} indices={indices} />} />
      </Routes>

      <Footer />
      {notice && <div className="toast">{notice}</div>}
    </BrowserRouter>
  );
}

export default App;
