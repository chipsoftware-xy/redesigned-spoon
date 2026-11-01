import { useState } from "react";
import { Link } from "react-router-dom";
import { LineChart, Line, YAxis, ResponsiveContainer } from "recharts";
import { caseStudies } from "../data/case_study";

const MODES = [
  { id: "bull", label: "Upward trend" },
  { id: "normal", label: "General" },
  { id: "correction", label: "Correction" },
  { id: "crash", label: "Crash" },
  { id: "recovery", label: "Recovery" },
  { id: "bubble", label: "Bubble" },
];

const MODE_TEXT = {
  bull: "Prices rise steadily and confidence is high. Dips get bought quickly.",
  normal: "No clear direction. Good and bad news cancel out, so prices drift in a range.",
  correction: "A calm pullback of about 10-20% from a recent peak. A reset, not a panic.",
  crash: "A sudden, violent drop. Panic and forced selling hit almost everything at once.",
  recovery: "The rebound after a crash: sharp bounces first, then a choppy climb.",
  bubble: "Prices race far above real value because everyone fears missing out. It can pop into a crash at any moment.",
};

// What buying and selling do in each mood (shown beside the table in learning mode)
const MODE_IMPACT = {
  bull: {
    buy: "Buyers are confident, so dips get bought quickly and demand keeps coming. Rising prices attract more buyers who fear missing out (momentum). A big buy still lifts the price, but there are plenty of sellers and buyers around, so the move is smaller than in a panic.",
    sell: "Few people want to sell winners, so supply is thin. Profit-taking gets absorbed by waiting buyers, which keeps dips shallow and short.",
  },
  normal: {
    buy: "Buyers and sellers roughly balance. A buy order nudges the price up a little, other traders take the other side, and the price drifts back toward where the news says it should be.",
    sell: "The same on the other side: a sell order nudges the price down a little, and new buyers show up at slightly lower prices. Liquidity is typical.",
  },
  correction: {
    buy: "Some buyers step in to buy the dip, but many wait for the pullback to finish. Buying helps prices steady for a while, but rallies tend to fade.",
    sell: "Profit-taking and cautious selling dominate. Buyers are picky, so a sell order pushes the price down more than it would in a calm market.",
  },
  crash: {
    buy: "Brave buyers face a flood of sellers, so buying rarely turns the market. Liquidity dries up, which means any order moves the price a lot, and bounces tend to get sold into.",
    sell: "Panic and forced selling (such as margin calls) overwhelm the few buyers. Each sale pushes the price down, which triggers more selling. Prices can jump down because there are no buyers at nearby levels.",
  },
  recovery: {
    buy: "Bargain hunters and traders closing bets against the market drive sharp bounces. Sellers have thinned out, so buying lifts prices quickly, and many stocks rise together.",
    sell: "Some holders sell into the bounce to get out at better prices, which makes the recovery choppy. Weak companies keep falling even as the leaders recover.",
  },
  bubble: {
    buy: "Everyone is buying out of fear of missing out, even beginners. Prices sit far above what companies earn, so each extra buyer lifts the price by a lot. The higher it goes, the more buyers join, until the buyers run out.",
    sell: "When a few big holders sell, the price wobbles and others rush to sell before it drops further. The market is thin on the way down, so selling can pop the bubble. Here a bubble can also burst on its own at any time.",
  },
};

const ORDER_EXAMPLE = 10000; // rupees, used for the live examples

// min and max of a list of numbers that may contain nulls
function range(values) {
  const v = values.filter((x) => x !== null && x !== undefined);
  return v.length ? [Math.min(...v), Math.max(...v)] : [0, 0];
}

