import { useState, useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ReferenceDot,
  ComposedChart,
  Bar,
  BarChart,
  ResponsiveContainer,
} from "recharts";
import { API } from "../config";

const MODE_NAMES = {
  crash: "Crash",
  correction: "Correction",
  normal: "General market",
  bull: "Upward trend",
  recovery: "Recovery",
  bubble: "Bubble",
};


// +0.123%  /  -0.045%
const pct = (v) => `${v >= 0 ? "+" : ""}${v.toFixed(3)}%`;

// One candlestick: a thin line from low to high and a box from open to close
function CandleShape({ x, y, width, height, payload }) {
  const { o, c, h, l } = payload;
  const color = c >= o ? "#16a34a" : "#dc2626";
  const range = h - l;
  const px = (v) => (range === 0 ? y : y + ((h - v) / range) * height);
  const top = px(Math.max(o, c));
  const bottom = px(Math.min(o, c));
  const mid = x + width / 2;
  return (
    <g>
      <line x1={mid} x2={mid} y1={y} y2={y + height} stroke={color} />
      <rect
        x={x + width * 0.15}
        width={width * 0.7}
        y={top}
        height={Math.max(1, bottom - top)}
        fill={color}
      />
    </g>
  );
}

function CandleTip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="candle-tip">
      <div>{d.time}</div>
      <div>Open {d.o.toFixed(2)} · Close {d.c.toFixed(2)}</div>
      <div>High {d.h.toFixed(2)} · Low {d.l.toFixed(2)}</div>
      <div>Volume {d.v.toLocaleString("en-IN")}</div>
    </div>
  );
}

