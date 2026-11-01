import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { API } from "../config";


// ---------- numbers copied from the server code, shown in the tables below ----------
const MOODS = [
  ["Upward trend (bull)", "+0.12%", "0.20%", "0.8x", "1.2x", "0", "0.15"],
  ["General", "0%", "0.20%", "1.0x", "1.0x", "0", "0"],
  ["Correction", "-0.06%", "0.30%", "1.5x", "0.8x", "0.25", "0"],
  ["Crash", "-0.15%", "0.40%", "3.0x", "0.4x", "0.8", "0"],
  ["Recovery", "+0.10%", "0.35%", "1.3x", "0.8x", "0", "0.3"],
  ["Bubble", "+0.22%", "0.30%", "1.1x", "0.7x", "0", "0.7"],
];

const SECTORS = [
  ["AI", "1.5", "Exaggerates the mood. Falls hardest in a crash."],
  ["Semiconductors", "1.2", "Follows the mood strongly."],
  ["Finance", "1.1", "Moves almost with the market."],
  ["Consumer", "0.5", "Half the market's move. A defensive sector."],
  ["Healthcare", "0.3", "Hardly reacts to the mood."],
  ["Defense", "-0.3", "Moves against the market: a small gain in a crash."],
];

const BOTS = [
  {
    name: "Retail traders",
    key: "noise",
    when: "Every tick, in every mood.",
    rule: "Sends one small order, buy or sell with equal chance. Size = |random number| x 0.15 x liquidity (at least 1 share).",
    effect: "Keeps the market alive. There is always some trade, and prices wiggle a little even when nothing happens.",
    real: "Millions of ordinary people each making their own small decisions for their own reasons. Their orders mostly cancel out.",
    lesson: "Randomness is part of every price. Not every move has a story.",
  },
  {
    name: "Arbitrage desk",
    key: "arb",
    when: "When the last traded price is further than the half-spread away from fair value.",
    rule: "Buys if the price is below fair value, sells if above. Size = min(gap x 80, 2) x 0.5 x liquidity, where gap is the percentage distance from fair value.",
    effect: "Pulls the price back toward fair value. After a big order pushes the price away, this bot is what makes it drift back.",
    real: "Professional firms that spot a price that is out of line (between two exchanges, or between a share and its futures) and trade it back into line, earning a tiny profit each time.",
    lesson: "This is why real prices do not wander far from what the news justifies for long.",
  },
  {
    name: "Value investors",
    key: "dip",
    when: "When the price is more than 0.2% below fair value.",
    rule: "Buys only, never sells. Size = min(gap x 100, 1.5) x 0.5 x liquidity.",
    effect: "Catches falling prices. The cheaper the stock is compared with fair value, the harder they buy, which slows drops.",
    real: "Long-term investors and funds that buy good companies when they look cheap and wait.",
    lesson: "Falls rarely go on forever, because someone always sees a bargain. But in a crash, panic sellers can overwhelm them for a while.",
  },
  {
    name: "Momentum funds",
    key: "trend",
    when: "When the price has moved more than 0.1% over the last 10 ticks (20 seconds).",
    rule: "Follows the direction: buys if rising, sells if falling. Size = min(|move| x 40, 1) x 0.6 x liquidity.",
    effect: "Turns small moves into bigger ones. A rise attracts buying that makes it rise further, until the move runs out of steam.",
    real: "Trend-following funds and day traders who believe what went up will keep going up (and the reverse).",
    lesson: "Trends can feed on themselves and overshoot, which is one reason prices briefly go further than fair value.",
  },
  {
    name: "Panic sellers",
    key: "panic",
    when: "Only in Correction (strength 0.25) and Crash (strength 0.8).",
    rule: "Sells every tick, whatever the price. Size = strength x (0.5 to 1.0) x liquidity.",
    effect: "Steady, price-blind selling. It drives prices down, thins the book and lets the spread widen, which scares more sellers.",
    real: "People who sell out of fear, and forced sellers such as investors whose borrowed money is being called back (margin calls).",
    lesson: "Most of the damage in a crash comes from selling that does not care about value. It is also when bargains appear.",
  },
  {
    name: "FOMO buyers",
    key: "fomo",
    when: "In Upward trend (0.15), Recovery (0.3) and Bubble (0.7).",
    rule: "Buys every tick, whatever the price. Size = strength x (0.5 to 1.0) x liquidity.",
    effect: "Price-blind buying that lifts prices further. In a bubble it is strong enough to push prices far above fair value.",
    real: "Beginners and excited investors who buy because everyone else is making money. FOMO stands for fear of missing out.",
    lesson: "The buyers who arrive last pay the most. A bubble ends when they run out.",
  },
];

// Same formulas as server/fees.js, so the example below matches what you are charged.
function chargesFor(side, value) {
  const brokerage = Math.min(20, value * 0.0003);
  const stt = value * 0.001;
  const exchange = value * 0.0000307 + value * 0.000001;
  const gst = (brokerage + value * 0.0000307 + value * 0.000001) * 0.18;
  const stamp = side === "buy" ? value * 0.00015 : 0;
  return { brokerage, stt, exchange, gst, stamp, total: brokerage + stt + exchange + gst + stamp };
}

