// Fetches the latest REAL price data for a few Indian stocks, for the Developers page.
// Source: Yahoo Finance's public chart endpoint (unofficial, no key needed). Google Finance
// has no public data feed, so this is the closest free source. It can be delayed by about
// 15 minutes, can change or block requests without notice, and is for learning only.

export const REAL_STOCKS = {
  "RELIANCE.NS": "Reliance Industries",
  "TCS.NS": "Tata Consultancy Services",
  "INFY.NS": "Infosys",
  "HDFCBANK.NS": "HDFC Bank",
  "ITC.NS": "ITC",
  "SBIN.NS": "State Bank of India",
};

const cache = new Map(); // ticker -> { at, data }
const CACHE_MS = 30 * 1000;

async function chart(ticker, interval, range) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (learning-platform)", Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Yahoo Finance answered ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error("No data came back");
  return result;
}

const timeLabel = (sec) =>
  new Date(sec * 1000).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

// Turns the two raw answers into what the page needs
export function shape(ticker, intra, daily) {
  const ts = intra.timestamp || [];
  const closes = intra.indicators?.quote?.[0]?.close || [];
  const points = [];
  ts.forEach((t, i) => {
    if (closes[i] !== null && closes[i] !== undefined) {
      points.push({ time: timeLabel(t), price: Number(closes[i].toFixed(2)) });
    }
  });

  const dq = daily.indicators?.quote?.[0] || {};
  const dCloses = (dq.close || []).filter((x) => x !== null && x !== undefined);
  const dVols = (dq.volume || []).filter((x) => x !== null && x !== undefined && x > 0);

  // average daily volume (shares) and daily volatility (standard deviation of daily % moves)
  const avgVolume = dVols.length ? dVols.reduce((a, b) => a + b, 0) / dVols.length : null;
  let sigma = null;
  if (dCloses.length > 2) {
    const r = [];
    for (let i = 1; i < dCloses.length; i++) r.push(Math.log(dCloses[i] / dCloses[i - 1]));
    const mean = r.reduce((a, b) => a + b, 0) / r.length;
    sigma = Math.sqrt(r.reduce((a, b) => a + (b - mean) ** 2, 0) / (r.length - 1));
  }

  const meta = intra.meta || {};
  return {
    ok: true,
    ticker,
    name: REAL_STOCKS[ticker],
    currency: meta.currency || "INR",
    price: meta.regularMarketPrice ?? points[points.length - 1]?.price ?? null,
    prevClose: meta.chartPreviousClose ?? meta.previousClose ?? null,
    marketTime: meta.regularMarketTime ? timeLabel(meta.regularMarketTime) : null,
    points,
    avgVolume,
    sigma,
    days: dCloses.length,
    fetchedAt: new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }),
    source: "Yahoo Finance (unofficial). Prices can be delayed by about 15 minutes.",
  };
}

export async function getReal(ticker) {
  if (!Object.hasOwn(REAL_STOCKS, ticker)) return { ok: false, error: "Unknown stock." };

  const hit = cache.get(ticker);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  try {
    const [intra, daily] = await Promise.all([chart(ticker, "5m", "1d"), chart(ticker, "1d", "1mo")]);
    const data = shape(ticker, intra, daily);
    cache.set(ticker, { at: Date.now(), data });
    return data;
  } catch (err) {
    // an old answer is better than none
    if (hit) return { ...hit.data, stale: true };
    return {
      ok: false,
      error: `Could not load live data (${err.message}). Check that this computer is online. The live feed is unofficial and can stop working.`,
    };
  }
}
