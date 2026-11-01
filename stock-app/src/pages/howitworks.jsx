import { Link } from "react-router-dom";

const ROWS = [
  {
    what: "How a price is set",
    real: "Buy and sell orders are matched in an order book. The price is the price of the last matched trade.",
    here: "Each stock has an order book with 20 price levels on each side. Market makers keep quoting around a hidden fair value, bots and users trade against those quotes, and the price is the last trade. The fair value itself moves by the formula below.",
    status: "close",
  },
  {
    what: "Market mood (bull, crash, bubble...)",
    real: "Emerges from millions of people deciding to buy or sell.",
    here: "A mood is set, either by someone pressing a button in Learning mode or by the server on its own. Each mood is a push (drift) and a jumpiness (volatility).",
    status: "simplified",
  },
  {
    what: "Sectors",
    real: "Industries react differently to the same shock. Defensive sectors hold up in a fall, risky ones fall harder.",
    here: "Each sector has a beta: how strongly it follows the mood. AI 1.5, Semiconductors 1.2, Finance 1.1, Consumer 0.5, Healthcare 0.3, Defense -0.3.",
    status: "close",
  },
  {
    what: "Spillover between sectors",
    real: "Money moves between industries, and one sector's problem can be another's gain.",
    here: "A small link table: for example, when AI falls, Semiconductors get a push the other way.",
    status: "simplified",
  },
  {
    what: "News",
    real: "Results, policy and world events move prices.",
    here: "Random headlines hit one sector now and then. They are made up and have no deeper cause.",
    status: "simplified",
  },
  {
    what: "Your orders move the price",
    real: "Big orders use up the available buyers or sellers, so the price moves and you pay more than the quote (slippage).",
    here: "Your order walks up (or down) the book, eating the cheapest sell orders (or highest buy orders) first. You pay the average of what you ate. About a third of that move stays as the new fair value. The rest fades as market makers refill the book.",
    status: "close",
  },
  {
    what: "Liquidity changes with conditions",
    real: "In a panic, buyers disappear and the same order moves the price much more.",
    here: "In a crash the book is thinner (0.4x depth) and the spread is 3x wider. In a bull market it is deeper and tighter.",
    status: "close",
  },
  {
    what: "Indices",
    real: "The Nifty 50 and Sensex follow a basket of large companies, weighted by company size.",
    here: "Made-up equivalents, calculated live the same way (see below).",
    status: "close",
  },
  {
    what: "Buy price vs sell price (spread)",
    real: "There is a bid and an ask, and you buy slightly above and sell slightly below.",
    here: "Yes. Market makers quote 0.05% either side of fair value in calm markets, wider in a panic. Buying and selling the same shares straight away loses money to the spread.",
    status: "close",
  },
  {
    what: "Order types",
    real: "Market, limit, stop-loss and others.",
    here: "Market, limit, stop-loss and stop-buy (in Realistic mode). Limit and stop orders wait inside the market and run when the price is right. A limit order never fills at a worse price than you set. A stop order becomes a market order once its trigger price is hit. Each waiting order is valid for the day (cancelled at the close) or until you cancel it. A trailing stop follows the price up and sells when it falls the chosen % from its high. A bracket buys, then places a target and a stop-loss where one cancels the other. Missing: short selling, margin and partial-fill rules of real brokers.",
    status: "close",
  },
  {
    what: "Other traders",
    real: "Thousands of traders, funds and market makers who always quote prices.",
    here: "Six kinds of bots: retail traders, momentum funds, value investors, arbitrage desk, panic sellers and FOMO buyers. Panic sellers wake up in corrections and crashes, FOMO buyers in bubbles and recoveries.",
    status: "simplified",
  },
  {
    what: "Market hours",
    real: "Indian markets trade about 9:15 am to 3:30 pm IST on weekdays, with a daily open and close.",
    here: "Open 9:30 am to 3:00 pm India time, Monday to Friday, and closed on weekends. While closed, prices are frozen and market orders are refused. Each new day opens with a small gap from the previous close, like overnight news does. Day change is measured from the previous close. Holidays and the pre-open auction are not modelled. Moods and news are sped up a lot compared with real life.",
    status: "close",
  },
  {
    what: "Candlesticks and volume",
    real: "Charts show open, high, low and close for each period, plus the number of shares traded.",
    here: "Each candle covers 10 seconds, built from the real trades on the order book. The volume bars count the shares traded in the same 10 seconds, including your own orders and the bots'.",
    status: "close",
  },
  {
    what: "Circuit breakers",
    real: "Trading halts if the market falls too fast. In India the market-wide levels are 10%, 15% and 20%, and each stock has its own daily price limit.",
    here: "Each stock can move 20% from yesterday's close at most. If SANRIO 18 moves 10%, 15% or 20% from yesterday's close, trading halts. As in India, how long depends on the time of day (a 10% fall early in the day halts longer than one at 1 pm, and a 10% fall after 2:30 pm does not halt at all). The lengths are scaled to this platform's shorter day.",
    status: "close",
  },
  {
    what: "Company data",
    real: "Earnings, P/E, dividends and quarterly results move prices.",
    here: "Made-up profiles (what it does, P/E, EPS, profit, revenue, dividend yield) and results every few hours of trading. The price reacts to how the profit compares with expectations. Every 5 trading days a company pays one quarter of its yearly dividend to everyone who holds it; the price drops by the same amount that morning (the ex-dividend date). Dividend tax is not modelled. There is no company news beyond results.",
    status: "simplified",
  },
  {
    what: "Costs",
    real: "Brokerage, taxes and fees.",
    here: "Brokerage, STT, exchange fees, GST and stamp duty on every trade, plus 20% tax on profit when you sell. Rates are modelled on Indian delivery trades. The 20% is the real short-term rate (shares held 12 months or less); long-term gains are not modelled, and tax is taken at each sale instead of once a year.",
    status: "simplified",
  },
];

