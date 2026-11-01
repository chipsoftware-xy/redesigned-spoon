import process from "node:process";
import { COMPANIES } from "./companies.js";

// ---------- 1. THE STOCKS (edit names, prices, sectors and sizes here) ----------
// shares    = shares outstanding in millions (made up). Price x shares = company size.
// liquidity = rupees of trading needed to move the price by about 1% in a normal
//             market. It sets how deep the order book is for that stock.
const STOCKS = [
  // Consumer
  { symbol: "HelloKitty", name: "HK Sanrio Inc.", sector: "Consumer", price: 2890.5, shares: 180, liquidity: 60000 },
  { symbol: "Purin", name: "Pom Purin Industries", sector: "Consumer", price: 478.2, shares: 400, liquidity: 30000 },
  { symbol: "Gudetama", name: "Gudetama Foods Ltd.", sector: "Consumer", price: 735.0, shares: 250, liquidity: 25000 },
  // AI
  { symbol: "Kuromi", name: "Kuromi Consultancy Services", sector: "AI", price: 4120.75, shares: 220, liquidity: 55000 },
  { symbol: "Pochacco", name: "Pochacco Robotics", sector: "AI", price: 2210.4, shares: 150, liquidity: 40000 },
  { symbol: "Aggretsuko", name: "Aggretsuko Data Labs", sector: "AI", price: 1385.6, shares: 120, liquidity: 25000 },
  // Semiconductors
  { symbol: "Chococat", name: "ChocoCat LLP", sector: "Semiconductors", price: 1815.3, shares: 200, liquidity: 45000 },
  { symbol: "Keroppi", name: "Keroppi Chips Ltd.", sector: "Semiconductors", price: 960.0, shares: 260, liquidity: 30000 },
  { symbol: "Hangyodon", name: "Hangyodon Wafers Ltd.", sector: "Semiconductors", price: 540.8, shares: 140, liquidity: 20000 },
  // Defense
  { symbol: "Cinnamoroll", name: "Cinnamon Roll Ltd.", sector: "Defense", price: 1650.0, shares: 170, liquidity: 40000 },
  { symbol: "BadtzMaru", name: "Badtz-Maru Aerospace", sector: "Defense", price: 3340.9, shares: 130, liquidity: 45000 },
  { symbol: "TuxedoSam", name: "Tuxedo Sam Naval Systems", sector: "Defense", price: 2075.0, shares: 90, liquidity: 25000 },
  // Finance
  { symbol: "MyMelody", name: "My Melody Bank", sector: "Finance", price: 1520.0, shares: 450, liquidity: 65000 },
  { symbol: "TwinStars", name: "Little Twin Stars Capital", sector: "Finance", price: 880.4, shares: 300, liquidity: 35000 },
  { symbol: "CharmmyKitty", name: "Charmmy Finance Ltd.", sector: "Finance", price: 410.9, shares: 350, liquidity: 20000 },
  // Healthcare
  { symbol: "Pekkle", name: "Pekkle Pharma", sector: "Healthcare", price: 1240.0, shares: 160, liquidity: 35000 },
  { symbol: "Usahana", name: "Usahana Health Care", sector: "Healthcare", price: 690.3, shares: 210, liquidity: 25000 },
  { symbol: "WishMeMell", name: "Wish Me Mell Biotech", sector: "Healthcare", price: 2650.0, shares: 80, liquidity: 30000 },
];

// ---------- 2. SECTORS ----------
// beta = how much the sector follows the overall market mood.
// 1 = moves with the market, above 1 = exaggerates it, negative = moves opposite.
const SECTORS = {
  AI: { beta: 1.5 },
  Semiconductors: { beta: 1.2 },
  Finance: { beta: 1.1 },
  Consumer: { beta: 0.5 },
  Healthcare: { beta: 0.3 },
  Defense: { beta: -0.3 },
};

// Names of the sector indices (made-up equivalents of Nifty Bank, Nifty IT, etc.)
const SECTOR_INDEX_NAMES = {
  AI: "Sanrio AI",
  Semiconductors: "Sanrio Chips",
  Finance: "Sanrio Finance",
  Consumer: "Sanrio Consumer",
  Healthcare: "Sanrio Health",
  Defense: "Sanrio Defense",
};

// LINKS[A][B] = how much a move in sector A spills into sector B.
// Negative means opposite direction: AI falls, Semiconductors rise.
const LINKS = {
  AI: { Semiconductors: -0.5, Consumer: 0.2 },
  Semiconductors: { AI: 0.3 },
  Finance: { Consumer: 0.2 },
  Defense: { Consumer: -0.3 },
  Consumer: {},
  Healthcare: {},
};

// ---------- 3. MARKET MODES (numbers are per 2-second tick) ----------
// drift = steady push on FAIR VALUE, vol = how jumpy it is
const MODES = {
  crash: { drift: -0.0015, vol: 0.004 },
  correction: { drift: -0.0006, vol: 0.003 },
  normal: { drift: 0, vol: 0.002 },
  bull: { drift: 0.0012, vol: 0.002 },
  recovery: { drift: 0.001, vol: 0.0035 },
  bubble: { drift: 0.0022, vol: 0.003 },
};

// Each tick during a bubble, this is the chance it pops into a crash.
// 0.003 means it lasts about 10 minutes on average.
const BUBBLE_POP_CHANCE = 0.003;

// ---------- 3b. AUTOMATIC MOOD SHIFTS ----------
// Chance per tick: 0.002 means a shift roughly every 17 minutes.
const AUTO_SHIFT_CHANCE = 0.002;
// After someone changes the mood by hand, wait this long before auto shifts.
const MANUAL_PAUSE_MS = 10 * 60 * 1000;
// Which moods can follow which (a bubble is left alone: it pops by itself)
const NEXT_MODES = {
  normal: ["bull", "correction", "normal"],
  bull: ["normal", "correction", "bubble"],
  correction: ["normal", "recovery", "crash"],
  crash: ["recovery"],
  recovery: ["bull", "normal"],
  bubble: [],
};
// Headlines that describe a mood without naming it (realistic users see these)
const MODE_HEADLINES = {
  bull: "Investor confidence builds as stocks climb steadily",
  normal: "Markets turn quiet as traders wait for direction",
  correction: "Stocks pull back as investors take profits",
  crash: "Panic selling grips the market as stocks tumble",
  recovery: "Stocks bounce back as buyers return after the selloff",
  bubble: "Buying frenzy: investors rush into stocks at a record pace",
};

