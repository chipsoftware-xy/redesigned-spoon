import { useState } from "react";
import { Link } from "react-router-dom";

// Plain-language basics. Facts about real markets (hours, index sizes, rules) change over
// time, so the page says to check the official sites before relying on any of them.

const COUNTRIES = [
  {
    place: "India",
    exchanges: "NSE (National Stock Exchange) and BSE (Bombay Stock Exchange)",
    indices: "Nifty 50 (NSE, 50 big companies) and Sensex (BSE, 30 big companies)",
    hours: "9:15 am to 3:30 pm India time, Monday to Friday",
    money: "Indian rupee",
    watchdog: "SEBI",
    notes: "A stock can only move a set percentage per day (often 5%, 10% or 20%). If the whole market falls 10%, 15% or 20% in a day, trading halts.",
  },
  {
    place: "United States",
    exchanges: "NYSE (New York Stock Exchange) and Nasdaq",
    indices: "S&P 500 (500 large companies), Dow Jones (30 companies), Nasdaq Composite (mostly tech)",
    hours: "9:30 am to 4:00 pm New York time, Monday to Friday",
    money: "US dollar",
    watchdog: "SEC",
    notes: "The biggest market in the world. Individual stocks pause if they move too fast, and the whole market pauses if the S&P 500 falls 7%, 13% or 20%.",
  },
  {
    place: "United Kingdom",
    exchanges: "London Stock Exchange",
    indices: "FTSE 100 (100 large companies)",
    hours: "8:00 am to 4:30 pm London time, Monday to Friday",
    money: "Pound sterling",
    watchdog: "FCA",
    notes: "Many of its biggest companies earn most of their money abroad, so the FTSE 100 follows the world economy more than the UK's.",
  },
  {
    place: "Japan",
    exchanges: "Tokyo Stock Exchange",
    indices: "Nikkei 225 and TOPIX",
    hours: "9:00 am to 3:30 pm Tokyo time, with a lunch break",
    money: "Japanese yen",
    watchdog: "FSA",
    notes: "Exporters such as car makers do well when the yen is weak, so the currency and the stock market move together.",
  },
  {
    place: "China and Hong Kong",
    exchanges: "Shanghai and Shenzhen (mainland), HKEX (Hong Kong)",
    indices: "SSE Composite (Shanghai) and Hang Seng (Hong Kong)",
    hours: "About 9:30 am to 3:00 pm (mainland) and 4:00 pm (Hong Kong), with a lunch break",
    money: "Yuan (mainland) and Hong Kong dollar",
    watchdog: "CSRC (mainland) and SFC (Hong Kong)",
    notes: "Mainland stocks have strict daily limits and foreign investors can only buy through special routes. Hong Kong is more open.",
  },
];

const GLOSSARY = [
  ["Share / stock", "One small slice of ownership in a company."],
  ["Market cap", "Share price multiplied by the number of shares. It is the market's price for the whole company."],
  ["Bid and ask", "The bid is the highest price a buyer will pay right now. The ask is the lowest price a seller will accept. The gap between them is the spread."],
  ["Order book", "The live list of everyone's waiting buy and sell orders at each price."],
  ["Market order", "Buy or sell right now at the best available price."],
  ["Limit order", "Buy or sell only at your price or better. It waits if the market is not there yet."],
  ["Stop-loss", "A sell order that wakes up when the price falls to a trigger, to stop a loss from growing."],
  ["Liquidity", "How easily you can buy or sell without moving the price. Big popular stocks are liquid. Small ones are not."],
  ["Volatility", "How much and how fast a price jumps around."],
  ["Slippage", "The extra cost when your order is big enough to use up several price levels."],
  ["Dividend", "A share of the company's profit paid to shareholders."],
  ["EPS", "Earnings per share: the company's profit divided by its number of shares."],
  ["P/E ratio", "Price divided by EPS. It shows how many rupees investors pay for each rupee of yearly profit. A high P/E means people expect strong growth."],
  ["Bull market", "Prices rising and people confident."],
  ["Bear market", "Prices down 20% or more from a recent peak."],
  ["Correction", "A pullback of about 10% to 20%."],
  ["Diversification", "Spreading your money across different companies and sectors so one bad story cannot sink you."],
  ["Short selling", "Betting that a price will fall by selling shares you borrowed. Not available on this platform."],
  ["Demat account", "The account in India that holds your shares electronically."],
  ["FII / FPI", "Foreign institutional or portfolio investors: big overseas funds that buy and sell Indian shares."],
  ["Circuit breaker", "A rule that stops trading when prices move too far too fast, to give everyone time to think."],
];