const SIZES = [1000, 10000, 100000, 1000000, 10000000];
const REAL_LIST = [
  ["RELIANCE.NS", "Reliance Industries"],
  ["TCS.NS", "Tata Consultancy Services"],
  ["INFY.NS", "Infosys"],
  ["HDFCBANK.NS", "HDFC Bank"],
  ["ITC.NS", "ITC"],
  ["SBIN.NS", "State Bank of India"],
];

const rupees = (v) =>
  v >= 1e7
    ? `₹${v / 1e7} crore`
    : v >= 1e5
      ? `₹${v / 1e5} lakh`
      : `₹${v.toLocaleString("en-IN")}`;

const pctText = (v) => (v === null || v === undefined ? "n/a" : `${v.toFixed(v < 0.01 ? 4 : 3)}%`);

// the chart gets one extra dashed point: where the price would be after your order
function withAfter(points, afterPrice) {
  if (!points || points.length === 0) return [];
  const data = points.map((p) => ({ time: p.time, price: p.price }));
  const last = data[data.length - 1];
  data[data.length - 1] = { ...last, after: last.price };
  if (afterPrice !== null && afterPrice !== undefined) {
    data.push({ time: "after your order", after: afterPrice });
  }
  return data;
}

function LiveComparison({ stocks }) {
  const [fakeSymbol, setFakeSymbol] = useState("HelloKitty");
  const [ticker, setTicker] = useState("RELIANCE.NS");
  const [side, setSide] = useState("buy");
  const [size, setSize] = useState(100000);
  const [realRaw, setReal] = useState(null);
  const [errState, setRealError] = useState(null);
  const [fakeImpacts, setFakeImpacts] = useState({});

  // the latest stocks, for the timer below (updated after each render, not during it)
  const stocksRef = useRef(stocks);
  useEffect(() => {
    stocksRef.current = stocks;
  });
  // only show data that belongs to the stock chosen right now
  const real = realRaw && realRaw.ticker === ticker ? realRaw : null;
  const realError = errState && errState.ticker === ticker ? errState.msg : "";
  const fake = stocks.find((s) => s.symbol === fakeSymbol) || stocks[0];

  // Real stock: refresh every 30 seconds
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`${API}/api/real/${ticker}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.ok) {
          setReal(data);
          setRealError(null);
        } else {
          setRealError({ ticker, msg: data.error || "Could not load the real stock." });
        }
      } catch {
        if (!cancelled) setRealError({ ticker, msg: "Could not reach the server." });
      }
    }
    load();
    const timer = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [ticker]);

  // Fake stock: ask the real order book what each order size would do, every 5 seconds
  useEffect(() => {
    let cancelled = false;
    async function run() {
      const stock = stocksRef.current.find((s) => s.symbol === fakeSymbol);
      if (!stock) return;
      const out = {};
      await Promise.all(
        SIZES.map(async (value) => {
          const qty = Math.max(1, Math.round(value / stock.price));
          try {
            const res = await fetch(
              `${API}/api/preview?symbol=${fakeSymbol}&side=${side}&qty=${qty}`
            );
            const r = await res.json();
            out[value] = r.ok ? { impact: r.impactPct } : { short: true };
          } catch {
            // leave it empty
          }
        })
      );
      if (!cancelled) setFakeImpacts(out);
    }
    run();
    const timer = setInterval(run, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [fakeSymbol, side]);

  // Real stock: square-root rule of thumb for market impact
  //   impact % = daily volatility x sqrt(shares in the order / average daily volume) x 100
  const realImpact = (value) => {
    if (!real || !real.avgVolume || !real.sigma || !real.price) return null;
    const qty = value / real.price;
    const impact = 100 * real.sigma * Math.sqrt(qty / real.avgVolume);
    return side === "buy" ? impact : -impact;
  };

  const fakeNow = fakeImpacts[size];
  const realNow = realImpact(size);
  const fakeAfter =
    fake && fakeNow && !fakeNow.short ? fake.price * (1 + fakeNow.impact / 100) : null;
  const realAfter = real && realNow !== null ? real.price * (1 + realNow / 100) : null;

  const barMax = Math.max(Math.abs(fakeNow?.impact || 0), Math.abs(realNow || 0), 1e-9);
  const bar = (v) => `${Math.max(1, (Math.abs(v || 0) / barMax) * 100)}%`;

  const lineColor = side === "buy" ? "#16a34a" : "#dc2626";

  return (
    <section className="doc-text" id="live">
      <h3>Live comparison: this platform versus a real stock</h3>
      <p>
        Left: a made-up stock on this platform, live. Right: a real Indian stock
        with the latest data from the internet, refreshed every 30 seconds.
        Pick an order size and see what the same order does to each.
      </p>

      <div className="compare-controls">
        <label>
          Made-up stock
          <select value={fakeSymbol} onChange={(e) => setFakeSymbol(e.target.value)}>
            {stocks.map((s) => (
              <option key={s.symbol} value={s.symbol}>
                {s.symbol}
              </option>
            ))}
          </select>
        </label>
        <label>
          Real stock
          <select value={ticker} onChange={(e) => setTicker(e.target.value)}>
            {REAL_LIST.map(([t, n]) => (
              <option key={t} value={t}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          Order
          <select value={side} onChange={(e) => setSide(e.target.value)}>
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </select>
        </label>
        <label>
          Order size
          <select value={size} onChange={(e) => setSize(Number(e.target.value))}>
            {SIZES.map((v) => (
              <option key={v} value={v}>
                {rupees(v)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="compare-grid">
        <div>
          <h4>
            {fake ? `${fake.symbol}: ₹${fake.price.toFixed(2)}` : "Made-up stock"}
          </h4>
          <p className="note-small">Simulated, updates every 2 seconds</p>
          <div className="compare-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={withAfter(fake?.history, fakeAfter)}>
                <XAxis dataKey="time" hide />
                <YAxis domain={["auto", "auto"]} width={60} tickFormatter={(v) => v.toFixed(0)} />
                <Tooltip formatter={(v) => `₹${Number(v).toFixed(2)}`} />
                <Line type="monotone" dataKey="price" stroke="#D362A4" dot={false} isAnimationActive={false} />
                <Line type="linear" dataKey="after" stroke={lineColor} strokeDasharray="4 3" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h4>
            {real ? `${real.name}: ₹${real.price?.toFixed(2)}` : "Real stock"}
          </h4>
          {real && (
            <p className="note-small">
              Last price time {real.marketTime || "n/a"} IST. Fetched at{" "}
              {real.fetchedAt}.{real.stale ? " (Showing older data: the refresh failed.)" : ""}
            </p>
          )}
          {!real && !realError && <p className="note-small">Loading live data...</p>}
          {realError && <p className="trade-msg down">{realError}</p>}
          {real && (
            <div className="compare-chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={withAfter(real.points, realAfter)}>
                  <XAxis dataKey="time" hide />
                  <YAxis domain={["auto", "auto"]} width={60} tickFormatter={(v) => v.toFixed(0)} />
                  <Tooltip formatter={(v) => `₹${Number(v).toFixed(2)}`} />
                  <Line type="monotone" dataKey="price" stroke="#FF9A56" dot={false} isAnimationActive={false} />
                  <Line type="linear" dataKey="after" stroke={lineColor} strokeDasharray="4 3" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <p className="note-small">
        The dashed line is where the price would end up right after your{" "}
        {side} of {rupees(size)}. On the made-up stock it is a visible jump. On
        the real stock it is so small you can barely see it.
      </p>

      <div className="impact-bars">
        <div>
          <span>Made-up stock</span>
          <div className="bar-track">
            <div className="bar-fill fake" style={{ width: bar(fakeNow?.impact) }} />
          </div>
          <strong>
            {fakeNow
              ? fakeNow.short
                ? "order too big for this stock"
                : pctText(fakeNow.impact)
              : "..."}
          </strong>
        </div>
        <div>
          <span>Real stock</span>
          <div className="bar-track">
            <div className="bar-fill real" style={{ width: bar(realNow) }} />
          </div>
          <strong>{realNow === null ? "..." : pctText(realNow)}</strong>
        </div>
      </div>

      <h4>The same order at every size</h4>
      <div className="scroll-x">
        <table className="how-table">
          <thead>
            <tr>
              <th>Order ({side})</th>
              <th>Made-up stock moves</th>
              <th>Real stock moves (estimate)</th>
              <th>Made-up is exaggerated by</th>
            </tr>
          </thead>
          <tbody>
            {SIZES.map((v) => {
              const f = fakeImpacts[v];
              const r = realImpact(v);
              const ratio =
                f && !f.short && r !== null && Math.abs(r) > 0
                  ? Math.abs(f.impact) / Math.abs(r)
                  : null;
              return (
                <tr key={v} className={v === size ? "row-highlight" : ""}>
                  <td>{rupees(v)}</td>
                  <td>{f ? (f.short ? "too big: not enough shares in the book" : pctText(f.impact)) : "..."}</td>
                  <td>{r === null ? "..." : pctText(r)}</td>
                  <td>{ratio === null ? "n/a" : `about ${Math.round(ratio).toLocaleString("en-IN")} times`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {real && (
        <p className="note-small">
          How the real estimate is made: average daily volume over the last
          month is {real.avgVolume ? Math.round(real.avgVolume).toLocaleString("en-IN") : "n/a"}{" "}
          shares, and the typical daily price swing (volatility) is{" "}
          {real.sigma ? (real.sigma * 100).toFixed(2) : "n/a"}% (from {real.days} trading
          days). Impact = volatility x square root of (order shares / daily volume).
          This is a standard rule of thumb used by professionals. It gives the right
          size of answer, not an exact one.
        </p>
      )}

      <p className="note-small">
        Data source: {real ? real.source : "Yahoo Finance (unofficial)"}. Google
        Finance does not offer a public data feed, so this platform asks Yahoo
        Finance instead. Nothing here is advice and the feed can stop working at
        any time.
      </p>

      <h4>Why is this platform so much more sensitive?</h4>
      <ul>
        <li>
          <strong>Small stocks.</strong> Each made-up stock needs only about
          ₹20,000 to ₹65,000 of trading to move 1%. A big real company trades
          thousands of crores every day, so a normal order is a drop in the
          ocean.
        </li>
        <li>
          <strong>Few traders.</strong> Here, six bots and a handful of users
          are the whole market. In reality there are millions of participants
          and thousands of professional firms constantly offering to buy and
          sell.
        </li>
        <li>
          <strong>On purpose.</strong> If real-sized effects were used, you
          would never see your own order do anything, and the point of the
          platform (to see cause and effect) would be lost. The exaggeration is a
          teaching magnifier.
        </li>
        <li>
          <strong>Where it is true in real life.</strong> The exaggerated
          behavior is realistic for small, thinly traded stocks, and for any
          stock in a panic when buyers disappear. That is why small-cap stocks
          can move wildly on small volumes.
        </li>
      </ul>
    </section>
  );
}

const VALUATION_ROWS = [
  [
    "What decides the price",
    "The price of the last trade. There is no formula that outputs a real stock's price. Millions of people hold different opinions and the market settles on a price where buyers and sellers meet.",
    "Same idea: the price is the last trade on the order book. Behind it sits a hidden fair value that follows a formula (drift + randomness), because there is no real crowd to form an opinion.",
  ],
  [
    "How people estimate what a stock is worth",
    "Valuation models give an estimate, not the price. Multiples: price = EPS x P/E. Discounted cash flow: value = sum of future cash / (1 + r)^t. Dividend model: price = next dividend / (required return - growth). Traders argue about the inputs, and that argument is what moves prices.",
    "Not used to set the price. EPS and P/E are shown as company facts, and results nudge fair value (see section 7).",
  ],
  [
    "How price movement is modelled",
    "The textbook model is geometric Brownian motion: each step the price is multiplied by (1 + drift + volatility x random number). Real prices also have sudden jumps, volatility that clusters, and fatter tails than this model allows.",
    "Fair value is multiplied by (1 + beta x mood drift + noise + ...), which is very close to that textbook model. The order book then adds realistic short-term jumpiness on top.",
  ],
  [
    "Beta",
    "Beta measures how strongly a stock follows the market, found by comparing its past returns with an index's. The CAPM formula says expected return = risk-free rate + beta x (market return - risk-free rate). Most big companies sit between 0.5 and 1.5.",
    "Sector betas are set by hand (AI 1.5, Defense -0.3) and multiply the mood return. Real betas are measured from history, and they are rarely negative.",
  ],
  [
    "Where company numbers fit",
    "Profits, growth and the outlook shape what traders are willing to pay, so they drive prices indirectly, mostly through expectations about the future.",
    "A company's price is not computed from its profit. Results only add a one-off push of about half the surprise. P/E is simply price / EPS and drifts as the price moves.",
  ],
];

function ValuationAndIndices({ stocks, indices }) {
  const totalCap = stocks.reduce((sum, s) => sum + s.price * s.shares, 0);
  const totalProfit = stocks.reduce((sum, s) => sum + s.company.eps * s.shares, 0);
  const marketPE = totalProfit > 0 ? totalCap / totalProfit : null;

  const sectors = {};
  for (const s of stocks) {
    const g = (sectors[s.sector] = sectors[s.sector] || { cap: 0, profit: 0, n: 0 });
    g.cap += s.price * s.shares;
    g.profit += s.company.eps * s.shares;
    g.n += 1;
  }

  return (
    <section className="doc-text" id="valuation">
      <h3>2. Valuation and index math, compared with the real thing</h3>

      <div className="advisory">
        <strong>Short answer.</strong> There is no formula in real life that
        produces a stock's price. Valuation formulas estimate what a stock{" "}
        <em>should</em> be worth, and the market price is whatever people
        actually trade at. An index, on the other hand, <em>is</em> a precise
        formula, and this platform uses nearly the same one as the real Nifty
        and Sensex.
      </div>

      <h4>A. Stock valuation</h4>
      <div className="scroll-x">
        <table className="how-table">
          <thead>
            <tr><th>Topic</th><th>In a real market</th><th>On this platform</th></tr>
          </thead>
          <tbody>
            {VALUATION_ROWS.map((r) => (
              <tr key={r[0]}>
                <td><strong>{r[0]}</strong></td>
                <td>{r[1]}</td>
                <td>{r[2]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Worked example: Kuromi starts with earnings per share of about ₹48.5
        and a P/E of 85, so price = 48.5 x 85, about ₹4,121. If it reports
        profit up 10% (EPS ₹53.3) and the price reacts by +4% (₹4,286), the P/E
        falls to about 80. A real investor would then ask whether 80 times
        earnings is still fair, and that question is the whole game of
        valuation.
      </p>

      <h4>B. Index valuation (how Nifty, Sensex and our versions are calculated)</h4>
      <div className="scroll-x">
        <table className="how-table">
          <thead>
            <tr><th></th><th>Real Nifty 50 and Sensex</th><th>SANRIO 18 and KITTY 6 here</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Formula</strong></td>
              <td>base value x (free-float market cap now / base market cap)</td>
              <td>1000 x (market cap now / market cap at the start)</td>
            </tr>
            <tr>
              <td><strong>Weights</strong></td>
              <td>Free-float market cap: only shares the public can actually trade (promoter and government holdings are excluded). Weights of the biggest companies are capped.</td>
              <td>Full market cap (price x all shares). No caps.</td>
            </tr>
            <tr>
              <td><strong>Base</strong></td>
              <td>Nifty: 1,000 on 3 Nov 1995. Sensex: 100 for 1978-79.</td>
              <td>1,000 when the server starts.</td>
            </tr>
            <tr>
              <td><strong>Members</strong></td>
              <td>50 (Nifty) and 30 (Sensex) companies, reviewed twice a year. Companies are added and removed.</td>
              <td>Fixed: all 18 stocks, and the 6 biggest.</td>
            </tr>
            <tr>
              <td><strong>Splits, new listings</strong></td>
              <td>The base market cap (the divisor) is adjusted so the index does not jump just because a share was split or a company joined.</td>
              <td>Not needed, because nothing like that happens here.</td>
            </tr>
            <tr>
              <td><strong>Dividends</strong></td>
              <td>The headline index tracks price only. A separate total-return version adds dividends.</td>
              <td>Price only.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p>
        Worked example, two stocks. A: price ₹100, 10 shares (cap ₹1,000). B:
        price ₹50, 40 shares (cap ₹2,000). Starting cap is ₹3,000, index 1,000.
        Then A rises 10% to ₹110 and B falls 2% to ₹49. New cap = 1,100 + 1,960
        = ₹3,060, so the index = 1000 x 3,060 / 3,000 = 1,020, up 2%. A gained
        more in percent, but B is twice as big, so B's fall pulls harder.
      </p>

      <h4>C. Valuing the whole market: index P/E</h4>
      <p>
        The same idea as a stock's P/E works for an index: total market cap
        divided by total yearly profit of its companies. It says how expensive
        the market is as a whole. The real Nifty 50's P/E has mostly sat in the
        20s in recent years (check NSE for today's figure).
      </p>

      <div className="scroll-x">
        <table className="how-table">
          <thead>
            <tr><th>Index</th><th>Value now</th><th>Today</th><th>Since server start</th><th>Biggest weight</th></tr>
          </thead>
          <tbody>
            {indices.map((ix) => (
              <tr key={ix.id}>
                <td><strong>{ix.name}</strong></td>
                <td>{ix.value.toFixed(2)}</td>
                <td className={ix.change >= 0 ? "up" : "down"}>
                  {ix.change >= 0 ? "+" : ""}
                  {ix.change.toFixed(2)}%
                </td>
                <td className={ix.sinceStart >= 0 ? "up" : "down"}>
                  {ix.sinceStart >= 0 ? "+" : ""}
                  {ix.sinceStart.toFixed(2)}%
                </td>
                <td>{ix.top ? `${ix.top.symbol} (${ix.top.weight.toFixed(0)}%)` : "n/a"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="scroll-x">
        <table className="how-table">
          <thead>
            <tr><th>Group</th><th>Stocks</th><th>P/E right now</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>All stocks (SANRIO 18)</strong></td>
              <td>{stocks.length}</td>
              <td>{marketPE ? marketPE.toFixed(1) : "n/a"}</td>
            </tr>
            {Object.entries(sectors).map(([name, g]) => (
              <tr key={name}>
                <td>{name}</td>
                <td>{g.n}</td>
                <td>{(g.cap / g.profit).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note-small">
        A high P/E, like AI here, means investors are paying a lot for expected
        growth. A low one, like Finance, means they expect slower growth or see
        more risk. Real sectors look similar: technology usually trades at a
        higher P/E than banks.
      </p>
    </section>
  );
}

function Developers({ stocks, indices = [] }) {
  const sample = chargesFor("buy", 10000);
  const sampleSell = chargesFor("sell", 10000);

  return (
    <div className="app wide">
      <Link to="/">← Back to market</Link>
      <h1>Developers: the math behind this platform</h1>
      <p>
        This page explains every formula the platform uses and compares it with
        how real markets work. Numbers are copied from the server code, so what
        you read here is what actually runs.
      </p>

      <div className="toc">
        <a href="#live">Live comparison</a>
        <a href="#price">How a price is set</a>
        <a href="#valuation">Valuation and indices</a>
        <a href="#book">Order book</a>
        <a href="#bots">The bots</a>
        <a href="#fees">Charges and tax</a>
        <a href="#breakers">Circuit breakers</a>
        <a href="#company">Company data</a>
        <a href="#hours">Market hours</a>
        <a href="#reality">Real rules vs here</a>
      </div>

      {stocks.length > 0 && <LiveComparison stocks={stocks} />}

      <section className="doc-text" id="price">
      <h3>1. How a price is set (every 2 seconds)</h3>
        <p>
          Each stock has a hidden <strong>fair value</strong>: what the mood and
          news say it should be worth. Every tick the formula moves it:
        </p>
        <code className="block">
          fair value x (1 + sector beta x market return + sector momentum +
          spillover + noise + company results)
        </code>
        <ul>
          <li>
            <strong>Market return</strong> = mood drift + a random number x mood
            volatility (table below).
          </li>
          <li>
            <strong>Sector beta</strong> says how hard a sector follows the mood.
          </li>
          <li>
            <strong>Sector momentum</strong> carries 80% of the last tick and
            adds a small random push. News events add a big push to one sector.
          </li>
          <li>
            <strong>Spillover</strong> is how one sector's move affects another
            (AI falls, Semiconductors get a push the other way).
          </li>
          <li>
            <strong>Noise</strong> is a small random number (0.2% typical size).
          </li>
        </ul>
        <p>
          Worked example, in a crash: Kuromi (AI, beta 1.5). Market drift is
          -0.15% per tick, so its mood part is 1.5 x -0.15% = -0.225% per tick.
          Over one minute (30 ticks) that compounds to about -6.5%. Defense (beta
          -0.3) would gain 0.045% per tick in the same minute.
        </p>

        <div className="scroll-x">
          <table className="how-table">
            <thead>
              <tr>
                <th>Mood</th>
                <th>Drift per tick</th>
                <th>Volatility</th>
                <th>Spread</th>
                <th>Book depth</th>
                <th>Panic sellers</th>
                <th>FOMO buyers</th>
              </tr>
            </thead>
            <tbody>
              {MOODS.map((m) => (
                <tr key={m[0]}>
                  {m.map((cell, i) => (
                    <td key={i}>{i === 0 ? <strong>{cell}</strong> : cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="scroll-x">
          <table className="how-table">
            <thead>
              <tr>
                <th>Sector</th>
                <th>Beta</th>
                <th>Meaning</th>
              </tr>
            </thead>
            <tbody>
              {SECTORS.map((s) => (
                <tr key={s[0]}>
                  <td><strong>{s[0]}</strong></td>
                  <td>{s[1]}</td>
                  <td>{s[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h4>Compared with a real market</h4>
        <p>
          In reality nobody applies a formula to a price. Prices come from real
          orders, and the mood is the result of millions of decisions. Here the
          mood is a dial you can turn, to let you watch what a crash or a bubble
          does without waiting years for one. A real large company usually moves
          about 1% in a normal day. The moods here are heavily sped up: a crash
          that takes real markets weeks happens here in minutes, and the circuit
          breakers step in the way they would in real life.
        </p>
        <p>
          Changing the mood does not jump prices. It changes the push, and the
          effect builds as ticks pass. A visible crash needs a minute or two.
        </p>
      </section>

      {stocks.length > 0 && <ValuationAndIndices stocks={stocks} indices={indices} />}

      <section className="doc-text" id="book">
      <h3>3. The order book and your order</h3>
        <p>
          The visible price is the price of the <strong>last trade</strong>.
          Around fair value, market makers post waiting orders on both sides:
        </p>
        <code className="block">
          ask levels start at fair x (1 + half spread) and rise by about 0.1% each
          level; bid levels start at fair x (1 - half spread) and fall the same
          way. half spread = 0.05% x mood multiplier
        </code>
        <code className="block">
          money waiting at level k = liquidity x 0.25 x depth multiplier x (1 + 0.1 k) x random(0.7 to 1.3)
        </code>
        <p>
          Liquidity is the amount of trading (in rupees) that moves a stock about
          1% in a normal market. A level deeper in the book holds a bit more.
          There are 20 levels each side, and the market makers cancel and repost
          everything every tick.
        </p>
        <h4>What your order does</h4>
        <ol>
          <li>
            A buy eats sell orders from the lowest price upward until your
            quantity is filled. A sell eats buy orders from the highest price
            downward.
          </li>
          <li>
            You pay (or receive) the <strong>average</strong> of the prices you
            ate. This is the slippage.
          </li>
          <li>
            The last trade price becomes the new price for everyone, so your
            order moves the price from <em>last price</em> to the <em>last level
            you ate</em>.
          </li>
          <li>
            About 30% of that move stays in fair value (an order carries
            information). The other 70% fades as market makers repost and the
            arbitrage desk pulls the price back.
          </li>
          <li>
            If the book has fewer shares than you asked for, the order is
            rejected.
          </li>
        </ol>
        <p>
          Example: HelloKitty has liquidity ₹60,000, so in a general market the
          first level holds about ₹15,000. A ₹10,000 buy fits inside one level and
          costs you the spread. A ₹1 lakh buy eats about six levels, so you pay
          about 0.3% above the quote on average and the price ends about 0.6%
          higher. In a crash the book is 0.4x as deep and the spread 3x as wide, so
          the same order moves the price much more. The live table above shows the
          real numbers right now.
        </p>
        <h4>Compared with a real market</h4>
        <p>
          Real order books work the same way (this is how an exchange matches
          orders) but are thousands of times deeper for big companies, and there
          are many more levels. A real exchange also has hidden orders, order
          types such as iceberg orders, and trades across several venues.
        </p>
      </section>

      <section className="doc-text" id="bots">
      <h3>4. The bots, one by one</h3>
        <p>
          Every tick, every stock gets a round of orders from the bots below, in
          random order. Their sizes are a share of the stock's liquidity, so a bot
          moves a small company more than a big one. Together with the market
          makers they stand in for the crowd of a real market.
        </p>
        <h4>The market makers (the book itself)</h4>
        <p>
          Not a trader but the reason there is something to trade against. Every
          tick they post buy and sell orders around fair value. They earn the
          spread, and in a crash they get scared: wider spread (3x), less depth
          (0.4x). In real markets, designated market makers and high-frequency
          firms play this role, and when they pull back in a panic, prices gap.
        </p>
        {BOTS.map((b) => (
          <details key={b.key} className="case-item" open>
            <summary>
              <strong>{b.name}</strong>
            </summary>
            <table className="how-table">
              <tbody>
                <tr><td><strong>When it acts</strong></td><td>{b.when}</td></tr>
                <tr><td><strong>What it does</strong></td><td>{b.rule}</td></tr>
                <tr><td><strong>Effect on the price</strong></td><td>{b.effect}</td></tr>
                <tr><td><strong>Real-world version</strong></td><td>{b.real}</td></tr>
                <tr><td><strong>What it teaches</strong></td><td>{b.lesson}</td></tr>
              </tbody>
            </table>
          </details>
        ))}
        <p className="note-small">
          In Learning mode the main page shows a live "Who is trading" feed, and
          the stock page splits each move into market mood, sector, results, bot
          order flow and your own orders.
        </p>
      </section>

      <section className="doc-text" id="fees">
      <h3>5. Charges and tax (fake)</h3>
        <p>
          Every real trade has costs, so every trade here does too. The rates are
          modelled on Indian delivery trades but simplified, and the money is
          fake.
        </p>
        <div className="scroll-x">
          <table className="how-table">
            <thead>
              <tr><th>Charge</th><th>How it is worked out</th><th>On a ₹10,000 buy</th><th>On a ₹10,000 sell</th></tr>
            </thead>
            <tbody>
              <tr><td>Brokerage</td><td>0.03% of the order, or ₹20, whichever is lower</td><td>₹{sample.brokerage.toFixed(2)}</td><td>₹{sampleSell.brokerage.toFixed(2)}</td></tr>
              <tr><td>STT (securities transaction tax)</td><td>0.1% of the order, on buys and sells</td><td>₹{sample.stt.toFixed(2)}</td><td>₹{sampleSell.stt.toFixed(2)}</td></tr>
              <tr><td>Exchange and regulator fees</td><td>About 0.003% of the order</td><td>₹{sample.exchange.toFixed(2)}</td><td>₹{sampleSell.exchange.toFixed(2)}</td></tr>
              <tr><td>GST</td><td>18% of brokerage and the fees above</td><td>₹{sample.gst.toFixed(2)}</td><td>₹{sampleSell.gst.toFixed(2)}</td></tr>
              <tr><td>Stamp duty</td><td>0.015% of the order, on buys only</td><td>₹{sample.stamp.toFixed(2)}</td><td>₹{sampleSell.stamp.toFixed(2)}</td></tr>
              <tr className="total-row"><td>Total</td><td></td><td>₹{sample.total.toFixed(2)}</td><td>₹{sampleSell.total.toFixed(2)}</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          <strong>Tax on profit.</strong> When you sell above the average price
          you paid, 20% of the profit (after charges) is taken. This matches
          India's short-term capital gains rate on listed shares (20%), which
          applies when you hold for 12 months or less, and everything here is
          held for minutes or days. Real long-term gains (over 12 months) are
          taxed at 12.5% on the part above Rs 1.25 lakh a year. Real tax is
          also worked out once a year on your total gains, and losses can be
          set against gains. Here it is taken at the time of each sale, and a
          loss is not carried forward, to keep it simple.
        </p>
        <p>
          Buy and sell the same shares straight away to see what it costs: the
          spread, the price impact and about 0.15% in charges each way.
        </p>
      </section>

      <section className="doc-text" id="breakers">
      <h3>6. Circuit breakers</h3>
        <p>Two layers, as in real Indian markets:</p>
        <ul>
          <li>
            <strong>Price limit on each stock:</strong> a stock cannot trade more
            than 20% above or below yesterday's close. When it reaches the limit
            you see an "Upper limit" or "Lower limit" tag, and orders that would
            go further cannot happen.
          </li>
          <li>
            <strong>Market-wide breaker:</strong> if SANRIO 18 (our Nifty 50)
            moves from yesterday's close by:
          </li>
        </ul>
        <div className="scroll-x">
          <table className="how-table">
            <thead>
              <tr><th>Move</th><th>This platform</th><th>Real India (as far as I know)</th></tr>
            </thead>
            <tbody>
              <tr><td>10%</td><td>Halt of about 12% of the trading day if early (before 1 pm equivalent), 4% from 1 to 2:30 pm equivalent, none after</td><td>45 minutes before 1 pm, 15 minutes from 1 pm to 2:30 pm, no halt after 2:30 pm</td></tr>
              <tr><td>15%</td><td>Halt of about 28% of the day if early, 12% from 1 to 2 pm equivalent, rest of the day after</td><td>1 hour 45 minutes before 1 pm, 45 minutes from 1 pm to 2 pm, rest of the day after 2 pm</td></tr>
              <tr><td>20%</td><td>Halts for the rest of the day</td><td>Rest of the day, at any time</td></tr>
            </tbody>
          </table>
        </div>
        <p className="note-small">
          The real rules are set by SEBI and the exchanges and have changed over
          time, so check their websites. This platform copies the same time-of-day
          rules, but squeezes them to fit its shorter day, so each halt is the
          same share of the day as in real life. Real India also gives each
          stock its own daily band (2%, 5%, 10% or 20%, and no fixed band for
          the biggest stocks); here every stock uses 20%.
        </p>
      </section>

      <section className="doc-text" id="company">
      <h3>7. Company data and results</h3>
        <p>
          Each company has an earnings per share (EPS). The P/E ratio on the stock
          page is simply the price divided by EPS. Net profit = EPS x shares. Every
          few hours of trading a company reports results:
        </p>
        <code className="block">
          surprise = random number x 7% (capped at plus or minus 20%){"\n"}
          profit growth = 2% + surprise{"\n"}
          price reaction (to fair value) = surprise x 0.5
        </code>
        <p>
          So a company that beats expectations by 8% gets about +4% on its price,
          and EPS grows by 10%. Because the price moves less than EPS, the P/E
          falls a little after good results. Real reactions can be much bigger or
          smaller and depend on guidance for the future, not just the numbers.
          All companies are invented, with a note on which real kind of company
          each one is loosely modelled on.
        </p>
      </section>

      <section className="doc-text" id="hours">
      <h3>8. Market hours</h3>
        <p>
          Open 9:30 am to 3:00 pm India time, Monday to Friday. Closed on weekends
          (public holidays are not modelled). While closed, prices are frozen and
          market orders are refused. Limit and stop orders can still be placed and
          wait. At each new open, every stock opens with a small random gap from
          yesterday's close, like overnight news. Real Indian markets trade 9:15
          am to 3:30 pm with a pre-open auction.
        </p>
        <p>
          Like real markets, the first half hour of each day is jumpier than the
          rest, and a little extra at the close. The first day after a weekend
          (Monday) opens with a gap more than twice as big and about double the
          usual swings at the start, because two days of news arrive at once.
        </p>
        <p className="note-small">
          Developers: start the server with FORCE_OPEN=1 to switch the schedule
          off and practise any time.
        </p>
      </section>

      <section className="doc-text" id="reality">
      <h3>9. Real rules compared with this platform</h3>
        <p>
          A quick reference of the real Indian rules this platform copies, and
          where it deliberately simplifies. Checked in November 2026 against the
          sources below. Rules and rates change, so treat this as a learning
          guide and check the official sites before relying on any number.
        </p>
        <div className="scroll-x">
          <table className="how-table">
            <thead>
              <tr><th>Topic</th><th>Real India</th><th>This platform</th></tr>
            </thead>
            <tbody>
              <tr><td>Trading hours</td><td>9:15 am to 3:30 pm, Monday to Friday, with a pre-open auction</td><td>9:30 am to 3:00 pm, Monday to Friday, no pre-open, no holidays</td></tr>
              <tr><td>Daily limit on one stock</td><td>Set per stock: 2%, 5%, 10% or 20% (the biggest stocks have no fixed band)</td><td>20% for every stock</td></tr>
              <tr><td>Market-wide breaker, 10%</td><td>45 min halt before 1 pm, 15 min from 1 to 2:30 pm, no halt after 2:30 pm</td><td>Same rules, with each halt shrunk to the same share of our shorter day</td></tr>
              <tr><td>Market-wide breaker, 15%</td><td>1 h 45 min before 1 pm, 45 min from 1 to 2 pm, rest of day after 2 pm</td><td>Same rules, scaled</td></tr>
              <tr><td>Market-wide breaker, 20%</td><td>Rest of the day, at any time</td><td>Same</td></tr>
              <tr><td>Securities transaction tax (STT)</td><td>0.1% on buying and 0.1% on selling (delivery)</td><td>0.1% both ways</td></tr>
              <tr><td>Brokerage</td><td>Differs by broker: Rs 0 at some, up to Rs 20 or 0.03% per order at others</td><td>Rs 20 or 0.03%, whichever is lower</td></tr>
              <tr><td>Exchange (NSE) fee</td><td>About 0.00307% of the trade value</td><td>0.00307%</td></tr>
              <tr><td>Regulator (SEBI) fee</td><td>Rs 10 per crore</td><td>Rs 10 per crore</td></tr>
              <tr><td>GST on fees</td><td>18% on brokerage, exchange and SEBI fees</td><td>18% on the same</td></tr>
              <tr><td>Stamp duty</td><td>0.015% on buying only</td><td>0.015% on buying only</td></tr>
              <tr><td>Tax on profit, short term</td><td>20% on shares held 12 months or less</td><td>20% on each profitable sale (everything here is short term)</td></tr>
              <tr><td>Tax on profit, long term</td><td>12.5% on the part above Rs 1.25 lakh a year, for shares held over 12 months</td><td>Not modelled</td></tr>
              <tr><td>When tax is paid</td><td>Yearly, on total gains, with losses set against gains</td><td>At each sale, and losses are not carried forward</td></tr>
              <tr><td>Nifty 50</td><td>50 large companies, weighted by free-float market value, base 1,000 on 3 Nov 1995, rebalanced twice a year</td><td>SANRIO 18: all 18 stocks, weighted by full market value, base 1,000 at server start, never rebalanced</td></tr>
              <tr><td>Dividends</td><td>Paid when a company decides; the price drops on the ex-date</td><td>One quarter of the yearly yield every 5 trading days, price drops by the same amount</td></tr>
            </tbody>
          </table>
        </div>
        <p className="note-small">
          Why simplify? The goal is an intuitive feel for how markets, indices and
          costs work, not an exact copy. Where this platform differs, it is
          usually to make a trading year fit into minutes.
        </p>
        <h4>Sources</h4>
        <ul>
          <li><a href="https://www.nseindia.com/static/products-services/equity-market-circuit-breakers" target="_blank" rel="noopener noreferrer">NSE: equity market circuit breakers</a></li>
          <li><a href="https://zerodha.com/charges" target="_blank" rel="noopener noreferrer">Zerodha: charges (STT, exchange fee, GST, stamp duty, SEBI fee)</a></li>
          <li><a href="https://stockcalc.in/calculator/ltcg" target="_blank" rel="noopener noreferrer">Capital gains rates on listed shares (short and long term)</a></li>
          <li><a href="https://en.wikipedia.org/wiki/NIFTY_50" target="_blank" rel="noopener noreferrer">Nifty 50: how the index is built</a></li>
        </ul>
      </section>
    </div>
  );
}

export default Developers;