// ---------- 3c. THE ORDER BOOK AND THE BOT TRADERS (NEW) ----------
// How it works, every 2 seconds, for every stock:
//   1. The formula moves the stock's FAIR VALUE (what the mood and news justify).
//   2. Market makers cancel their old orders and post new ones around fair value:
//      buy orders (bids) just below it, sell orders (asks) just above it.
//   3. Bot traders send market orders that eat into those standing orders.
//   4. The price is the price of the LAST TRADE.
// You trade against the same book, so you pay the spread and push the price.

const LEVELS = 20; // price levels on each side of the book
const DEPTH_FACTOR = 0.25; // rupees waiting at each level = liquidity x this x mood
const HALF_SPREAD = 0.0005; // the market makers' cushion: 0.05% each side of fair
const PERM_FRAC = 0.3; // the share of YOUR order's move that sticks to fair value
const MIN_LOG = 0.4; // a bot order bigger than this x liquidity shows in the feed

// A wider spread and a thinner book mean the market is more nervous.
const SPREAD_MULT = { bull: 0.8, normal: 1, correction: 1.5, recovery: 1.3, bubble: 1.1, crash: 3 };
const DEPTH_MULT = { bull: 1.2, normal: 1, correction: 0.8, recovery: 0.8, bubble: 0.7, crash: 0.4 };
// How hard panic sellers and FOMO buyers trade in each mood (x liquidity per tick)
const PANIC = { bull: 0, normal: 0, correction: 0.25, recovery: 0, bubble: 0, crash: 0.8 };
const FOMO = { bull: 0.15, normal: 0, correction: 0, recovery: 0.3, bubble: 0.7, crash: 0 };

const BOTS = {
  noise: "Retail traders",
  trend: "Momentum funds",
  dip: "Value investors",
  panic: "Panic sellers",
  fomo: "FOMO buyers",
  arb: "Arbitrage desk",
};

// ---------- trading hours (like the real Indian market) ----------
// Open 9:30 am to 3:00 pm India time (IST), Monday to Friday. Closed on weekends.
// (Public holidays are not modelled.)
// To practise outside these hours, start the server with FORCE_OPEN=1.
const OPEN_MIN = 9 * 60 + 30; // minutes after midnight
const CLOSE_MIN = 15 * 60;
const IST_MS = 5.5 * 60 * 60 * 1000;
const FORCE_OPEN = process.env.FORCE_OPEN === "1";

// ---------- circuit breakers ----------
// Stock level: a price can only move this far from yesterday's close in a day.
const BAND = 0.2;
// Market level: if the main index (SANRIO 18) moves this far from yesterday's close,
// trading stops everywhere. mins = how long (null = for the rest of the day).
const BREAKERS = [
  { pct: 10, mins: 15 },
  { pct: 15, mins: 30 },
  { pct: 20, mins: null },
];

// ---------- company results ----------
// A company reports results about every 3000-7000 open ticks (roughly 1.5-4 hours of trading).
const REPORT_EVERY = 3000;
const REPORT_SPREAD = 4000;
const EARNINGS_REACTION = 0.5; // price reacts by this share of the "surprise"

const CANDLE_MS = 10 * 1000; // one candlestick covers 10 seconds
const MAX_OPEN_ORDERS = 20; // per user

// ---------- dividends ----------
// Every DIV_EVERY trading days a company pays one "quarter" of its yearly dividend.
// On that morning (the ex-date) the price drops by the dividend, because new buyers
// no longer get it. Everyone who owned the stock the night before is paid.
const DIV_EVERY = 5;

// With FORCE_OPEN (always-open demo mode) there is no real night, so a "day" is this long
const DEMO_DAY_MS = 20 * 60 * 1000;

// ---------- 4. NEWS EVENTS ----------
// impulse = size of the shock to that sector (0.04 = about 5% in total)
const EVENT_CHANCE = 0.04; // chance per tick, so roughly one every 50 seconds
const EVENTS = [
  { sector: "AI", impulse: -0.04, text: "AI bubble fears: investors pull money out of AI stocks" },
  { sector: "AI", impulse: 0.04, text: "Breakthrough AI model launched: AI stocks surge" },
  { sector: "Semiconductors", impulse: 0.04, text: "Global chip shortage: semiconductor demand soars" },
  { sector: "Semiconductors", impulse: -0.04, text: "Chip factories overbuilt: semiconductor prices slide" },
  { sector: "Defense", impulse: 0.04, text: "Border tensions rise: governments boost defense budgets" },
  { sector: "Defense", impulse: -0.035, text: "Peace talks succeed: defense orders get delayed" },
  { sector: "Consumer", impulse: 0.035, text: "Festival season: record consumer spending" },
  { sector: "Consumer", impulse: -0.035, text: "Inflation worries: shoppers cut back spending" },
  { sector: "Finance", impulse: 0.035, text: "Credit demand surges: banks report record lending" },
  { sector: "Finance", impulse: -0.04, text: "Loan defaults rise: bank shares slump" },
  { sector: "Healthcare", impulse: 0.035, text: "New drug approved: healthcare stocks rally" },
  { sector: "Healthcare", impulse: -0.035, text: "Drug price limits announced: healthcare stocks dip" },
];