function Section({ title, children }) {
  return (
    <div className="doc-card">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function Learn() {
  const [open, setOpen] = useState(false);

  return (
    <div className="app">
      <Link to="/">← Back to market</Link>
      <h1>Understanding the market first</h1>
      <p>
        Everything you need before the numbers on this platform make sense, in
        plain language. Read it top to bottom, or jump to what you need.
      </p>

      <div className="toc">
        <a href="#stock">What is a stock</a>
        <a href="#exchange">Exchanges</a>
        <a href="#price">Why prices move</a>
        <a href="#index">Nifty and Sensex</a>
        <a href="#moods">Bull, bear, crash</a>
        <a href="#countries">Country by country</a>
        <a href="#global">The world is connected</a>
        <a href="#risk">Risk and costs</a>
        <a href="#words">Glossary</a>
      </div>

      <div id="stock">
        <Section title="What is a stock?">
          <p>
            A company needs money to grow: to build factories, hire people,
            create products. One way to raise it is to cut the company into many
            equal pieces and sell the pieces to the public. Each piece is a
            share (also called a stock). If a company has 1,000,000 shares and
            you own 1,000 of them, you own one-thousandth of the company.
          </p>
          <p>
            Owning a share does not mean you can walk into the company and give
            orders. It means you share in what the company earns and in how it
            is valued. That shows up in two ways:
          </p>
          <ul>
            <li>
              <strong>The price can rise or fall.</strong> If people think the
              company will earn more in future, they will pay more for a share.
              You can sell it later for more (or less) than you paid.
            </li>
            <li>
              <strong>Dividends.</strong> Some companies pay part of their
              profit out to shareholders regularly.
            </li>
          </ul>
          <p className="note-small">
            Example: if Kuromi Consultancy Services here has a price of ₹4,000
            and 220 million shares, the market values the whole company at
            about ₹88,000 crore. That is its market cap.
          </p>
        </Section>
      </div>

      <div id="exchange">
        <Section title="What is a stock exchange?">
          <p>
            An exchange is the marketplace where shares are bought and sold. It
            does not decide prices. It keeps the list of waiting buy and sell
            orders, matches a buyer and a seller who agree on a price, and makes
            sure both sides get what they were promised.
          </p>
          <p>
            You do not trade on the exchange directly. You use a{" "}
            <strong>broker</strong> (an app such as Groww or Zerodha), which
            sends your order to the exchange for a small fee. A{" "}
            <strong>regulator</strong> (SEBI in India) writes the rules and
            punishes cheating. In India, shares you buy are held electronically
            in a <strong>demat account</strong>.
          </p>
          <p>
            This platform is a tiny pretend exchange: it has its own order book,
            its own pretend traders (bots), and fake money.
          </p>
        </Section>
      </div>

      <div id="price">
        <Section title="Why do prices move?">
          <p>
            There is no one deciding the price. It is simply the price at which
            the last trade happened. Every moment there are people who want to
            buy (and will pay up to some price) and people who want to sell
            (and will take down to some price).
          </p>
          <ul>
            <li>
              More buyers than sellers: buyers have to offer more to get shares,
              so the price goes up.
            </li>
            <li>
              More sellers than buyers: sellers have to accept less, so the
              price goes down.
            </li>
          </ul>
          <p>
            What changes how many people want to buy or sell? News about the
            company (profits, new products, scandals), news about the economy
            (interest rates, inflation, wars, elections), and plain emotion:
            fear and excitement spread between people faster than facts do.
          </p>
          <p>
            That is why this platform has a <em>market mood</em>, sectors that
            react differently, news events, company results, and bots that
            behave like different kinds of real traders. The{" "}
            <Link to="/developers">Developers page</Link> shows the exact math.
          </p>
        </Section>
      </div>

      <div id="index">
        <Section title="What are Nifty and Sensex?">
          <p>
            With thousands of stocks, how do you say whether &ldquo;the
            market&rdquo; is up or down today? You pick a representative group
            and track it as one number. That number is an <strong>index</strong>.
          </p>
          <ul>
            <li>
              <strong>Nifty 50</strong> tracks 50 of the biggest companies on
              the NSE. It started at 1,000 on 3 November 1995.
            </li>
            <li>
              <strong>Sensex</strong> tracks 30 big companies on the BSE. Its
              base value is 100 for the year 1978-79.
            </li>
          </ul>
          <p>
            Bigger companies count for more, so a 2% move in the largest company
            changes the index more than a 2% move in a small one. If the Nifty
            is at 24,000 today and 24,240 tomorrow, the market&rsquo;s big
            companies together rose 1%.
          </p>
          <p>
            You cannot buy an index directly. You can buy an index fund or ETF,
            which holds all its stocks for you. There are also sector indices
            (Nifty Bank, Nifty IT, Nifty Pharma) that track one industry.
            On this platform, SANRIO 18 is our Nifty 50, KITTY 6 is our Sensex,
            and each sector has its own made-up index.
          </p>
        </Section>
      </div>

      <div id="moods">
        <Section title="Bull, bear, correction, crash, bubble">
          <ul>
            <li>
              <strong>Bull market</strong>: prices rise for a long time and
              people are confident.
            </li>
            <li>
              <strong>Correction</strong>: a drop of about 10% to 20% from a
              recent peak. Usually healthy, like a pause for breath.
            </li>
            <li>
              <strong>Bear market</strong>: a fall of 20% or more that lasts.
            </li>
            <li>
              <strong>Crash</strong>: a sudden, steep fall driven by panic.
            </li>
            <li>
              <strong>Recovery</strong>: the bounce after a fall.
            </li>
            <li>
              <strong>Bubble</strong>: prices far above what companies are
              really worth because everyone is buying out of excitement. Bubbles
              end when the buyers run out.
            </li>
          </ul>
          <p>
            Switch the market mood on the main page (in Learning mode) to watch
            each one, and read the real-world case study beside it.
          </p>
        </Section>
      </div>

      <div id="countries">
        <Section title="How the stock market differs from country to country">
          <p>
            The idea is the same everywhere, but the details are not. Things
            that differ: which exchanges exist, trading hours, currency, the
            index everyone watches, how strict the daily limits are, who is
            allowed to invest, taxes, and how fast a trade is settled (money and
            shares actually change hands).
          </p>
          <div className="scroll-x">
            <table className="how-table">
              <thead>
                <tr>
                  <th>Country</th>
                  <th>Exchanges</th>
                  <th>Main indices</th>
                  <th>Trading hours</th>
                  <th>Currency</th>
                  <th>Regulator</th>
                  <th>Worth knowing</th>
                </tr>
              </thead>
              <tbody>
                {COUNTRIES.map((c) => (
                  <tr key={c.place}>
                    <td>
                      <strong>{c.place}</strong>
                    </td>
                    <td>{c.exchanges}</td>
                    <td>{c.indices}</td>
                    <td>{c.hours}</td>
                    <td>{c.money}</td>
                    <td>{c.watchdog}</td>
                    <td>{c.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note-small">
            Rules and hours change, and public holidays differ. Check the
            exchange&rsquo;s own website before relying on any of this. This
            platform follows a simplified India-style day: 9:30 am to 3:00 pm
            IST, Monday to Friday.
          </p>
        </Section>
      </div>

      <div id="global">
        <Section title="How the world's markets are connected">
          <p>
            Markets are separate places, but money and news move between them
            all day, so they rarely move alone.
          </p>
          <ul>
            <li>
              <strong>A relay of time zones.</strong> Asia opens first, then
              Europe, then the US. When the US closes it is already night in
              India, so a big move in New York shows up in Indian prices the
              next morning. Traders watch overnight signals (such as US futures
              and GIFT Nifty) before India opens.
            </li>
            <li>
              <strong>Foreign money.</strong> Big overseas funds invest in India
              when they feel confident and pull out when they feel nervous. When
              they leave, prices fall and the rupee often weakens too.
            </li>
            <li>
              <strong>Shared causes.</strong> US interest rates, oil prices and
              the strength of the dollar affect almost every country. If US
              interest rates go up, safe US bonds pay more and some money
              leaves risky markets elsewhere.
            </li>
            <li>
              <strong>Companies earn globally.</strong> An Indian software firm
              earns in dollars. A Japanese carmaker sells in America. Their
              share prices follow those economies as well as their home one.
            </li>
            <li>
              <strong>Fear spreads.</strong> In 2008 a crisis in US housing
              loans became a worldwide crash within weeks. In March 2020 fear of
              the pandemic hit every market in nearly the same days. The case
              studies on the main page (Learning mode) walk through both.
            </li>
          </ul>
          <p>
            That is why the advice is to follow both global and local news. A
            stock can be doing everything right and still fall because the
            world got nervous.
          </p>
        </Section>
      </div>

      <div id="risk">
        <Section title="Risk, costs and habits worth knowing early">
          <ul>
            <li>
              <strong>Risk and reward go together.</strong> Higher possible
              gains come with bigger possible losses. A stock that doubled can
              halve.
            </li>
            <li>
              <strong>Diversify.</strong> Several companies in different sectors
              means one bad story hurts less. Notice here how AI and
              Semiconductors can move in opposite directions.
            </li>
            <li>
              <strong>Costs add up.</strong> Brokerage, taxes and the bid-ask gap
              are paid every time you trade. Trading in and out quickly can lose
              money even if the price does not change. Try it on this platform:
              buy and instantly sell the same shares.
            </li>
            <li>
              <strong>Your own big order can move the price</strong>, but only
              in small, illiquid stocks. In a giant company it makes almost no
              difference. The Developers page shows this side by side.
            </li>
            <li>
              <strong>Emotion is the real enemy.</strong> Panic selling at the
              bottom and FOMO buying at the top are the two most common mistakes.
              Two of the bots here behave exactly like that.
            </li>
            <li>
              <strong>Results move prices.</strong> When a company reports its
              profit, the price reacts to how it compared with what experts
              expected, not just to the profit itself.
            </li>
          </ul>
        </Section>
      </div>

      <div id="words">
        <Section title="Glossary">
          <button className="tab" onClick={() => setOpen(!open)}>
            {open ? "Hide glossary" : "Show glossary"}
          </button>
          {open && (
            <table className="how-table">
              <tbody>
                {GLOSSARY.map(([word, meaning]) => (
                  <tr key={word}>
                    <td>
                      <strong>{word}</strong>
                    </td>
                    <td>{meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>
    </div>
  );
}

export default Learn;