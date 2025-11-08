// =============================
// src/ui/bindings.js  (FULL REPLACEMENT)
// =============================
import { MarketSchema } from '../core/schema.js';
import { fmt } from '../core/format.js';
import { computeCost } from '../core/calc.js';
import { renderChart } from './chart.js';
import { exportPdf } from './pdf.js';
import { openLeadModal } from './lead.js';
import { track } from '../core/ga.js';

export const state = {
  marketId: 'uae-dubai',
  market: null,
  unit: 'SqFt',
  sizeSqFt: 4900,
  quality: 'standard',
  options: new Set()
};

const SQFT_PER_M2 = 10.7639;

export async function loadMarket(id) {
  const res = await fetch(`/public/data/markets/${id}.json`, { cache: 'no-cache' });
  const json = await res.json();
  MarketSchema.validate(json);
  state.marketId = id;
  state.market = json;
}

// ---------- simple modal helpers (no HTML changes required) ----------
function ensureModalRoot() {
  let root = document.getElementById('modalRoot');
  if (root) return root;
  root = document.createElement('div');
  root.id = 'modalRoot';
  root.style.position = 'fixed';
  root.style.inset = '0';
  root.style.zIndex = '9999';
  root.style.display = 'none';
  root.style.alignItems = 'center';
  root.style.justifyContent = 'center';
  root.style.background = 'rgba(0,0,0,0.5)';
  document.body.appendChild(root);
  return root;
}

function closeModal() {
  const root = ensureModalRoot();
  root.style.display = 'none';
  root.innerHTML = '';
  document.body.style.overflow = ''; // restore page scroll
}

