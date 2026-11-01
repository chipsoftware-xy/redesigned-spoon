import { Link } from "react-router-dom";

const money = (n) => `₹${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const sign = (n) => (n >= 0 ? "+" : "-");
const signed = (n) => `${sign(n)}${money(n)}`;

const HOW = {
  market: "Market",
  limit: "Limit",
  stop: "Stop",
  trail: "Trailing stop",
  target: "Target",
  stoploss: "Stop-loss",
  dividend: "Dividend",
  wallet: "Top-up",
};

function when(iso) {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Portfolio({ stocks, holdings, balance, stats, history }) {
  // Turn the holdings object into a list of rows with live numbers
  const rows = Object.entries(holdings)
    .map(([symbol, h]) => {
      const stock = stocks.find((s) => s.symbol === symbol);
      if (!stock) return null;

      const invested = h.avgPrice * h.qty;
      const current = stock.price * h.qty;
      const pnl = current - invested;
      const pnlPct = (pnl / invested) * 100;

      return { symbol, name: stock.name, price: stock.price, ...h, invested, current, pnl, pnlPct };
    })
    .filter(Boolean);

  const totalInvested = rows.reduce((sum, r) => sum + r.invested, 0);
  const totalCurrent = rows.reduce((sum, r) => sum + r.current, 0);
  const unrealised = totalCurrent - totalInvested;
  const unrealisedPct = totalInvested > 0 ? (unrealised / totalInvested) * 100 : 0;

  // The whole story: everything you own now, against all the money you ever put in
  const netWorth = balance + totalCurrent;
  const deposited = stats?.deposited ?? 0;
  const overall = netWorth - deposited;
  const overallPct = deposited > 0 ? (overall / deposited) * 100 : 0;

  const realised = stats?.realizedGross ?? 0;
  const dividends = stats?.dividends ?? 0;
  const charges = stats?.chargesPaid ?? 0;
  const tax = stats?.taxPaid ?? 0;

  const trades = history || [];

  return (
    <div className="app wide">
      <h1>My Portfolio</h1>

      <div className="summary-grid">
        <div className="summary-card">
          <span>Net worth</span>
          <strong>{money(netWorth)}</strong>
          <small>Wallet + shares at today's prices</small>
        </div>
        <div className="summary-card">
          <span>Money you put in</span>
          <strong>{money(deposited)}</strong>
          <small>All your wallet top-ups</small>
        </div>
        <div className="summary-card">
          <span>Overall profit / loss</span>
          <strong className={overall >= 0 ? "up" : "down"}>{signed(overall)}</strong>
          <small className={overall >= 0 ? "up" : "down"}>
            {sign(overallPct)}
            {Math.abs(overallPct).toFixed(2)}% on what you put in
          </small>
        </div>
        <div className="summary-card">
          <span>Wallet balance</span>
          <strong>{money(balance)}</strong>
        </div>
      </div>

      <h2>Where your profit or loss came from</h2>
      <table className="how-table">
        <tbody>
          <tr>
            <td>Profit on shares you sold (before charges and tax)</td>
            <td className={realised >= 0 ? "up" : "down"}>{signed(realised)}</td>
          </tr>
          <tr>
            <td>Paper profit on shares you still hold (unrealised)</td>
            <td className={unrealised >= 0 ? "up" : "down"}>
              {signed(unrealised)} ({sign(unrealisedPct)}
              {Math.abs(unrealisedPct).toFixed(2)}%)
            </td>
          </tr>
          <tr>
            <td>Dividends received</td>
            <td className="up">+{money(dividends)}</td>
          </tr>
          <tr>
            <td>Brokerage, STT, GST and other charges paid</td>
            <td className="down">-{money(charges)}</td>
          </tr>
          <tr>
            <td>Tax paid on profits</td>
            <td className="down">-{money(tax)}</td>
          </tr>
          <tr className="total-row">
            <td>Overall</td>
            <td className={overall >= 0 ? "up" : "down"}>{signed(overall)}</td>
          </tr>
        </tbody>
      </table>
      <p className="note-small">
        Unrealised profit is only on paper until you sell. Charges and tax are
        fake, but they work like the real thing: they quietly eat into every
        trade, which is why trading very often rarely pays.
      </p>

      <h2>Holdings</h2>
      {rows.length === 0 ? (
        <p className="empty">
          You don't own any stocks yet. <Link to="/">Go to the market</Link> and
          buy your first one.
        </p>
      ) : (
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>Stock</th>
                <th>Qty</th>
                <th>Avg price</th>
                <th>Current</th>
                <th>Value</th>
                <th>P/L</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.symbol}>
                  <td>
                    <Link to={`/stock/${r.symbol}`}>{r.symbol}</Link>
                    <div className="note-small">{r.name}</div>
                  </td>
                  <td>{r.qty}</td>
                  <td>₹{r.avgPrice.toFixed(2)}</td>
                  <td>₹{r.price.toFixed(2)}</td>
                  <td>{money(r.current)}</td>
                  <td className={r.pnl >= 0 ? "up" : "down"}>
                    {signed(r.pnl)}
                    <div className="note-small">
                      {sign(r.pnlPct)}
                      {Math.abs(r.pnlPct).toFixed(2)}%
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>Trade history</h2>
      {trades.length === 0 ? (
        <p className="empty">Nothing yet. Your buys, sells, dividends and top-ups will be listed here.</p>
      ) : (
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>What</th>
                <th>Stock</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Amount</th>
                <th>Charges + tax</th>
                <th>Profit on sale</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t, i) => (
                <tr key={`${t.time}-${i}`}>
                  <td>{when(t.time)}</td>
                  <td>
                    <strong
                      className={t.kind === "sell" ? "down" : t.kind === "buy" ? "up" : ""}
                    >
                      {t.kind === "deposit" ? "Top-up" : t.kind === "dividend" ? "Dividend" : t.kind === "buy" ? "Buy" : "Sell"}
                    </strong>
                    <div className="note-small">{t.kind === "buy" || t.kind === "sell" ? HOW[t.via] || t.via : ""}</div>
                  </td>
                  <td>{t.symbol ? <Link to={`/stock/${t.symbol}`}>{t.symbol}</Link> : "-"}</td>
                  <td>{t.qty || "-"}</td>
                  <td>{t.price ? `₹${t.price.toFixed(2)}` : "-"}</td>
                  <td>{money(t.value)}</td>
                  <td>{t.charges + t.tax > 0 ? money(t.charges + t.tax) : "-"}</td>
                  <td className={t.pnl === null ? "" : t.pnl >= 0 ? "up" : "down"}>
                    {t.pnl === null ? "-" : signed(t.pnl)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="note-small">Showing your latest {trades.length} entries (the server keeps the last 200).</p>
    </div>
  );
}

export default Portfolio;