// ---------- helpers ----------
// A "bell curve" random number: usually near 0, sometimes bigger.
function randn() {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clamp(x, low, high) {
  return Math.min(Math.max(x, low), high);
}

const r2 = (n) => Math.round(n * 100) / 100;
const roundTo = (x, t) => r2(Math.round(x / t) * t);
const nowStr = () => new Date().toLocaleTimeString();

// The smallest price step, like on a real exchange
function tickFor(price) {
  if (price < 500) return 0.05;
  if (price < 1500) return 0.1;
  if (price < 3000) return 0.25;
  return 0.5;
}

// 30 fake past prices so charts aren't empty when the server starts
function makeHistory(price) {
  const history = [];
  let p = price;
  for (let i = 0; i < 30; i++) {
    history.unshift({ time: new Date(Date.now() - i * 2000).toLocaleTimeString(), price: p });
    p = p / (1 + randn() * 0.003);
  }
  return history;
}

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// ---------- market state (lives in the server's memory) ----------
let mode = "normal";
let lastManual = 0; // when someone last changed the mood by hand
let news = []; // newest first
let trades = []; // recent notable orders, newest first
let clock = () => Date.now(); // only replaced by tests
export function setClockForTests(fn) {
  clock = fn;
}

// India time pieces for a moment in time (IST has no daylight saving)
function istInfo(ms) {
  const t = new Date(ms + IST_MS);
  return {
    dow: t.getUTCDay(), // 0 = Sunday
    mins: t.getUTCHours() * 60 + t.getUTCMinutes(),
    dayStart: Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) - IST_MS,
  };
}
function scheduledOpen(ms) {
  if (FORCE_OPEN) return true;
  const { dow, mins } = istInfo(ms);
  return dow >= 1 && dow <= 5 && mins >= OPEN_MIN && mins < CLOSE_MIN;
}
// when the schedule next flips between open and closed
function nextScheduleChange(ms) {
  const { dow, dayStart } = istInfo(ms);
  if (FORCE_OPEN) return ms + 60 * 60 * 1000;
  if (scheduledOpen(ms)) return dayStart + CLOSE_MIN * 60000;
  for (let d = 0; d < 8; d++) {
    const dw = (dow + d) % 7;
    const t = dayStart + d * 86400000 + OPEN_MIN * 60000;
    if (dw >= 1 && dw <= 5 && t > ms) return t;
  }
  return ms + 60 * 60 * 1000;
}

// state: "open", "halted" (circuit breaker) or "closed"
const startsOpen = scheduledOpen(clock());
const session = {
  state: startsOpen ? "open" : "closed",
  day: startsOpen ? 1 : 0, // trading days since the server started
  haltUntil: 0,
  haltReason: "",
};
let dayStartedAt = clock(); // when the current trading day began
let ticksOpen = 0; // ticks while the market was open
const breakerHit = {}; // which circuit breaker levels have fired today
const momentum = {};
for (const sector of Object.keys(SECTORS)) momentum[sector] = 0;

const market = STOCKS.map((s) => {
  const tick = tickFor(s.price);
  return {
    ...s,
    basePrice: s.price,
    fair: s.price, // what the formula says the stock is worth right now
    tick,
    step: Math.max(tick, roundTo(s.price * 0.001, tick)), // gap between book levels (~0.1%)
    marketCap: (s.price * s.shares) / 10, // in rupees crore (1 crore = 10 million)
    change: 0, // % change since the server started
    lastMove: 0, // % change over the last tick
    // what made up the last move, in %
    parts: { market: 0, sector: 0, spill: 0, noise: 0, flow: 0, you: 0 },
    youMove: 0, // % that real users' orders moved the price since the last tick
    flowBuy: 0, // rupees the bots bought last tick
    flowSell: 0, // rupees the bots sold last tick
    prevTickPrice: s.price,
    prevClose: s.price, // yesterday's closing price (day change and price limits use this)
    circuit: null, // "upper" or "lower" when the price is stuck at its daily limit
    eps: s.price / COMPANIES[s.symbol].pe, // company earnings per share (Rs)
    report: { nextAt: Math.floor(Math.random() * REPORT_EVERY) + 600, last: null },
    earn: 0, // price reaction to results, applied on the next tick
    lastClose: s.price,
    dayOpen: s.price,
    dayHigh: s.price,
    dayLow: s.price,
    volume: 0, // shares traded today
    candles: [], // 10-second candlesticks: { time, o, h, l, c, v }
    book: { bids: [], asks: [] },
    tape: [], // the latest trades
    history: makeHistory(s.price),
  };
});

const bySymbol = Object.fromEntries(market.map((s) => [s.symbol, s]));
const lowest = (s) => s.basePrice * 0.2;
const highest = (s) => s.basePrice * 5;

// ---------- indices ----------
// index value = 1000 x (sum of price x shares now) / (same sum at the start)
// Bigger companies count for more, like the real Nifty 50 and Sensex.
const sizeOf = (s) => s.price * s.shares;

const topSix = [...market]
  .sort((a, b) => sizeOf(b) - sizeOf(a))
  .slice(0, 6)
  .map((s) => s.symbol);

const indexDefs = [
  {
    id: "SANRIO18",
    name: `SANRIO ${market.length}`,
    broad: true,
    note: `All ${market.length} stocks, like the Nifty 50`,
    members: market.map((s) => s.symbol),
  },
  {
    id: "KITTY6",
    name: "KITTY 6",
    broad: true,
    note: "The 6 biggest companies, like the Sensex",
    members: topSix,
  },
  ...Object.keys(SECTORS).map((sector) => ({
    id: sector,
    name: SECTOR_INDEX_NAMES[sector],
    broad: false,
    note: `${sector} stocks only`,
    members: market.filter((s) => s.sector === sector).map((s) => s.symbol),
  })),
];

const indices = indexDefs.map((def) => {
  const baseCap = def.members.reduce(
    (sum, sym) => sum + bySymbol[sym].basePrice * bySymbol[sym].shares,
    0
  );
  const history = [];
  for (let i = 0; i < market[0].history.length; i++) {
    let cap = 0;
    for (const sym of def.members) cap += bySymbol[sym].history[i].price * bySymbol[sym].shares;
    history.push({ time: market[0].history[i].time, value: (1000 * cap) / baseCap });
  }
  return { ...def, baseCap, value: 1000, change: 0, sinceStart: 0, top: null, prevClose: 1000, lastClose: 1000, history };
});

