<script>
/* Geo-adjusted unit rates for TRDB Estimator (industry-benchmark provenance only) */
(function () {
  async function loadJSON(path) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load ${path}`);
    return res.json();
  }

  let RATES = null, ZONES = null;
  async function ensureData() {
    if (!RATES) RATES = await loadJSON("./public/rates.json");
    if (!ZONES) ZONES = await loadJSON("./public/zones.json");
  }

  async function listCities(country) {
    await ensureData();
    return Array.from(new Set(RATES.filter(r => r.country === country).map(r => r.city))).sort();
  }

  async function listZones(country, city) {
    await ensureData();
    const cz = ZONES?.[country]?.[city];
    if (!cz) return { zones: [], tiers: {}, zoneTier: {} };
    return { zones: Object.keys(cz.zones), tiers: cz.tiers, zoneTier: cz.zones };
  }

  async function getUnitRates({ country, city, zone = null, quality }) {
    await ensureData();
    const row = RATES.find(r => r.country === country && r.city === city && r.quality === quality);
    if (!row) throw new Error(`No baseline for ${country}/${city}/${quality}`);

    let factor = 1.0;                 // zone factor (default)
    const cz = ZONES?.[country]?.[city];
    if (cz && zone && cz.zones[zone]) {
      const tier = cz.zones[zone];
      factor = cz.tiers[tier] ?? 1.0;
    }

    const timeFactor = 1.000;         // reserved for future monthly escalation
    const f = factor * timeFactor;

    return {
      currency: row.currency,
      as_of: row.as_of,
      provenance: row.provenance,
      unit_min: Math.round(row.unit_min * f),
      unit_ml:  Math.round(row.unit_ml  * f),
      unit_max: Math.round(row.unit_max * f)
    };
  }

  function computeTotals(unit, sizeFt2, options = {}) {
    const uplift = Object.values(options).reduce((a, b) => a + (b || 0), 0);
    const m = (x) => Math.round(x * sizeFt2 * (1 + uplift));
    return {
      min: m(unit.unit_min),
      ml:  m(unit.unit_ml),
      max: m(unit.unit_max),
      perFt2: {
        min: Math.round(unit.unit_min * (1 + uplift)),
        ml:  Math.round(unit.unit_ml  * (1 + uplift)),
        max: Math.round(unit.unit_max * (1 + uplift))
      }
    };
  }

  window.GeoRates = { listCities, listZones, getUnitRates, computeTotals };
})();
</script>