function openBreakdownModal({ calc, market }) {
  const root = ensureModalRoot();
  root.innerHTML = '';

  // container
  const panel = document.createElement('div');
  panel.style.maxWidth = '1100px';
  panel.style.width = '92vw';
  panel.style.maxHeight = '80vh';
  panel.style.overflow = 'auto';
  panel.style.background = '#0f2a36';            // your dark brand bg
  panel.style.color = '#fff';
  panel.style.borderRadius = '18px';
  panel.style.boxShadow = '0 12px 32px rgba(0,0,0,.35)';
  panel.style.padding = '28px';
  panel.style.position = 'relative';

  // header
  const h = document.createElement('div');
  h.style.display = 'flex';
  h.style.alignItems = 'center';
  h.style.justifyContent = 'space-between';
  h.style.marginBottom = '16px';

  const title = document.createElement('h2');
  title.textContent = 'Cost Breakdown';
  title.style.fontSize = '28px';
  title.style.margin = '0';
  title.style.letterSpacing = '.3px';

  const btnX = document.createElement('button');
  btnX.textContent = '×';
  btnX.setAttribute('aria-label', 'Close');
  btnX.style.cursor = 'pointer';
  btnX.style.fontSize = '26px';
  btnX.style.lineHeight = '1';
  btnX.style.border = 'none';
  btnX.style.borderRadius = '12px';
  btnX.style.width = '40px';
  btnX.style.height = '40px';
  btnX.style.color = '#0f2a36';
  btnX.style.background = '#fff';

  btnX.addEventListener('click', closeModal);

  h.appendChild(title);
  h.appendChild(btnX);
  panel.appendChild(h);

  // table (totals and options)
  const cur = market.currency || 'AED';
  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.style.marginBottom = '18px';

  const thRow = document.createElement('tr');
  const thItem = document.createElement('th');
  const thAmt = document.createElement('th');
  thItem.textContent = 'Item';
  thAmt.textContent = 'Amount';
  thItem.style.textAlign = 'left';
  thAmt.style.textAlign = 'right';
  thItem.style.padding = '12px 10px';
  thAmt.style.padding = '12px 10px';
  thItem.style.fontSize = '16px';
  thAmt.style.fontSize = '16px';
  thItem.style.borderBottom = '1px solid rgba(255,255,255,.15)';
  thAmt.style.borderBottom = '1px solid rgba(255,255,255,.15)';
  thRow.appendChild(thItem);
  thRow.appendChild(thAmt);
  table.appendChild(thRow);

  const addRow = (label, val, bold=false) => {
    const tr = document.createElement('tr');
    const tdL = document.createElement('td');
    const tdR = document.createElement('td');
    tdL.textContent = label;
    tdR.textContent = fmt.currency(val, cur, 'en');
    tdL.style.padding = '12px 10px';
    tdR.style.padding = '12px 10px';
    tdR.style.textAlign = 'right';
    if (bold) { tdL.style.fontWeight = '700'; tdR.style.fontWeight = '700'; }
    table.appendChild(tr);
    tr.appendChild(tdL);
    tr.appendChild(tdR);
  };

  addRow('Fit-Out (Base)', calc.breakdown.baseFitOut);
  addRow('MEP (Base)',     calc.breakdown.mepBase);
  addRow('Base (ex-options)', calc.base, true);

  // Selected options (only those toggled)
  const selected = Object.keys(calc.breakdown)
    .filter(k => !['baseFitOut','mepBase'].includes(k));

  for (const k of selected) {
    const slice = market.slices?.[k];
    addRow(slice?.label || k, calc.breakdown[k]);
  }

  // Total
  addRow('Total (with options)', calc.total, true);

  panel.appendChild(table);

  // Fit-Out vs MEP includes (side by side)
  const includes = document.createElement('div');
  includes.style.display = 'grid';
  includes.style.gridTemplateColumns = '1fr 1fr';
  includes.style.gap = '24px';
  includes.style.marginTop = '8px';

  const col = (titleText, items) => {
    const box = document.createElement('div');
    box.style.background = 'rgba(255,255,255,.06)';
    box.style.borderRadius = '14px';
    box.style.padding = '16px 18px';

    const ttl = document.createElement('h3');
    ttl.textContent = titleText;
    ttl.style.margin = '0 0 10px';
    ttl.style.fontSize = '18px';

    const ul = document.createElement('ul');
    ul.style.margin = '0';
    ul.style.padding = '0 0 0 20px';
    ul.style.lineHeight = '1.45';

    items.forEach(t => {
      const li = document.createElement('li');
      li.textContent = t;
      ul.appendChild(li);
    });

    box.appendChild(ttl);
    box.appendChild(ul);
    return box;
  };

  // These bullets are what you already show on the LHS by default
  const fitOutBullets = [
    'Partitions, doors & feature walls',
    'Suspend/feature ceilings, lighting fixtures',
    'Flooring & raised access floor adaptions',
    'Reception & pantry/joinery allowances',
    'Contractor preliminaries, HS&E, OHP'
  ];

  const mepBullets = [
    'HVAC distribution from landlord interface',
    'Electrical distribution, small power, emergency',
    'Lighting controls / fire alarm tie-ins',
    'Plumbing to pantry/restrooms',
    'Basic BMS integration (where applicable)'
  ];

  includes.appendChild(col('Fit-Out (Base) includes', fitOutBullets));
  includes.appendChild(col('MEP (Base) includes', mepBullets));
  panel.appendChild(includes);

  // bottom close
  const btm = document.createElement('div');
  btm.style.display = 'flex';
  btm.style.justifyContent = 'flex-end';
  btm.style.marginTop = '18px';

  const btnClose = document.createElement('button');
  btnClose.textContent = 'Close';
  btnClose.style.cursor = 'pointer';
  btnClose.style.border = 'none';
  btnClose.style.borderRadius = '10px';
  btnClose.style.padding = '10px 16px';
  btnClose.style.background = '#fff';
  btnClose.style.color = '#0f2a36';
  btnClose.style.fontWeight = '700';
  btnClose.addEventListener('click', closeModal);

  btm.appendChild(btnClose);
  panel.appendChild(btm);

  // open
  root.appendChild(panel);
  root.style.display = 'flex';
  document.body.style.overflow = 'hidden'; // lock page scroll while modal is open

  // click outside closes
  root.addEventListener('click', (e) => {
    if (e.target === root) closeModal();
  }, { once: true });

  // ESC key closes
  const onKey = (e) => { if (e.key === 'Escape') { closeModal(); window.removeEventListener('keydown', onKey); } };
  window.addEventListener('keydown', onKey);
}

