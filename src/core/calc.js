export function computeCost({ size, qualityKey, options, market }) {
  const q = market.quality[qualityKey];
  const baseFitOutRate = q.rate;              // Fit-Out base rate (excl. MEP)
  const fitOutBase = size * baseFitOutRate;

  const mepPct = Number(market.mepPctOfBase || 0);  // e.g., 0.22 = 22% of Fit-Out base
  const mepBase = fitOutBase * mepPct;

  // Base (ex-options) = Fit-Out base + MEP base
  const base = fitOutBase + mepBase;

  // Options adder
  let adders = 0;
  const breakdown = {
    baseFitOut: fitOutBase,
    mepBase: mepBase
  };

  for (const key of options) {
    const opt = market.options[key];
    if (!opt) continue;
    const v = size * (opt.rate || 0);
    adders += v;
    breakdown[key] = v;
  }

  const total = base + adders;
  return {
    base,            // ex-options
    total,           // with options
    perSqft: total / size,
    breakdown        // includes baseFitOut + mepBase + each option
  };
}