// addPoint = true on a normal tick, false after an order (just refresh the last point)
function updateIndices(addPoint) {
  for (const ix of indices) {
    let cap = 0;
    let top = null;
    for (const sym of ix.members) {
      const s = bySymbol[sym];
      const size = s.price * s.shares;
      cap += size;
      if (!top || size > top.size) top = { symbol: sym, size };
    }
    ix.value = (1000 * cap) / ix.baseCap;
    ix.sinceStart = (ix.value / 1000 - 1) * 100;
    ix.change = (ix.value / ix.prevClose - 1) * 100; // today, measured from yesterday's close
    ix.top = { symbol: top.symbol, weight: (top.size / cap) * 100 };

    const point = { time: nowStr(), value: ix.value };
    if (addPoint) {
      ix.history.push(point);
      if (ix.history.length > 60) ix.history.shift();
    } else {
      ix.history[ix.history.length - 1] = point;
    }
  }
}

// ---------- the order book ----------
const bandLow = (s) => Math.max(lowest(s), s.prevClose * (1 - BAND));
const bandHigh = (s) => Math.min(highest(s), s.prevClose * (1 + BAND));

function setPrice(stock, next) {
  stock.price = clamp(next, bandLow(stock), bandHigh(stock));
  stock.change = (stock.price / stock.basePrice - 1) * 100;
  stock.marketCap = (stock.price * stock.shares) / 10;
  touch(stock);
}

// Keep the day's high/low and the current candlestick up to date
function touch(stock) {
  stock.dayHigh = Math.max(stock.dayHigh, stock.price);
  stock.dayLow = Math.min(stock.dayLow, stock.price);

  const bucket = Math.floor(Date.now() / CANDLE_MS);
  let c = stock.candles[stock.candles.length - 1];
  if (!c || c.b !== bucket) {
    c = { b: bucket, time: nowStr(), o: stock.price, h: stock.price, l: stock.price, c: stock.price, v: 0 };
    stock.candles.push(c);
    if (stock.candles.length > 40) stock.candles.shift();
  }
  c.h = Math.max(c.h, stock.price);
  c.l = Math.min(c.l, stock.price);
  c.c = stock.price;
}

// Market makers cancel their old orders and post fresh ones around fair value
function requote(stock) {
  const half = HALF_SPREAD * SPREAD_MULT[mode];
  const bid0 = roundTo(Math.floor((stock.fair * (1 - half)) / stock.tick) * stock.tick, stock.tick);
  let ask0 = roundTo(Math.ceil((stock.fair * (1 + half)) / stock.tick) * stock.tick, stock.tick);
  if (ask0 <= bid0) ask0 = r2(bid0 + stock.tick);

  const bids = [];
  const asks = [];
  for (let k = 0; k < LEVELS; k++) {
    // deeper levels hold more, and every level is a little random
    const value =
      stock.liquidity * DEPTH_FACTOR * DEPTH_MULT[mode] * (1 + 0.1 * k) * (0.7 + Math.random() * 0.6);
    const bp = r2(bid0 - k * stock.step);
    const ap = r2(ask0 + k * stock.step);
    // nobody can trade outside the daily price limit
    if (bp > stock.tick && bp >= bandLow(stock)) bids.push({ price: bp, qty: Math.max(1, Math.round(value / bp)) });
    if (ap <= bandHigh(stock)) asks.push({ price: ap, qty: Math.max(1, Math.round(value / ap)) });
  }
  // Close to a daily limit the normal levels can fall outside it. Keep one order at the
  // limit itself, so the price can always travel all the way to the limit.
  const depth = stock.liquidity * DEPTH_FACTOR * DEPTH_MULT[mode];
  if (bids.length === 0) {
    const p = roundTo(Math.ceil(bandLow(stock) / stock.tick) * stock.tick, stock.tick);
    bids.push({ price: p, qty: Math.max(1, Math.round(depth / p)) });
  }
  if (asks.length === 0) {
    const p = roundTo(Math.floor(bandHigh(stock) / stock.tick) * stock.tick, stock.tick);
    asks.push({ price: p, qty: Math.max(1, Math.round(depth / p)) });
  }
  stock.book = { bids, asks };
}

// Walk down a side of the book (best price first) to fill an order.
// Nothing changes here: it only works out what the order would get.
function walk(levels, qty) {
  let left = qty;
  let cost = 0;
  const fills = [];
  for (const level of levels) {
    if (left <= 0) break;
    const take = Math.min(left, level.qty);
    fills.push({ price: level.price, qty: take });
    cost += take * level.price;
    left -= take;
  }
  return {
    filled: qty - left,
    cost,
    fills,
    last: fills.length > 0 ? fills[fills.length - 1].price : null,
  };
}

// Make an order happen: use up the orders it hit and move the last price
// cap (optional) = a limit price: levels worse than this are not used
function usable(stock, side, cap) {
  const all = side === "buy" ? stock.book.asks : stock.book.bids;
  if (cap === null || cap === undefined) return all;
  return all.filter((l) => (side === "buy" ? l.price <= cap : l.price >= cap));
}

function execute(stock, side, qty, who, isUser, cap = null) {
  const levels = side === "buy" ? stock.book.asks : stock.book.bids;
  const w = walk(usable(stock, side, cap), qty);
  if (w.filled <= 0) return null;

  // the orders that were hit are used up (fills line up with the first levels)
  w.fills.forEach((f, i) => {
    levels[i].qty -= f.qty;
  });
  for (let i = levels.length - 1; i >= 0; i--) {
    if (levels[i].qty <= 0) levels.splice(i, 1);
  }

  const before = stock.price;
  setPrice(stock, w.last);
  const move = stock.price / before - 1;
  stock.volume += w.filled;
  stock.candles[stock.candles.length - 1].v += w.filled;

  if (isUser) {
    // part of what a real order does sticks, because it tells the market something
    stock.fair = clamp(stock.fair * (1 + PERM_FRAC * move), lowest(stock), highest(stock));
    stock.youMove += move * 100;
  }

  const avg = w.cost / w.filled;
  stock.tape.unshift({
    t: Date.now(),
    time: nowStr(),
    side,
    qty: w.filled,
    price: avg,
    who: isUser ? "A user" : BOTS[who],
  });
  stock.tape = stock.tape.slice(0, 8);

  return { qty: w.filled, avg, cost: w.cost, impactPct: move * 100, levels: w.fills.length };
}