// ---------- UI bindings ----------
export function bindUi() {
  const $ = s => document.querySelector(s);
  const elMarket = $('#marketSelect'),
        elRange  = $('#sizeRange'),
        elInput  = $('#sizeInput');

  const btnMinus = $('#sizeMinus'),
        btnPlus  = $('#sizePlus'),
        btnSqft  = $('#btn-sqft'),
        btnM2    = $('#btn-m2');

  const chipPer  = $('#chipPerSqft'),
        chipSize = $('#chipSize'),
        chipLoc  = $('#chipLocation');

  const totalFig = $('#totalFigure'),
        kpiBase  = $('#kpiBase'),
        kpiTotal = $('#kpiTotal');

  const ctx = document.getElementById('breakdownChart').getContext('2d');

  // keep last calculation for "View Details"
  let lastCalc = null;

  function displaySize() {
    return state.unit === 'm2' ? Math.round(state.sizeSqFt / SQFT_PER_M2) : state.sizeSqFt;
  }

  function syncSize(toValue) {
    let val = Number(toValue);
    if (!Number.isFinite(val)) return;
    if (state.unit === 'm2') val = Math.round(val * SQFT_PER_M2);
    state.sizeSqFt = Math.max(250, Math.min(20000, val));
    elRange.value = state.sizeSqFt;
    elInput.value = displaySize();
    recalc();
    track('change_size', { sizeSqFt: state.sizeSqFt, unit: state.unit });
  }

  function recalc() {
    const opts = Array.from(state.options);
    const r = computeCost({ size: state.sizeSqFt, qualityKey: state.quality, options: opts, market: state.market });
    lastCalc = r;

    const cur = state.market.currency;
    const loc = 'en';

    totalFig.textContent = fmt.currency(r.total, cur, loc);
    chipPer.textContent  = `${fmt.number(Math.round(r.perSqft))} ${cur}/SqFt`;
    chipSize.textContent = `${fmt.number(state.sizeSqFt)} SqFt`;
    chipLoc.textContent  = state.marketId.replace(/-/g, ' ').toUpperCase();
    kpiBase.textContent  = `${fmt.currency(r.base, cur, loc)} | ${fmt.number(Math.round(r.base / state.sizeSqFt))} ${cur}/SqFt`;
    kpiTotal.textContent = fmt.currency(r.total, cur, loc);

    renderChart(ctx, r.breakdown, state.market);
  }

  // market & units
  elMarket.addEventListener('change', async e => {
    await loadMarket(e.target.value);
    recalc();
    track('change_market', { marketId: state.marketId });
  });

  btnSqft.addEventListener('click', () => {
    if (state.unit === 'SqFt') return;
    state.unit = 'SqFt';
    btnSqft.classList.add('active');
    btnM2.classList.remove('active');
    elInput.value = displaySize();
  });

  btnM2.addEventListener('click', () => {
    if (state.unit === 'm2') return;
    state.unit = 'm2';
    btnM2.classList.add('active');
    btnSqft.classList.remove('active');
    elInput.value = displaySize();
  });

  // size controls
  elRange.addEventListener('input', e => syncSize(e.target.value));
  elInput.addEventListener('change', e => syncSize(e.target.value));
  btnMinus.addEventListener('click', () => syncSize(displaySize() - 50));
  btnPlus.addEventListener('click', () => syncSize(displaySize() + 50));
  document.querySelectorAll('.quick-chips [data-size]').forEach(btn => {
    btn.addEventListener('click', () => {
      const sqft = Number(btn.dataset.size);
      const uiVal = (state.unit === 'm2') ? Math.round(sqft / SQFT_PER_M2) : sqft;
      syncSize(uiVal);
    });
  });

  // quality & options
  document.querySelectorAll('input[name="quality"]').forEach(r => {
    r.addEventListener('change', () => {
      state.quality = r.value;
      recalc();
      track('change_quality', { quality: state.quality });
    });
  });

  document.querySelectorAll('.options input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) state.options.add(cb.value);
      else state.options.delete(cb.value);
      recalc();
      track('toggle_option', { key: cb.value, checked: cb.checked });
    });
  });

  // CTAs
  const btnPdf = document.getElementById('btnPdf');
  const btnEmail = document.getElementById('btnEmail');
  const btnWhatsApp = document.getElementById('btnWhatsApp');
  const btnViewDetails = document.getElementById('btnViewDetails');

  // make sure they show pointer cursor even if CSS misses it
  [btnPdf, btnEmail, btnWhatsApp, btnViewDetails].forEach(b => { if (b) b.style.cursor = 'pointer'; });

  btnPdf?.addEventListener('click', () => {
    exportPdf({ rootEl: document.querySelector('main') });
    track('export_pdf');
  });

  btnEmail?.addEventListener('click', () => {
    const payload = { marketId: state.marketId, sizeSqFt: state.sizeSqFt, quality: state.quality, options: Array.from(state.options) };
    openLeadModal(payload);
    track('open_lead');
  });

  btnWhatsApp?.addEventListener('click', () => {
    const msg = `TRDB Estimate — ${state.marketId.toUpperCase()}, ${state.sizeSqFt} SqFt, ${state.quality}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    track('open_whatsapp');
  });

  btnViewDetails?.addEventListener('click', () => {
    if (!lastCalc || !state.market) return;
    openBreakdownModal({ calc: lastCalc, market: state.market });
    track('open_breakdown');
  });

  // initial render
  elInput.value = displaySize();
  recalc();
}
