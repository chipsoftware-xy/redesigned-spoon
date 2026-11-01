// Fake brokerage, taxes and charges. The rates are modelled on how Indian
// delivery trades are charged, but they are simplified and NOT real advice.
// Change the numbers here to experiment.

const round2 = (n) => Math.round(n * 100) / 100;

export const CAPITAL_GAINS_RATE = 0.2; // simplified flat tax on profit when you sell

// value = rupees of shares in the order
export function chargesFor(side, value) {
  const brokerage = Math.min(20, value * 0.0003); // 0.03% or Rs 20, whichever is lower
  const stt = value * 0.001; // securities transaction tax: 0.1% on buys AND sells
  const exchange = value * 0.0000297; // the exchange's fee
  const sebi = value * 0.000001; // the regulator's fee (Rs 10 per crore)
  const gst = (brokerage + exchange + sebi) * 0.18; // 18% GST on the fees above
  const stamp = side === "buy" ? value * 0.00015 : 0; // stamp duty, buyers only
  const total = brokerage + stt + exchange + sebi + gst + stamp;
  return {
    brokerage: round2(brokerage),
    stt: round2(stt),
    exchange: round2(exchange + sebi),
    gst: round2(gst),
    stamp: round2(stamp),
    total: round2(total),
  };
}

// Tax on a sale: a share of the profit (after charges). No tax on a loss.
export function taxOnSale(proceeds, chargesTotal, costBasis) {
  const profit = proceeds - chargesTotal - costBasis;
  return profit > 0 ? round2(profit * CAPITAL_GAINS_RATE) : 0;
}