// ---------- the bots ----------
// Each bot decides how much to buy or sell. Sizes are a share of the stock's liquidity.
function botOrders(stock) {
  const orders = [];
  const L = stock.liquidity;
  const half = HALF_SPREAD * SPREAD_MULT[mode];

  // gap > 0 means the price sits BELOW fair value
  const gap = (stock.fair - stock.price) / stock.fair;

  // Arbitrage desk: pulls the price back toward fair value
  if (Math.abs(gap) > half) {
    orders.push({ who: "arb", side: gap > 0 ? "buy" : "sell", value: clamp(Math.abs(gap) * 80, 0, 2) * 0.5 * L });
  }

  // Value investors: buy when the price is clearly below fair value
  if (gap > 0.002) {
    orders.push({ who: "dip", side: "buy", value: clamp(gap * 100, 0, 1.5) * 0.5 * L });
  }

  // Momentum funds: follow the last 10 ticks
  const h = stock.history;
  const reference = h[Math.max(0, h.length - 11)].price;
  const trend = stock.price / reference - 1;
  if (Math.abs(trend) > 0.001) {
    orders.push({ who: "trend", side: trend > 0 ? "buy" : "sell", value: clamp(Math.abs(trend) * 40, 0, 1) * 0.6 * L });
  }

  // Retail traders: small random orders, so there is always a trade
  orders.push({ who: "noise", side: Math.random() < 0.5 ? "buy" : "sell", value: Math.abs(randn()) * 0.15 * L, minQty: 1 });

  // Panic sellers and FOMO buyers depend on the mood
  if (PANIC[mode] > 0) {
    orders.push({ who: "panic", side: "sell", value: PANIC[mode] * (0.5 + Math.random() * 0.5) * L });
  }
  if (FOMO[mode] > 0) {
    orders.push({ who: "fomo", side: "buy", value: FOMO[mode] * (0.5 + Math.random() * 0.5) * L });
  }

  return shuffle(orders);
}

function addNews(item) {
  news.unshift({ time: nowStr(), ...item });
  news = news.slice(0, 5);
}

// Switch the mood and post a headline about it
function applyMode(newMode) {
  mode = newMode;
  addNews({ sector: "Market", text: MODE_HEADLINES[newMode], up: MODES[newMode].drift >= 0 });
}

// ---------- one tick of the market ----------
export function tick() {
  const now = clock();

  // Opening, closing and circuit-breaker halts
  if (!scheduledOpen(now)) {
    if (session.state !== "closed") closeMarket();
    return;
  }
  if (session.state === "closed") openMarket();
  if (FORCE_OPEN && session.state === "open" && now - dayStartedAt > DEMO_DAY_MS) {
    closeMarket(); // demo mode: end the "day" so closes, openings and dividends still happen
    openMarket();
  }
  if (session.state === "halted") {
    if (now < session.haltUntil) return; // trading is stopped, nothing moves
    session.state = "open";
    addNews({ sector: "Market", text: "Trading resumes after the circuit breaker halt", up: true });
  }
  ticksOpen += 1;

  // A bubble can pop into a crash all by itself
  if (mode === "bubble" && Math.random() < BUBBLE_POP_CHANCE) {
    mode = "crash";
    addNews({ sector: "Market", text: "The bubble bursts: panic selling begins across the market", up: false });
  } else if (Date.now() - lastManual > MANUAL_PAUSE_MS && Math.random() < AUTO_SHIFT_CHANCE) {
    // the market drifts into a new mood on its own
    const options = NEXT_MODES[mode];
    if (options.length > 0) {
      const next = options[Math.floor(Math.random() * options.length)];
      if (next !== mode) applyMode(next);
    }
  }

  const m = MODES[mode];
  const marketReturn = m.drift + randn() * m.vol;

  // 1. each sector's momentum fades a bit and gets a little random push
  for (const sector of Object.keys(SECTORS)) {
    momentum[sector] = momentum[sector] * 0.8 + randn() * 0.004;
  }

  // 2. maybe a news event hits one sector
  if (Math.random() < EVENT_CHANCE) {
    const e = EVENTS[Math.floor(Math.random() * EVENTS.length)];
    momentum[e.sector] += e.impulse;
    addNews({ sector: e.sector, text: e.text, up: e.impulse > 0 });
  }

  // 3. each sector's own movement this tick
  const own = {};
  for (const sector of Object.keys(SECTORS)) own[sector] = momentum[sector] * 0.25;

  // 4. every stock: formula moves fair value, makers requote, bots trade
  for (const stock of market) {
    let spill = 0;
    for (const [from, links] of Object.entries(LINKS)) {
      if (links[stock.sector]) spill += links[stock.sector] * own[from];
    }

    const marketPart = SECTORS[stock.sector].beta * marketReturn;
    const sectorPart = own[stock.sector];
    const noise = randn() * 0.002;

    // company results: now and then a company reports earnings and the price reacts
    let earnPart = stock.earn;
    stock.earn = 0;
    if (ticksOpen >= stock.report.nextAt) {
      earnPart += reportResults(stock);
    }

    const ret = marketPart + sectorPart + spill + noise + earnPart;

    stock.fair = clamp(stock.fair * (1 + ret), bandLow(stock), bandHigh(stock));

    requote(stock);

    stock.flowBuy = 0;
    stock.flowSell = 0;
    for (const o of botOrders(stock)) {
      let qty = Math.floor(o.value / stock.price);
      if (qty < 1 && o.minQty) qty = o.minQty;
      if (qty < 1) continue;
      qty = Math.min(qty, 100000);

      const r = execute(stock, o.side, qty, o.who, false);
      if (!r) continue;
      if (o.side === "buy") stock.flowBuy += r.cost;
      else stock.flowSell += r.cost;

      if (o.value >= MIN_LOG * stock.liquidity) {
        trades.unshift({
          time: nowStr(),
          symbol: stock.symbol,
          side: o.side,
          qty: r.qty,
          who: BOTS[o.who],
          impactPct: r.impactPct,
        });
      }
    }

    // the breakdown: formula parts + order flow (bots) + real users' orders = total
    stock.lastMove = (stock.price / stock.prevTickPrice - 1) * 100;
    const you = stock.youMove;
    stock.youMove = 0;
    const formula = (marketPart + sectorPart + spill + noise + earnPart) * 100;
    stock.parts = {
      earnings: earnPart * 100,
      market: marketPart * 100,
      sector: sectorPart * 100,
      spill: spill * 100,
      noise: noise * 100,
      flow: stock.lastMove - formula - you,
      you,
    };
    stock.prevTickPrice = stock.price;
    stock.circuit =
      stock.price >= bandHigh(stock) * 0.9995 ? "upper" : stock.price <= bandLow(stock) * 1.0005 ? "lower" : null;

    stock.history.push({ time: nowStr(), price: stock.price });
    if (stock.history.length > 60) stock.history.shift();
    touch(stock);
  }

  trades = trades.slice(0, 14);
  updateIndices(true);
  checkBreakers(now);
  checkPending();
}