function Market({
  stocks,
  watchlist,
  toggleWatch,
  mode,
  changeMode,
  sensitivity = "medium",
  changeSensitivity,
  news = [],
  learning,
  indices = [],
  trades = [],
}) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("all"); // "all" or "watchlist"

  const q = query.toLowerCase();
  const visible = stocks
    .filter((stock) => tab === "all" || watchlist.includes(stock.symbol))
    .filter(
      (stock) =>
        stock.symbol.toLowerCase().includes(q) ||
        stock.name.toLowerCase().includes(q) ||
        stock.sector.toLowerCase().includes(q)
    );

  const studies = (caseStudies && caseStudies[mode]) || [];
  const info = MODE_IMPACT[mode];
  const modeLabel = MODES.find((m) => m.id === mode)?.label || mode;

  // How far a 10,000 rupee order would move each stock right now, read from the real order book
  const [buyLow, buyHigh] = range(stocks.map((s) => s.buyImpact));
  const [sellLow, sellHigh] = range(stocks.map((s) => s.sellImpact));

  // Everything the bots and users just did, newest first (each stock keeps its own list)
  const feed = stocks
    .flatMap((s) => (s.tape || []).map((t) => ({ ...t, symbol: s.symbol })))
    .sort((a, b) => b.t - a.t)
    .slice(0, 10);

  const broad = indices.filter((ix) => ix.broad);
  const sectorIdx = indices.filter((ix) => !ix.broad);

  // Realistic view: change since yesterday's close (like Nifty on TV).
  // Learning view: change since the server started, like the stocks' "vs base value".
  const indexCard = (ix) => {
    const chg = learning ? ix.sinceStart : ix.change;
    return (
    <div key={ix.id} className={ix.broad ? "index-card broad" : "index-card"}>
      <span className="index-name">{ix.name}</span>
      <strong className="index-value">{ix.value.toFixed(2)}</strong>
      <span className={chg >= 0 ? "up" : "down"}>
        {chg >= 0 ? "+" : ""}
        {chg.toFixed(2)}%{" "}
        <span className="note-small">{learning ? "since start" : "today"}</span>
      </span>
      <div className="spark">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={ix.history}>
            <YAxis hide domain={["auto", "auto"]} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={chg >= 0 ? "#16a34a" : "#dc2626"}
              dot={false}
              strokeWidth={2}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {learning && (
        <span className="note-small">
          {ix.note}. Biggest weight: {ix.top.symbol} ({ix.top.weight.toFixed(0)}
          %)
        </span>
      )}
    </div>
    );
  };

  return (
    <div className={learning ? "app wide" : "app"}>
      <h1>Market Overview</h1>

      {learning && (
        <>
          <div className="modes">
            <span className="modes-label">Market mood:</span>
            {MODES.map((m) => (
              <button
                key={m.id}
                className={
                  mode === m.id ? `mode-btn active ${m.id}` : "mode-btn"
                }
                onClick={() => changeMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="mode-desc">{MODE_TEXT[mode]}</p>

          <div className="modes">
            <span className="modes-label">Market sensitivity:</span>
            {[
              ["low", "Calm"],
              ["medium", "Normal"],
              ["high", "Volatile"],
            ].map(([id, label]) => (
              <button
                key={id}
                className={sensitivity === id ? "mode-btn sens active" : "mode-btn sens"}
                onClick={() => changeSensitivity(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <details className="fold-inline">
            <summary>How moods and sensitivity work</summary>
          <p className="note-small">
            Sensitivity is how strongly prices react to the mood, news and random
            noise. <strong>Calm</strong> halves the reaction: prices drift slowly,
            good for seeing the basics. <strong>Normal</strong> is the standard
            setting. <strong>Volatile</strong> doubles it: bigger swings, faster
            crashes and rallies, and circuit breakers that trigger more often.
            Real markets are calm in quiet times and volatile in panics, so try
            all three with the same mood and compare.
          </p>
          <p className="note-small">
            Changing the mood does not move prices instantly. It changes the
            push on prices, which builds up over time: expect a minute or two
            before a crash is clearly visible, and a few minutes for a big
            fall. If the main index drops 10% from yesterday's close, the
            circuit breaker halts trading for a while, as it would in real
            life (the length depends on the time of day). Real crashes unfold over days or weeks, so this is a
            heavily sped-up version.
          </p>
          <p className="note-small">
            This is a shared simulation: changing the mood changes it for
            everyone using the platform.
          </p>
          </details>

          {studies.length > 0 && (
            <div className="case-box">
              <h4>Real-world examples of this mood</h4>
              {studies.map((s) => (
                <details key={s.title} className="case-item">
                  <summary>
                    {s.title} <span className="note-small">({s.period})</span>
                  </summary>
                  <ul>
                    {s.figures.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                  <p>
                    <strong>What it teaches:</strong> {s.lesson}
                  </p>
                  {s.note && <p className="note-small">{s.note}</p>}
                  <p className="note-small">
                    Sources:{" "}
                    {s.sources.map((url, i) => (
                      <span key={url}>
                        {i > 0 && ", "}
                        <a href={url} target="_blank" rel="noopener noreferrer">
                          {new URL(url).hostname.replace("www.", "")}
                        </a>
                      </span>
                    ))}
                  </p>
                </details>
              ))}
            </div>
          )}
        </>
      )}

      <div className="index-grid broad-grid">{broad.map(indexCard)}</div>
      <div className="index-grid">{sectorIdx.map(indexCard)}</div>

      {news.length > 0 && (
        <div className="news-box">
          <h4>Market news</h4>
          {news.slice(0, 3).map((n, i) => (
            <div key={n.time + i} className="news-item">
              {learning && (
                <>
                  <span className={n.up ? "up" : "down"}>
                    {n.up ? "▲" : "▼"}
                  </span>{" "}
                  <span className="sector-tag">{n.sector}</span>{" "}
                </>
              )}
              {n.text} <span className="note-small">({n.time})</span>
            </div>
          ))}
        </div>
      )}

      <div className={learning ? "market-layout" : "market-layout single"}>
        {learning && (
          <aside className="side-panel">
            <h4>When people buy</h4>
            <p className="panel-mood">{modeLabel} market</p>
            <p>{info.buy}</p>
            <div className="panel-live">
              <span className="note-small">In this simulator, right now</span>
              <strong className="up">
                A ₹{ORDER_EXAMPLE.toLocaleString("en-IN")} buy moves a stock up
                by about {buyLow.toFixed(2)}% to {buyHigh.toFixed(2)}%
              </strong>
              <span className="note-small">
                Read from the order book: your order eats the cheapest sell
                orders first, so a thin book moves more. Smaller companies and
                scared markets have thinner books.
              </span>
            </div>
          </aside>
        )}

        <div className="market-center">
          <div className="tabs">
            <button
              className={tab === "all" ? "tab active" : "tab"}
              onClick={() => setTab("all")}
            >
              All stocks
            </button>
            <button
              className={tab === "watchlist" ? "tab active" : "tab"}
              onClick={() => setTab("watchlist")}
            >
              My Watchlist ({watchlist.length})
            </button>
          </div>

          <div className="search-box">
            <svg className="search-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
              <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, symbol or sector"
              aria-label="Search stocks"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button type="button" className="search-clear" onClick={() => setQuery("")}>
                Clear
              </button>
            )}
          </div>
          <p className="note-small search-count">
            Showing {visible.length} of {tab === "all" ? stocks.length : watchlist.length} stocks
          </p>

          <table>
            <thead>
              <tr>
                <th></th>
                <th>Symbol</th>
                <th>Name</th>
                <th>Sector</th>
                <th>Price (₹)</th>
                <th>Mkt cap (₹ cr)</th>
                <th>{learning ? "vs base value" : "Day change %"}</th>
                {learning && <th>₹10k buy / sell moves</th>}
              </tr>
            </thead>
            <tbody>
              {visible.map((stock) => (
                <tr key={stock.symbol}>
                  <td>
                    <button
                      className="star"
                      onClick={() => toggleWatch(stock.symbol)}
                    >
                      {watchlist.includes(stock.symbol) ? "★" : "☆"}
                    </button>
                  </td>
                  <td>
                    <Link to={`/stock/${stock.symbol}`}>{stock.symbol}</Link>
                  </td>
                  <td>{stock.name}</td>
                  <td>
                    <span className="sector-tag">{stock.sector}</span>
                  </td>
                  <td>
                    {stock.price.toFixed(2)}
                    {stock.circuit && (
                      <span className="badge todo circuit-tag">
                        {stock.circuit === "upper" ? "Upper limit" : "Lower limit"}
                      </span>
                    )}
                  </td>
                  <td>
                    {Math.round(stock.marketCap).toLocaleString("en-IN")}
                  </td>
                  <td
                    className={
                      (learning ? stock.change : stock.dayChange) >= 0 ? "up" : "down"
                    }
                  >
                    {(learning ? stock.change : stock.dayChange) >= 0 ? "+" : ""}
                    {(learning ? stock.change : stock.dayChange).toFixed(2)}%
                  </td>
                  {learning && (
                    <td>
                      {stock.buyImpact === null
                        ? "n/a"
                        : `${stock.buyImpact >= 0 ? "+" : ""}${stock.buyImpact.toFixed(2)}%`}{" "}
                      /{" "}
                      {stock.sellImpact === null
                        ? "n/a"
                        : `${stock.sellImpact >= 0 ? "+" : ""}${stock.sellImpact.toFixed(2)}%`}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {visible.length === 0 && (
            <p className="empty">
              {tab === "watchlist"
                ? "Nothing here yet. Click the ☆ next to a stock to add it."
                : "No stocks match your search."}
            </p>
          )}
        </div>

        {learning && (
          <aside className="side-panel">
            <h4>When people sell</h4>
            <p className="panel-mood">{modeLabel} market</p>
            <p>{info.sell}</p>
            <div className="panel-live">
              <span className="note-small">In this simulator, right now</span>
              <strong className="down">
                A ₹{ORDER_EXAMPLE.toLocaleString("en-IN")} sell moves a stock
                down by about {Math.abs(sellHigh).toFixed(2)}% to{" "}
                {Math.abs(sellLow).toFixed(2)}%
              </strong>
              <span className="note-small">
                Selling eats the highest buy orders first. Buy and sell moves
                differ because the two sides of the book differ.
              </span>
            </div>

            <h4 className="panel-sub">Who is trading</h4>
            {feed.length === 0 ? (
              <p className="note-small">Waiting for the first trades...</p>
            ) : (
              feed.map((t, i) => (
                <div key={`${t.t}-${i}`} className="trade-line">
                  <span className="note-small">{t.who}</span>{" "}
                  <span className={t.side === "buy" ? "up" : "down"}>
                    {t.side === "buy" ? "bought" : "sold"}
                  </span>{" "}
                  {t.qty} {t.symbol}
                </div>
              ))
            )}

            {trades.length > 0 && (
              <>
                <h4 className="panel-sub">Platform orders</h4>
                {trades.slice(0, 4).map((t, i) => (
                  <div key={`${t.time}-${i}`} className="trade-line">
                    <span className={t.side === "buy" ? "up" : "down"}>
                      {t.side === "buy" ? "Buy" : "Sell"}
                    </span>{" "}
                    {t.qty} × {t.symbol}{" "}
                    <span className={t.impactPct >= 0 ? "up" : "down"}>
                      {t.impactPct >= 0 ? "+" : ""}
                      {t.impactPct.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

export default Market;