const STATUS = {
  close: { label: "Close to real", cls: "badge close" },
  simplified: { label: "Simplified", cls: "badge simple" },
  missing: { label: "Not built yet", cls: "badge todo" },
};

const INDEX_MAP = [
  ["Nifty 50", "SANRIO 18", "All stocks on the platform"],
  ["Sensex", "KITTY 6", "The six biggest companies"],
  ["Nifty Bank", "Sanrio Finance", "Finance stocks"],
  ["Nifty IT", "Sanrio AI", "AI stocks (the nearest match)"],
  ["Nifty Pharma", "Sanrio Health", "Healthcare stocks"],
  ["Nifty FMCG", "Sanrio Consumer", "Consumer stocks"],
];

function HowItWorks() {
  return (
    <div className="app">
      <Link to="/">← Back to market</Link>
      <h1>How this platform simulates a real market</h1>

      <section className="doc-text">
      <h3>The short version</h3>
        <p>
          A real exchange matches buyers and sellers, and the price is whatever
          the last trade was. This platform has no crowd, so a formula plays the
          role of the crowd, and your orders push the price on top of it. The
          goal is to show cause and effect: what moves a price, and by how much.
        </p>
        <p>
          The money is fake, the companies are made up, and the case studies
          are real events that the simulator imitates in spirit but does not
          replay. The numbers behind each mood were chosen to look right, not
          fitted to historical data.
        </p>
      </section>

      <section className="doc-text">
      <h3>How one price moves (every 2 seconds)</h3>
        <code className="block">
          move = sector beta × market mood + sector momentum + spillover from
          other sectors + noise
        </code>
        <p className="note-small">
          In a crash the mood term is negative, and a beta of 1.5 (AI) makes it
          hit harder, while a beta of -0.3 (Defense) turns it into a small gain.
        </p>

        <h3>How the order book works</h3>
        <code className="block">
          sell orders (asks) sit above fair value, buy orders (bids) sit below
        </code>
        <p>
          Every 2 seconds the market makers refill the book around the fair
          value. Then the bots send orders, which eat the cheapest levels. The
          price shown is the price of the last trade, which is why it jumps a
          little from tick to tick even when fair value barely moves.
        </p>
        <p>
          When you buy, your order eats the sell orders from the lowest price
          upward, until your quantity is filled. A small order uses one level
          and barely moves the price. A big order uses many levels, so you pay a
          higher average price (slippage) and the last price ends higher. If the
          book has fewer shares than you asked for, the order is rejected.
        </p>
        <p>
          Depth is how many shares wait at each level. It is based on each
          stock's liquidity (the money needed to move it about 1%) and it
          shrinks in scary markets. That is why the same order moves a small
          company more than a big one, and moves anything more in a crash.
        </p>
      </section>

      <section className="doc-text">
      <h3>How the indices are built</h3>
        <code className="block">
          index = 1000 × (sum of price × shares now) ÷ (sum of price × shares
          at the start)
        </code>
        <p>
          Each index starts at 1,000 when the server starts. The Market page cards show the change since the previous close (like Nifty on TV); the Developers page also shows the change since the server started. The index follows the
          total size of its companies. A bigger company has a bigger weight, so
          a 2% move in the largest stock changes the index more than a 2% move
          in the smallest. Real indices work the same way, except that they use
          only the shares available for public trading (free-float), while this
          platform uses all shares for simplicity.
        </p>
        <table className="how-table">
          <thead>
            <tr>
              <th>Real index</th>
              <th>Made-up equivalent</th>
              <th>Contains</th>
            </tr>
          </thead>
          <tbody>
            {INDEX_MAP.map(([real, fake, what]) => (
              <tr key={real}>
                <td>{real}</td>
                <td>
                  <strong>{fake}</strong>
                </td>
                <td>{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="doc-text">
      <h3>Real market vs this platform</h3>
        <table className="how-table">
          <thead>
            <tr>
              <th>Topic</th>
              <th>In a real market</th>
              <th>On this platform</th>
              <th>How close</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.what}>
                <td>
                  <strong>{r.what}</strong>
                </td>
                <td>{r.real}</td>
                <td>{r.here}</td>
                <td>
                  <span className={STATUS[r.status].cls}>
                    {STATUS[r.status].label}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="doc-text">
      <h3>Learning mode vs Realistic mode</h3>
        <p>
          Both modes use the same shared market. Learning mode shows the
          machinery: the mood buttons, the case studies, the base value line,
          the "Why did it move?" breakdown and the order effects beside the
          table. Realistic mode hides all of that and shows what a normal
          trading app shows, so you can practise without the hints.
        </p>
      </section>
    </div>
  );
}

export default HowItWorks;