// A company reports its results. Returns how much the price reacts (as a fraction).
function reportResults(stock) {
  const surprise = clamp(randn() * 7, -20, 20); // % better or worse than analysts expected
  const growth = 2 + surprise; // profit growth since last report, in %
  stock.eps *= 1 + growth / 100;
  stock.report.last = { surprise, growth, time: nowStr(), day: session.day };
  stock.report.nextAt = ticksOpen + REPORT_EVERY + Math.random() * REPORT_SPREAD;

  const up = surprise >= 0;
  addNews({
    sector: stock.sector,
    text: `${stock.name} reports results: profit ${growth >= 0 ? "up" : "down"} ${Math.abs(growth).toFixed(1)}%, ${up ? "beating" : "missing"} expectations by ${Math.abs(surprise).toFixed(1)}%`,
    up,
  });
  return (surprise / 100) * EARNINGS_REACTION;
}

// Market-wide circuit breaker: if the main index moves too far from yesterday's close
function checkBreakers(now) {
  const ix = indices[0];
  const move = Math.abs((ix.value / ix.prevClose - 1) * 100);
  for (let i = BREAKERS.length - 1; i >= 0; i--) {
    const level = BREAKERS[i];
    if (move < level.pct || breakerHit[level.pct]) continue;
    for (const l of BREAKERS) if (l.pct <= level.pct) breakerHit[l.pct] = true;

    const direction = ix.value >= ix.prevClose ? "up" : "down";
    const restOfDay = level.mins === null;
    const until = restOfDay
      ? FORCE_OPEN
        ? now + 60 * 60 * 1000
        : nextScheduleChange(now)
      : now + level.mins * 60 * 1000;
    session.state = "halted";
    session.haltUntil = until;
    session.haltReason = `${ix.name} is ${direction} ${level.pct}%: trading halted ${restOfDay ? "for the rest of the day" : `for ${level.mins} minutes`}`;
    addNews({ sector: "Market", text: `Circuit breaker: ${session.haltReason}`, up: direction === "up" });
    break;
  }
}

// ---------- the trading day ----------
function closeMarket() {
  session.state = "closed";
  for (const stock of market) stock.lastClose = stock.price;
  for (const ix of indices) ix.lastClose = ix.value;
  expireDayOrders();
  addNews({ sector: "Market", text: `Day ${session.day} is over: the market is closed`, up: true });
}

function openMarket() {
  session.state = "open";
  session.day += 1;
  for (const k of Object.keys(breakerHit)) delete breakerHit[k];
  dayStartedAt = clock();
  for (const ix of indices) ix.prevClose = ix.lastClose ?? ix.prevClose;
  payDividends();

  for (const stock of market) {
    // overnight news makes the price open away from yesterday's close (a "gap")
    const gap = randn() * 0.006 + SECTORS[stock.sector].beta * MODES[mode].drift * 8;
    stock.prevClose = stock.lastClose;
    stock.fair = clamp((stock.fair - (stock.exDiv || 0)) * (1 + gap), bandLow(stock), bandHigh(stock));
    requote(stock);
    stock.exDiv = 0;
    stock.dayOpen = stock.fair;
    stock.dayHigh = stock.fair;
    stock.dayLow = stock.fair;
    stock.volume = 0;
    stock.circuit = null;
    setPrice(stock, stock.fair);
    stock.prevTickPrice = stock.price;
    stock.history.push({ time: nowStr(), price: stock.price });
    if (stock.history.length > 60) stock.history.shift();
  }
  updateIndices(true);
  addNews({ sector: "Market", text: `Day ${session.day}: the market is open`, up: true });
}

// ---------- waiting orders ----------
// limit : waits until the price is good enough
// stop  : becomes a market order once the price reaches a trigger (a sell stop is a stop-loss)
// trail : a sell stop that follows the price UP but never down (a trailing stop-loss)
// validity: "day" expires at the close, "gtc" (good till cancelled) stays until it fills
// bracket: a buy plus a target (limit sell) and a stop-loss (stop sell) linked together.
//          When one exit fills, the other is cancelled (called OCO: one cancels the other).
let pending = [];
let orderSeq = 1;
let groupSeq = 1;
let orderEvents = []; // messages for users, newest first
let settler = null;

// index.js gives us helpers that know about wallets and holdings:
//   afford(order, qty, cost) -> true, or a text saying why not
//   fill(order, result)      -> moves the money and the shares
//   dividend(symbol, perShare) -> pays everyone who owns the stock
export function setSettler(s) {
  settler = s;
}

function logEvent(username, text) {
  orderEvents.unshift({ time: nowStr(), username, text });
  orderEvents = orderEvents.slice(0, 100);
}

function describe(o) {
  let kind = "Limit";
  if (o.exit === "target") kind = "Target";
  else if (o.type === "stop") kind = o.side === "sell" ? "Stop-loss" : "Stop";
  else if (o.type === "trail") kind = "Trailing stop";
  const where =
    o.type === "trail"
      ? ` (trails ${o.trailPct}%, now Rs ${o.price.toFixed(2)})`
      : ` at Rs ${o.price.toFixed(2)}`;
  return `${kind} ${o.side} ${o.qty} x ${o.symbol}${where}`;
}