function StockDetail({
  stocks,
  watchlist,
  toggleWatch,
  balance,
  holdings,
  buy,
  sell,
  mode,
  learning,
  session,
  orders,
  placeOrder,
  placeBracket,
  cancelOrder,
}) {
  const { symbol } = useParams();

  // These must stay above the "stock not found" check below
  const [qty, setQty] = useState(1);
  const [result, setResult] = useState(null); // { ok, message }
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState({ buy: null, sell: null }); // what an order would get
  const [orderType, setOrderType] = useState("market"); // market, limit, stop, trail or bracket
  const [orderPrice, setOrderPrice] = useState("");
  const [validity, setValidity] = useState("day"); // "day" or "gtc" (good till cancelled)
  const [trailPct, setTrailPct] = useState("3");
  const [entryKind, setEntryKind] = useState("market"); // bracket: buy now, or at a limit price
  const [target, setTarget] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [chartType, setChartType] = useState("candles"); // realistic mode: candles or line
  const [marks, setMarks] = useState([]); // where your orders landed on the chart
  const latest = useRef({ time: null, price: null }); // newest chart point, for order markers

  const sym = symbol;
  const livePrice = stocks.find((x) => x.symbol === sym)?.price;
  const lastTime = stocks.find((x) => x.symbol === sym)?.history.slice(-1)[0]?.time;

  // Ask the server what a buy and a sell of this size would cost right now
  useEffect(() => {
    if (!Number.isInteger(qty) || qty <= 0) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const get = async (side) =>
          (await fetch(`${API}/api/preview?symbol=${sym}&side=${side}&qty=${qty}`)).json();
        const [buyP, sellP] = await Promise.all([get("buy"), get("sell")]);
        if (!cancelled) setPreview({ buy: buyP, sell: sellP });
      } catch {
        // server unreachable: no preview this time
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sym, qty, livePrice]);

  // Keep track of the newest chart point, so an order can be marked where it landed
  useEffect(() => {
    latest.current = { time: lastTime, price: livePrice };
  }, [lastTime, livePrice]);

  const stock = stocks.find((s) => s.symbol === symbol);

  if (!stock) {
    return (
      <div className="app">
        <Link to="/">← Back to market</Link>
        <p>Stock not found.</p>
      </div>
    );
  }

  const isUp = stock.change >= 0;
  const isWatched = watchlist.includes(stock.symbol);

  const owned = holdings[stock.symbol];
  const ownedQty = owned ? owned.qty : 0;
  const profit = owned ? (stock.price - owned.avgPrice) * owned.qty : 0;
  const estimate = stock.price * (qty > 0 ? qty : 0);

  // In learning mode the chart always has room to show the base value line
  const base = stock.basePrice;
  const yDomain = learning
    ? [(min) => Math.min(min, base), (max) => Math.max(max, base)]
    : ["auto", "auto"];

  // Sends the order to the server and waits for its answer
  const marketOpen = !session || session.open;
  const waitingType = !learning && ["limit", "stop", "trail"].includes(orderType);
  const bracketType = !learning && orderType === "bracket";
  // things that can run while the market is closed or halted: they just wait
  const canWait = waitingType || (bracketType && entryKind === "limit");

  async function doTrade(action, side) {
    setBusy(true);
    if (bracketType) {
      const r = await placeBracket({
        symbol: stock.symbol,
        qty,
        entry: entryKind,
        price: Number(orderPrice),
        target: Number(target),
        stop: Number(stopLoss),
        validity,
      });
      if (r.ok && entryKind === "market" && latest.current.time) {
        const point = latest.current;
        setMarks((cur) => [...cur, { time: point.time, price: point.price, side: "buy" }].slice(-10));
      }
      setResult(r);
    } else if (waitingType) {
      // limit, stop and trailing orders wait inside the market until the price is right
      setResult(
        await placeOrder({
          symbol: stock.symbol,
          side,
          type: orderType,
          price: Number(orderPrice),
          trailPct: Number(trailPct),
          validity,
          qty,
        })
      );
    } else {
      const r = await action(stock.symbol, qty);
      if (r.ok && latest.current.time) {
        const point = latest.current;
        setMarks((cur) => [...cur, { time: point.time, price: point.price, side }].slice(-10));
      }
      setResult(r);
    }
    setBusy(false);
  }

  const myOrders = (orders?.open || []).filter((o) => o.symbol === stock.symbol);
  const typeName = (o) =>
    o.exit === "target"
      ? "Target"
      : o.exit === "stoploss"
        ? "Stop-loss"
        : o.type === "limit"
          ? "Limit"
          : o.type === "trail"
            ? "Trailing stop"
            : o.side === "sell"
              ? "Stop-loss"
              : "Stop";
  const hint =
    orderType === "limit"
      ? "Limit: a buy only runs at this price or lower, a sell only at this price or higher. You never get a worse price than the one you set."
      : orderType === "stop"
        ? "Stop: waits until the price reaches your trigger, then trades at the market price. A sell below the current price is a stop-loss (it limits your loss). A buy above it catches a breakout."
        : orderType === "trail"
          ? "Trailing stop (sell only): a stop-loss that follows the price UP. If the price rises, the trigger rises with it, keeping the same distance. If the price falls, the trigger stays put. When the price drops to the trigger, your shares are sold at the market price."
          : orderType === "bracket"
            ? "Bracket (buy only): you buy, and two sell orders are placed for you: a target above (take profit) and a stop-loss below (limit the loss). When one runs, the other is cancelled automatically (this is called OCO, one cancels other)."
            : "";
  const dayUp = stock.dayChange >= 0;

  const parts = stock.parts || { market: 0, sector: 0, spill: 0, noise: 0, flow: 0, you: 0 };
  const bids = stock.book?.bids || [];
  const asks = stock.book?.asks || [];
  const tape = stock.tape || [];

  // order book rows: nearest 6 levels on each side, with a bar showing size
  const shownAsks = asks.slice(0, 6).reverse();
  const shownBids = bids.slice(0, 6);
  const maxQty = Math.max(1, ...asks.slice(0, 6).map((l) => l[1]), ...bids.slice(0, 6).map((l) => l[1]));
  const bookRow = (side) => (l) => (
    <div key={`${side}-${l[0]}`} className="book-row">
      <div className={`book-bar ${side}`} style={{ width: `${(l[1] / maxQty) * 100}%` }} />
      <span className={side === "ask" ? "down" : "up"}>{l[0].toFixed(2)}</span>
      <span>{l[1]}</span>
    </div>
  );
  const spread = stock.bestAsk && stock.bestBid ? stock.bestAsk - stock.bestBid : null;

  const describe = (p) =>
    !p ? null : p.ok ? (
      <>
        avg ₹{p.avg.toFixed(2)}, price moves{" "}
        <span className={p.impactPct >= 0 ? "up" : "down"}>
          {p.impactPct >= 0 ? "+" : ""}
          {p.impactPct.toFixed(2)}%
        </span>
      </>
    ) : (
      <span className="down">only {p.available} available</span>
    );

  return (
    <div className="app detail">
      <Link to="/">← Back to market</Link>

      <div className="detail-layout">
        <div className="detail-main">
          <div className="title-row">
            <div>
              <h1>{stock.name}</h1>
              <p className="symbol">
                {stock.symbol} ·{" "}
                <span className="sector-tag">{stock.sector}</span>
              </p>
            </div>
            <button
              className={isWatched ? "watch-btn on" : "watch-btn"}
              onClick={() => toggleWatch(stock.symbol)}
            >
              {isWatched ? "★ In watchlist" : "☆ Add to watchlist"}
            </button>
          </div>

          <div className="price-row">
            <span className="big-price">₹{stock.price.toFixed(2)}</span>
            {learning ? (
              <span className={isUp ? "up" : "down"}>
                {stock.change >= 0 ? "+" : ""}
                {stock.change.toFixed(2)}%
              </span>
            ) : (
              <span className={dayUp ? "up" : "down"}>
                {dayUp ? "+" : ""}
                {(stock.price - stock.prevClose).toFixed(2)} ({dayUp ? "+" : ""}
                {stock.dayChange.toFixed(2)}%) today
              </span>
            )}
          </div>

          {stock.circuit && (
            <p className="trade-msg down">
              {stock.circuit === "upper" ? "Upper circuit" : "Lower circuit"}:
              the price has hit its daily limit (₹{stock.limits.low.toFixed(2)}{" "}
              to ₹{stock.limits.high.toFixed(2)}, 20% either side of yesterday's
              close). It cannot move further today, so{" "}
              {stock.circuit === "upper"
                ? "buyers may find no sellers."
                : "sellers may find no buyers."}
            </p>
          )}

          {stock.bestBid && stock.bestAsk && (
            <p className="note-small">
              Bid ₹{stock.bestBid.toFixed(2)} · Ask ₹{stock.bestAsk.toFixed(2)}
              {spread !== null && ` · Spread ₹${spread.toFixed(2)}`}
            </p>
          )}

          {!learning && (
            <div className="chart-toggle">
              <button
                className={chartType === "candles" ? "tab active" : "tab"}
                onClick={() => setChartType("candles")}
              >
                Candles
              </button>
              <button
                className={chartType === "line" ? "tab active" : "tab"}
                onClick={() => setChartType("line")}
              >
                Line
              </button>
            </div>
          )}

          {!learning && chartType === "candles" ? (
            <>
              <div className="chart-box">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={stock.candles}>
                    <XAxis dataKey="time" hide />
                    <YAxis
                      domain={["auto", "auto"]}
                      width={70}
                      tickFormatter={(v) => v.toFixed(0)}
                    />
                    <Tooltip content={<CandleTip />} />
                    <Bar
                      dataKey={(d) => [d.l, d.h]}
                      shape={<CandleShape />}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="volume-box">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stock.candles}>
                    <XAxis dataKey="time" hide />
                    <YAxis width={70} tickFormatter={(v) => v.toFixed(0)} />
                    <Bar dataKey="v" fill="#c4b5fd" isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="note-small">
                Each candle covers 10 seconds. Green closed higher than it
                opened, red lower. The thin line shows the high and low. The
                bars underneath are the shares traded.
              </p>
            </>
          ) : (
          <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stock.history}>
                  <XAxis dataKey="time" hide />
                  <YAxis
                    domain={yDomain}
                    width={70}
                    tickFormatter={(v) => v.toFixed(0)}
                  />
                  <Tooltip formatter={(v) => `₹${v.toFixed(2)}`} />
                  {learning && (
                    <ReferenceLine
                      y={base}
                      stroke="#7c3aed"
                      strokeDasharray="5 5"
                      label={{
                        value: "Base value",
                        position: "insideTopRight",
                        fontSize: 12,
                        fill: "#7c3aed",
                      }}
                    />
                  )}
                  {marks.map((m, i) => (
                    <ReferenceDot
                      key={`${m.time}-${i}`}
                      x={m.time}
                      y={m.price}
                      r={6}
                      ifOverflow="hidden"
                      fill={m.side === "buy" ? "#16a34a" : "#dc2626"}
                      stroke="white"
                    />
                  ))}
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke={isUp ? "#16a34a" : "#dc2626"}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="trade-card">
            <h3>Trade {stock.symbol}</h3>

            <div className="trade-info">
              <div>
                <span>Wallet balance</span>
                <strong>₹{balance.toFixed(2)}</strong>
              </div>
              <div>
                <span>You own</span>
                <strong>{ownedQty} share(s)</strong>
              </div>
              {owned && (
                <>
                  <div>
                    <span>Avg buy price</span>
                    <strong>₹{owned.avgPrice.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span>Profit / Loss</span>
                    <strong className={profit >= 0 ? "up" : "down"}>
                      {profit >= 0 ? "+" : "-"}₹{Math.abs(profit).toFixed(2)}
                    </strong>
                  </div>
                </>
              )}
            </div>

            {!marketOpen && (
              <p className="trade-msg down">
                {session?.state === "halted"
                  ? `Trading is halted: ${session.reason}.`
                  : "The market is closed (9:30 am to 3:00 pm India time, Monday to Friday)."}{" "}
                Market orders are paused. Limit and stop orders can still be
                placed and will wait for the market to run again.
              </p>
            )}

            {!learning && (
              <div className="order-types">
                {[
                  ["market", "Market"],
                  ["limit", "Limit"],
                  ["stop", "Stop / Stop-loss"],
                  ["trail", "Trailing stop"],
                  ["bracket", "Bracket"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    className={orderType === id ? "tab active" : "tab"}
                    onClick={() => {
                      setOrderType(id);
                      setResult(null);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {hint && <p className="note-small">{hint}</p>}
            {bracketType && (
              <div className="order-types">
                {[
                  ["market", "Buy now"],
                  ["limit", "Buy at a limit price"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    className={entryKind === id ? "tab active" : "tab"}
                    onClick={() => {
                      setEntryKind(id);
                      setResult(null);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {orderType === "trail" && (
              <label className="qty-label">
                Trail distance (%)
                <input
                  type="number"
                  min="0.5"
                  max="30"
                  step="0.5"
                  value={trailPct}
                  onChange={(e) => {
                    setTrailPct(e.target.value);
                    setResult(null);
                  }}
                />
              </label>
            )}
            {bracketType && (
              <>
                <label className="qty-label">
                  Target: sell if the price rises to (₹)
                  <input
                    type="number"
                    min="0"
                    step="0.05"
                    placeholder={(stock.price * 1.05).toFixed(2)}
                    value={target}
                    onChange={(e) => {
                      setTarget(e.target.value);
                      setResult(null);
                    }}
                  />
                </label>
                <label className="qty-label">
                  Stop-loss: sell if the price falls to (₹)
                  <input
                    type="number"
                    min="0"
                    step="0.05"
                    placeholder={(stock.price * 0.97).toFixed(2)}
                    value={stopLoss}
                    onChange={(e) => {
                      setStopLoss(e.target.value);
                      setResult(null);
                    }}
                  />
                </label>
              </>
            )}
            {canWait && (
              <label className="qty-label">
                Valid for
                <select
                  value={validity}
                  onChange={(e) => {
                    setValidity(e.target.value);
                    setResult(null);
                  }}
                >
                  <option value="day">This trading day (expires at the close)</option>
                  <option value="gtc">Until I cancel it</option>
                </select>
              </label>
            )}
            {(orderType === "limit" || orderType === "stop" || (bracketType && entryKind === "limit")) && (
              <label className="qty-label">
                {orderType === "stop" ? "Trigger price (₹)" : "Limit price (₹)"}
                <input
                  type="number"
                  min="0"
                  step="0.05"
                  placeholder={stock.price.toFixed(2)}
                  value={orderPrice}
                  onChange={(e) => {
                    setOrderPrice(e.target.value);
                    setResult(null);
                  }}
                />
              </label>
            )}

            <label className="qty-label">
              Quantity
              <input
                type="number"
                min="1"
                step="1"
                value={qty}
                onChange={(e) => {
                  setQty(Number(e.target.value));
                  setResult(null);
                }}
              />
            </label>

            <p className="note-small">
              At the quoted price: ₹{estimate.toFixed(2)}. The real cost comes
              from the order book, so it can be a little higher when buying or
              lower when selling.
            </p>
            {learning && (preview.buy || preview.sell) && (
              <div className="preview-box">
                <div>
                  <strong>If you buy {qty}:</strong> {describe(preview.buy)}
                </div>
                <div>
                  <strong>If you sell {qty}:</strong> {describe(preview.sell)}
                </div>
              </div>
            )}
            {preview.buy?.ok && preview.buy.fees && (
              <p className="note-small">
                Estimated cost of buying {qty}: ₹{preview.buy.cost.toFixed(2)}{" "}
                for the shares + ₹{preview.buy.fees.total.toFixed(2)} charges
                (brokerage ₹{preview.buy.fees.brokerage.toFixed(2)}, STT ₹
                {preview.buy.fees.stt.toFixed(2)}, GST ₹
                {preview.buy.fees.gst.toFixed(2)}, other ₹
                {(preview.buy.fees.exchange + preview.buy.fees.stamp).toFixed(2)}
                ). When you sell, 20% tax on any profit is also taken. All fake.
              </p>
            )}

            <div className="trade-buttons">
              <button
                className="buy-btn"
                disabled={busy || (!canWait && !marketOpen) || orderType === "trail"}
                onClick={() => doTrade(buy, "buy")}
              >
                Buy
              </button>
              <button
                className="sell-btn"
                disabled={busy || (!canWait && !marketOpen) || bracketType}
                onClick={() => doTrade(sell, "sell")}
              >
                Sell
              </button>
            </div>

            {result && (
              <p className={result.ok ? "trade-msg up" : "trade-msg down"}>
                {result.message}
              </p>
            )}
            {result?.fees && (
              <table className="fee-table">
                <tbody>
                  <tr><td>Brokerage</td><td>₹{result.fees.brokerage.toFixed(2)}</td></tr>
                  <tr><td>STT (securities transaction tax)</td><td>₹{result.fees.stt.toFixed(2)}</td></tr>
                  <tr><td>Exchange and regulator fees</td><td>₹{result.fees.exchange.toFixed(2)}</td></tr>
                  <tr><td>GST on fees</td><td>₹{result.fees.gst.toFixed(2)}</td></tr>
                  {result.fees.stamp > 0 && (
                    <tr><td>Stamp duty</td><td>₹{result.fees.stamp.toFixed(2)}</td></tr>
                  )}
                  {result.fees.tax > 0 && (
                    <tr><td>Tax on profit (20%)</td><td>₹{result.fees.tax.toFixed(2)}</td></tr>
                  )}
                  <tr className="total-row"><td>Total taken</td><td>₹{result.fees.total.toFixed(2)}</td></tr>
                </tbody>
              </table>
            )}
          </div>

          {(myOrders.length > 0 || (orders?.events || []).length > 0) && (
            <div className="trade-card">
              <h3>Your waiting orders</h3>
              {myOrders.length === 0 && (
                <p className="note-small">No orders waiting for {stock.symbol}.</p>
              )}
              {myOrders.map((o) => (
                <div key={o.id} className="open-order">
                  <span>
                    <strong className={o.side === "buy" ? "up" : "down"}>
                      {typeName(o)} {o.side}
                    </strong>{" "}
                    {o.remaining} at ₹{o.price.toFixed(2)}
                    <span className="note-small">
                      {o.type === "trail" ? ` (follows ${o.trailPct}% below the high of ₹${o.high.toFixed(2)})` : ""}
                      {o.group ? " · linked pair" : ""}
                      {` · ${o.validity === "day" ? "today only" : "until cancelled"}`}
                    </span>
                  </span>
                  <button className="cancel-btn" onClick={() => cancelOrder(o.id)}>
                    Cancel
                  </button>
                </div>
              ))}
              {(orders?.events || []).length > 0 && (
                <>
                  <h4 className="panel-sub">Order updates</h4>
                  {orders.events.slice(0, 4).map((e, i) => (
                    <p key={`${e.time}-${i}`} className="note-small">
                      {e.time}: {e.text}
                    </p>
                  ))}
                </>
              )}
            </div>
          )}

          <div className="trade-card company-card">
            <h3>About the company</h3>
            <p>{stock.company.desc}</p>
            {learning && (
              <p className="note-small">
                Made-up company, loosely inspired by {stock.company.inspired}.
              </p>
            )}
            <div className="company-grid">
              <div>
                <span>P/E ratio</span>
                <strong>{stock.company.pe.toFixed(1)}</strong>
              </div>
              <div>
                <span>Earnings per share</span>
                <strong>₹{stock.company.eps.toFixed(2)}</strong>
              </div>
              <div>
                <span>Net profit</span>
                <strong>₹{Math.round(stock.company.profitCr).toLocaleString("en-IN")} cr</strong>
              </div>
              <div>
                <span>Revenue</span>
                <strong>₹{Math.round(stock.company.revenueCr).toLocaleString("en-IN")} cr</strong>
              </div>
              <div>
                <span>Profit margin</span>
                <strong>{stock.company.margin.toFixed(0)}%</strong>
              </div>
              <div>
                <span>Dividend yield</span>
                <strong>{stock.company.divYield.toFixed(1)}%</strong>
              </div>
              <div>
                <span>Founded</span>
                <strong>{stock.company.founded}</strong>
              </div>
              <div>
                <span>Headquarters</span>
                <strong>{stock.company.hq}</strong>
              </div>
            </div>
            {stock.company.last ? (
              <p>
                <strong>Latest results ({stock.company.last.time}):</strong>{" "}
                profit {stock.company.last.growth >= 0 ? "up" : "down"}{" "}
                {Math.abs(stock.company.last.growth).toFixed(1)}%, which{" "}
                {stock.company.last.surprise >= 0 ? "beat" : "missed"} what
                analysts expected by{" "}
                {Math.abs(stock.company.last.surprise).toFixed(1)}%.
              </p>
            ) : (
              <p className="note-small">
                No results published yet. Companies report every few hours of
                trading, and the price often jumps when they do.
              </p>
            )}
            <p className="note-small">
              P/E is the price divided by earnings per share: how many rupees
              investors pay for each rupee of yearly profit. Everything here is
              invented for practice.
            </p>
          </div>
        </div>

        {learning ? (
          <aside className="note">
            <h3>About this price</h3>

            <div className="note-row">
              <span>Base value</span>
              <strong>₹{base.toFixed(2)}</strong>
            </div>
            <p className="note-small">The price when the server started</p>

            <div className="note-row">
              <span>Distance from base</span>
              <strong className={stock.change >= 0 ? "up" : "down"}>
                {stock.change >= 0 ? "+" : ""}
                {stock.change.toFixed(2)}%
              </strong>
            </div>
            <p className="note-small">
              A price can sit below its base value for a long time. Nothing
              pulls it back, it only moves when more people sell than buy.
            </p>

            <div className="note-row">
              <span>Sector</span>
              <strong>{stock.sector}</strong>
            </div>
            <div className="note-row">
              <span>Market mood</span>
              <strong>{MODE_NAMES[mode]}</strong>
            </div>

            <hr />

            <h4>Why did it move?</h4>
            <p className="note-small">The last 2-second tick, split by cause:</p>

            <div className="note-row">
              <span>Market mood</span>
              <strong className={parts.market >= 0 ? "up" : "down"}>
                {pct(parts.market)}
              </strong>
            </div>
            <div className="note-row">
              <span>{stock.sector} sector</span>
              <strong className={parts.sector >= 0 ? "up" : "down"}>
                {pct(parts.sector)}
              </strong>
            </div>
            <div className="note-row">
              <span>Other sectors</span>
              <strong className={parts.spill >= 0 ? "up" : "down"}>
                {pct(parts.spill)}
              </strong>
            </div>
            <div className="note-row">
              <span>Random noise</span>
              <strong className={parts.noise >= 0 ? "up" : "down"}>
                {pct(parts.noise)}
              </strong>
            </div>
            <div className="note-row">
              <span>Company results</span>
              <strong className={(parts.earnings || 0) >= 0 ? "up" : "down"}>
                {pct(parts.earnings || 0)}
              </strong>
            </div>
            <div className="note-row">
              <span>Order flow (bots)</span>
              <strong className={parts.flow >= 0 ? "up" : "down"}>
                {pct(parts.flow)}
              </strong>
            </div>
            <div className="note-row">
              <span>Your orders</span>
              <strong className={parts.you >= 0 ? "up" : "down"}>
                {pct(parts.you)}
              </strong>
            </div>
            <div className="note-row total-row">
              <span>Total move</span>
              <strong className={stock.lastMove >= 0 ? "up" : "down"}>
                {pct(stock.lastMove)}
              </strong>
            </div>

            <code>
              fair value moves by: sector beta × mood + momentum + spillover +
              noise + company results. The traded price then follows the order book.
            </code>
            <p className="note-small">
              The "fair value" is what market makers think the stock is worth.
              Bots and users buy and sell around it, and the price is the price
              of the last trade. Some sectors follow the market harder (AI),
              others move against it (Defense), and news in one sector can push
              a related sector the other way (AI falls, Semiconductors rise).
            </p>

            <hr />
            <h4>Order book</h4>
            <div className="book">
              {shownAsks.map(bookRow("ask"))}
              <div className="book-mid">
                {stock.price.toFixed(2)}
                {spread !== null && (
                  <span className="note-small"> spread {spread.toFixed(2)}</span>
                )}
              </div>
              {shownBids.map(bookRow("bid"))}
            </div>
            <p className="note-small">
              Price and shares waiting. Red are people selling (asks), green are
              people buying (bids).
            </p>

            <h4>Recent trades</h4>
            {tape.length === 0 ? (
              <p className="note-small">No trades yet.</p>
            ) : (
              tape.slice(0, 6).map((t, i) => (
                <div key={`${t.time}-${i}`} className="trade-line">
                  <span className={t.side === "buy" ? "up" : "down"}>
                    {t.side === "buy" ? "Bought" : "Sold"}
                  </span>{" "}
                  {t.qty} at {t.price.toFixed(2)}{" "}
                  <span className="note-small">{t.who}</span>
                </div>
              ))
            )}
          </aside>
        ) : (
          <aside className="note">
            <h3>Stock info</h3>

            <div className="note-row">
              <span>Sector</span>
              <strong>{stock.sector}</strong>
            </div>
            <div className="note-row">
              <span>Previous close</span>
              <strong>₹{stock.prevClose.toFixed(2)}</strong>
            </div>
            <div className="note-row">
              <span>Open</span>
              <strong>₹{stock.dayOpen.toFixed(2)}</strong>
            </div>
            <div className="note-row">
              <span>Day high</span>
              <strong>₹{stock.dayHigh.toFixed(2)}</strong>
            </div>
            <div className="note-row">
              <span>Day low</span>
              <strong>₹{stock.dayLow.toFixed(2)}</strong>
            </div>
            <div className="note-row">
              <span>Volume</span>
              <strong>{stock.volume.toLocaleString("en-IN")}</strong>
            </div>
            <div className="note-row">
              <span>Market cap</span>
              <strong>₹{Math.round(stock.marketCap).toLocaleString("en-IN")} cr</strong>
            </div>


            <hr />
            <h4>Order book</h4>
            <div className="book">
              {shownAsks.map(bookRow("ask"))}
              <div className="book-mid">
                {stock.price.toFixed(2)}
                {spread !== null && (
                  <span className="note-small"> spread {spread.toFixed(2)}</span>
                )}
              </div>
              {shownBids.map(bookRow("bid"))}
            </div>
            <p className="note-small">
              Price and shares waiting. Red are people selling (asks), green are
              people buying (bids).
            </p>

            <hr />

            <p className="note-small">
              Practice platform: prices are simulated and the money is not
              real.
            </p>
          </aside>
        )}
      </div>
    </div>
  );
}

export default StockDetail;