// Check target and stop-loss against the price you expect to pay. Returns text if wrong.
export function validateBracket(symbol, ref, target, stop) {
  const stock = bySymbol[symbol];
  if (!stock) return "Unknown stock.";
  if (!Number.isFinite(target) || !Number.isFinite(stop) || target <= 0 || stop <= 0) {
    return "Enter both a target price and a stop-loss price.";
  }
  if (target <= ref) return "The target must be ABOVE your buying price.";
  if (stop >= ref) return "The stop-loss must be BELOW your buying price.";
  return null;
}

function newOrder(fields) {
  return { id: orderSeq++, remaining: fields.qty, placedAt: nowStr(), placedDay: session.day, ...fields };
}

export function placeOrder({ username, symbol, side, type, price, qty, validity, trailPct, bracket }) {
  const stock = bySymbol[symbol];
  if (!stock) return { ok: false, error: "Unknown stock." };
  if (side !== "buy" && side !== "sell") return { ok: false, error: "Unknown order side." };
  if (type !== "limit" && type !== "stop" && type !== "trail") {
    return { ok: false, error: "Unknown order type." };
  }
  if (!Number.isInteger(qty) || qty <= 0 || qty > 100000) {
    return { ok: false, error: "Enter a whole number of shares." };
  }
  if (validity !== undefined && validity !== "day" && validity !== "gtc") {
    return { ok: false, error: "Validity must be day or good-till-cancelled." };
  }
  if (pending.filter((o) => o.username === username).length >= MAX_OPEN_ORDERS) {
    return { ok: false, error: `You can have at most ${MAX_OPEN_ORDERS} open orders.` };
  }

  const fields = { username, symbol, side, type, qty, validity: validity ?? "day" };

  if (type === "trail") {
    if (side !== "sell") return { ok: false, error: "A trailing stop protects shares you own, so it is a sell order." };
    if (!Number.isFinite(trailPct) || trailPct < 0.5 || trailPct > 30) {
      return { ok: false, error: "The trail must be between 0.5% and 30%." };
    }
    fields.trailPct = trailPct;
    fields.high = stock.price; // the highest price seen since the order was placed
    fields.price = roundTo(stock.price * (1 - trailPct / 100), stock.tick);
  } else {
    if (!Number.isFinite(price) || price <= 0 || price > stock.basePrice * 10) {
      return { ok: false, error: "Enter a valid price." };
    }
    fields.price = roundTo(price, stock.tick);
  }

  if (bracket) {
    if (side !== "buy" || type !== "limit") {
      return { ok: false, error: "A bracket order is a limit buy with a target and a stop-loss." };
    }
    const bad = validateBracket(symbol, fields.price, bracket.target, bracket.stop);
    if (bad) return { ok: false, error: bad };
    fields.bracket = {
      target: roundTo(bracket.target, stock.tick),
      stop: roundTo(bracket.stop, stock.tick),
    };
  }

  const order = newOrder(fields);
  pending.push(order);
  return { ok: true, order };
}

// After shares are bought, protect them: a target (sell high) and a stop-loss (sell low),
// linked so that when one fills the other disappears. Calling it again with the same
// group adds more shares to the same pair (for orders that fill in several pieces).
export function attachExits({ username, symbol, qty, target, stop, validity, group }) {
  const stock = bySymbol[symbol];
  const existing = group ? pending.filter((o) => o.group === group) : [];
  if (existing.length > 0) {
    for (const o of existing) {
      o.qty += qty;
      o.remaining += qty;
    }
    return group;
  }
  const g = groupSeq++;
  const common = { username, symbol, side: "sell", qty, validity: validity ?? "day", group: g };
  pending.push(newOrder({ ...common, type: "limit", exit: "target", price: roundTo(target, stock.tick) }));
  pending.push(newOrder({ ...common, type: "stop", exit: "stoploss", price: roundTo(stop, stock.tick) }));
  return g;
}

export function cancelOrder(id, username) {
  const order = pending.find((o) => o.id === id && o.username === username);
  if (!order) return false;
  pending = pending.filter((o) => o !== order);
  return true;
}

export function listOrders(username) {
  return {
    open: pending.filter((o) => o.username === username),
    events: orderEvents.filter((e) => e.username === username).slice(0, 6),
  };
}

// At the close, day orders that did not run are cancelled
function expireDayOrders() {
  const gone = pending.filter((o) => o.validity === "day");
  if (gone.length === 0) return;
  pending = pending.filter((o) => o.validity !== "day");
  for (const o of gone) logEvent(o.username, `${describe(o)} expired at the close (it was a day order)`);
}

// Pay one quarter of the yearly dividend to every holder; the price drops by the same amount
function payDividends() {
  if (session.day % DIV_EVERY !== 0) return;
  for (const stock of market) {
    const yearly = COMPANIES[stock.symbol].divYield;
    if (!yearly) continue;
    const perShare = roundTo((stock.lastClose * yearly) / 100 / 4, 0.01);
    if (perShare <= 0) continue;
    stock.lastClose = Math.max(stock.tick, stock.lastClose - perShare); // yesterday's close, adjusted
    stock.exDiv = perShare;
    if (settler?.dividend) settler.dividend(stock.symbol, perShare);
    addNews({
      sector: stock.sector,
      text: `${stock.name} pays a dividend of Rs ${perShare.toFixed(2)} per share; the price adjusts down by the same amount`,
      up: true,
    });
  }
}

function checkPending() {
  if (session.state !== "open" || !settler) return;
  for (const o of [...pending]) {
    if (!pending.includes(o)) continue; // cancelled earlier in this loop (OCO)
    const stock = bySymbol[o.symbol];
    let cap = null;

    if (o.type === "trail" && stock.price > o.high) {
      o.high = stock.price; // the stop climbs with the price and never comes back down
      o.price = roundTo(o.high * (1 - o.trailPct / 100), stock.tick);
    }

    if (o.type === "limit") {
      const best = (o.side === "buy" ? stock.book.asks : stock.book.bids)[0];
      if (!best) continue;
      const good = o.side === "buy" ? best.price <= o.price : best.price >= o.price;
      if (!good) continue;
      cap = o.price; // never pay more (or sell for less) than the limit
    } else {
      const hit = o.side === "sell" ? stock.price <= o.price : stock.price >= o.price;
      if (!hit) continue;
    }

    const w = walk(usable(stock, o.side, cap), o.remaining);
    if (w.filled <= 0) continue;

    const ok = settler.afford(o, w.filled, w.cost);
    if (ok !== true) {
      pending = pending.filter((x) => x.id !== o.id);
      logEvent(o.username, `${describe(o)} was cancelled: ${ok}`);
      continue;
    }

    const r = execute(stock, o.side, w.filled, "user", true, cap);
    if (!r) continue;
    stock.history[stock.history.length - 1] = { time: nowStr(), price: stock.price };
    recordUserTrade(stock, o.side, r);
    settler.fill(o, r);
    o.remaining -= r.qty;

    // a bracket entry protects whatever part of it has filled
    if (o.bracket) {
      o.exitGroup = attachExits({
        username: o.username,
        symbol: o.symbol,
        qty: r.qty,
        target: o.bracket.target,
        stop: o.bracket.stop,
        validity: o.validity,
        group: o.exitGroup,
      });
    }
    // when one exit fills, the other shrinks with it (or disappears)
    if (o.group) {
      for (const sib of pending) {
        if (sib.group === o.group && sib.id !== o.id) sib.remaining = o.remaining;
      }
      if (o.remaining <= 0) pending = pending.filter((x) => x.group !== o.group);
    }

    if (o.remaining <= 0) {
      pending = pending.filter((x) => x.id !== o.id);
      const extra = o.group ? " The linked order was cancelled." : "";
      logEvent(o.username, `${describe(o)} was filled at an average of Rs ${r.avg.toFixed(2)}.${extra}`);
    }
  }
  updateIndices(false);
}

function recordUserTrade(stock, side, result) {
  trades.unshift({
    time: nowStr(),
    symbol: stock.symbol,
    side,
    qty: result.qty,
    who: "A user",
    impactPct: result.impactPct,
  });
  trades = trades.slice(0, 14);
}

// ---------- your orders ----------
// Step 1: ask what an order WOULD get. Nothing changes.
export function previewOrder(symbol, side, qty) {
  const stock = bySymbol[symbol];
  if (!stock) return null;

  const levels = side === "buy" ? stock.book.asks : stock.book.bids;
  const available = levels.reduce((sum, l) => sum + l.qty, 0);
  const w = walk(levels, qty);
  if (w.filled < qty) return { ok: false, available };

  return {
    ok: true,
    symbol,
    side,
    qty,
    cost: w.cost,
    avg: w.cost / qty,
    bestPrice: levels[0].price,
    endPrice: w.last,
    impactPct: (w.last / stock.price - 1) * 100,
    levels: w.fills.length,
  };
}

// Step 2: make it happen. The price moves for everyone.
export function executeOrder(symbol, side, qty) {
  const stock = bySymbol[symbol];
  if (!stock) return null;
  const result = execute(stock, side, qty, "user", true);
  if (result) {
    stock.history[stock.history.length - 1] = { time: nowStr(), price: stock.price };
    updateIndices(false);
    recordUserTrade(stock, side, result);
  }
  return result;
}

// ---------- what index.js uses ----------
export function isOpen() {
  return session.state === "open";
}

// Why the market is not open (used for messages)
export function marketState() {
  return { state: session.state, reason: session.haltReason };
}

export function startMarket() {
  for (const stock of market) requote(stock);
  setInterval(tick, 2000);
}

// How far a Rs 10,000 order would move the price right now (in %)
function impactFor(stock, side) {
  const qty = Math.max(1, Math.round(10000 / stock.price));
  const levels = side === "buy" ? stock.book.asks : stock.book.bids;
  const w = walk(levels, qty);
  if (w.filled < qty) return null;
  return (w.last / stock.price - 1) * 100;
}

// Company facts that change over time (price/earnings moves with the price)
function companyInfo(s) {
  const c = COMPANIES[s.symbol];
  const profitCr = (s.eps * s.shares) / 10; // shares are in millions, 10 million = 1 crore
  return {
    inspired: c.inspired,
    founded: c.founded,
    hq: c.hq,
    desc: c.desc,
    divYield: c.divYield,
    eps: s.eps,
    pe: s.price / s.eps,
    profitCr,
    revenueCr: profitCr / c.margin,
    margin: c.margin * 100,
    last: s.report.last,
  };
}

function publicStock(s) {
  const top = (levels) => levels.slice(0, 10).map((l) => [l.price, l.qty]);
  return {
    ...s,
    book: { bids: top(s.book.bids), asks: top(s.book.asks) },
    bestBid: s.book.bids.length ? s.book.bids[0].price : null,
    bestAsk: s.book.asks.length ? s.book.asks[0].price : null,
    dayChange: (s.price / s.prevClose - 1) * 100,
    limits: { low: bandLow(s), high: bandHigh(s) },
    company: companyInfo(s),
    buyImpact: impactFor(s, "buy"),
    sellImpact: impactFor(s, "sell"),
  };
}

export function getMarket() {
  return {
    mode,
    news,
    trades,
    session: {
      open: session.state === "open",
      state: session.state,
      day: session.day,
      reason: session.state === "halted" ? session.haltReason : "",
      forced: FORCE_OPEN,
      remainingMs: Math.max(
        0,
        (session.state === "halted" ? session.haltUntil : nextScheduleChange(clock())) - clock()
      ),
    },
    stocks: market.map(publicStock),
    indices: indices.map((ix) => ({
      id: ix.id,
      name: ix.name,
      broad: ix.broad,
      note: ix.note,
      count: ix.members.length,
      value: ix.value,
      change: ix.change,
      sinceStart: ix.sinceStart,
      top: ix.top,
      history: ix.history,
    })),
  };
}

// Called when a user presses a mood button
export function setMode(newMode) {
  if (!Object.hasOwn(MODES, newMode)) return false;
  lastManual = Date.now();
  if (newMode !== mode) applyMode(newMode);
  return true;
}

// the book starts full, so the first order has something to trade against
for (const stock of market) {
  requote(stock);
  touch(stock);
}
updateIndices(false);
