// src/ui/pdf.js
//
// Brand-polished PDF export
// - Builds a clean print DOM (header, summary chips, two-column cost + inclusions, footer)
// - Splits tall content into multiple PDF pages
// - Uses existing global libs: html2canvas and jsPDF (loaded in index.html)

function fmtCurrency(amount, currency = "AED", locale = "en") {
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    amount
  );
}
function fmtNumber(n) {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US").format(n);
}

// Build a detached DOM for the PDF so we don't depend on page CSS.
function buildPdfDom({ state, market, result }) {
  const wrapper = document.createElement("div");
  wrapper.className = "pdf-doc";

  const css = `
  .pdf-doc{ font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#0b2533; }
  .pdf-page{ width: 794px; /* A4 width @ 96dpi */ padding: 28px 32px 36px; box-sizing: border-box; background:#fff; }
  .pdf-header{ display:flex; align-items:center; gap:16px; margin-bottom:18px; }
  .pdf-header .logo{ height:38px; width:auto; }
  .pdf-title{ font-size:22px; font-weight:800; letter-spacing:.3px; margin:0; }
  .muted{ color:#5a7383; font-weight:500; }
  .meta{ display:flex; gap:10px; flex-wrap:wrap; margin:12px 0 18px; }
  .chip{ background:#0f3446; color:#fff; border-radius:999px; padding:8px 12px; font-size:12px; font-weight:700; white-space:nowrap; }
  .chip.alt{ background:#e87722; }
  .h2{ font-size:16px; font-weight:800; margin:18px 0 10px; }
  .table{ width:100%; border-collapse:collapse; font-size:13.5px; }
  .table th{ text-align:left; color:#96a7b2; font-weight:800; padding:10px 10px; border-bottom:2px solid #e7eef2; }
  .table td{ padding:12px 10px; border-bottom:1px solid #edf3f6; }
  .table td.amt, .table th.amt{ text-align:right; }
  .row-strong td{ font-weight:800; }
  .grid{ display:grid; grid-template-columns:1fr 1fr; gap:18px; margin-top:16px; }
  .grid h3{ font-size:14px; margin:0 0 8px; font-weight:800; }
  .grid ul{ margin:0; padding-left:18px; line-height:1.45; }
  .footer{ margin-top:18px; padding-top:10px; border-top:1px solid #e7eef2; font-size:12px; color:#5a7383; display:flex; justify-content:space-between; align-items:center; }
  .small{ font-size:12px; }
  .badge{ font-weight:800; color:#0f3446; }
  .nowrap{ white-space:nowrap; }

  /* Page breaks for the long content when rasterizing -> jsPDF multipage */
  .section{ break-inside: avoid; page-break-inside: avoid; }
  `;

  const style = document.createElement("style");
  style.textContent = css;
  wrapper.appendChild(style);

  // ---------- Page 1 ----------
  const page1 = document.createElement("section");
  page1.className = "pdf-page";

  // Header
  const header = document.createElement("div");
  header.className = "pdf-header";
  header.innerHTML = `
    <img class="logo" src="/public/assets/trdb-logo.png" alt="TR Design Build" />
    <div>
      <h1 class="pdf-title">TRDB Fitout Cost Estimator</h1>
      <div class="muted small">Shareable estimate — generated ${new Date().toLocaleDateString()}</div>
    </div>
  `;
  page1.appendChild(header);

  // Summary chips
  const per = Math.round(result.perSqft);
  const chips = document.createElement("div");
  chips.className = "meta";
  chips.innerHTML = `
    <span class="chip alt">${fmtCurrency(result.total, market.currency)} Total</span>
    <span class="chip">${fmtNumber(state.sizeSqFt)} SqFt</span>
    <span class="chip">${per} ${market.currency}/SqFt</span>
    <span class="chip">${state.marketId.replace(/-/g, " ").toUpperCase()}</span>
    <span class="chip">Quality: ${state.quality.toUpperCase()}</span>
  `;
  page1.appendChild(chips);

  // Cost table
  const table = document.createElement("table");
  table.className = "table section";
  const tbody = document.createElement("tbody");

  const rows = [];

  // Base slices
  rows.push(["Fit-Out (Base)", result.breakdown.baseFitOut]);
  rows.push(["MEP (Base)", result.breakdown.mepBase]);

  // Options (in market.options order)
  const opted = new Set(state.options);
  for (const key of Object.keys(market.options)) {
    if (!opted.has(key)) continue;
    const label = market.slices?.[key]?.label || market.options[key]?.label || key;
    rows.push([label, result.breakdown[key] || 0]);
  }

  // Build thead/tfoot
  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>Item</th>
      <th class="amt">Amount</th>
    </tr>`;
  table.appendChild(thead);

  rows.forEach(([label, amount]) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${label}</td>
      <td class="amt">${fmtCurrency(amount, market.currency)}</td>`;
    tbody.appendChild(tr);
  });

  // Base & Total summary
  const tfoot = document.createElement("tfoot");
  tfoot.innerHTML = `
    <tr class="row-strong">
      <td>Base (ex-options)</td>
      <td class="amt">${fmtCurrency(result.base, market.currency)}</td>
    </tr>
    <tr class="row-strong">
      <td>Total (with options)</td>
      <td class="amt">${fmtCurrency(result.total, market.currency)}</td>
    </tr>
  `;

  table.appendChild(tbody);
  table.appendChild(tfoot);
  page1.appendChild(table);

  // Base inclusions
  const includes = document.createElement("div");
  includes.className = "grid section";
  includes.innerHTML = `
    <div>
      <h3>Fit-Out (Base) includes</h3>
      <ul>
        <li>Partitions, doors & feature walls</li>
        <li>Suspend/feature ceilings, lighting fixtures</li>
        <li>Flooring & raised access floor adaptions</li>
        <li>Reception & pantry/joinery allowances</li>
        <li>Contractor preliminaries, HS&E, OHP</li>
      </ul>
    </div>
    <div>
      <h3>MEP (Base) includes</h3>
      <ul>
        <li>HVAC distribution from landlord interface</li>
        <li>Electrical distribution, small power, emergency</li>
        <li>Lighting controls / fire alarm tie-ins</li>
        <li>Plumbing to pantry/restrooms</li>
        <li>Basic BMS integration (where applicable)</li>
      </ul>
    </div>
  `;
  page1.appendChild(includes);

  // Footer
  const footer = document.createElement("div");
  footer.className = "footer";
  footer.innerHTML = `
    <div>© TR Design Build — <span class="nowrap">thetemplerock.com</span></div>
    <div class="badge">Draft estimate — not a formal offer</div>
  `;
  page1.appendChild(footer);

  wrapper.appendChild(page1);

  return wrapper;
}

// html2canvas → multi-page jsPDF
async function renderMultipagePdf(root, fileName = "TRDB_Estimate.pdf") {
  const canvas = await window.html2canvas(root, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff"
  });

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: "pt", format: "a4" });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgData = canvas.toDataURL("image/png");
  const ratio = pageWidth / canvas.width;
  const imgWidth = pageWidth;
  const imgHeight = canvas.height * ratio;

  let y = 0;
  while (y < imgHeight) {
    if (y > 0) pdf.addPage();
    pdf.addImage(
      imgData,
      "PNG",
      0,
      0,
      imgWidth,
      imgHeight,
      undefined,
      "FAST",
      0,
      y / ratio
    );
    y += pageHeight;
  }

  pdf.save(fileName);
}

export async function exportPdf({ state, market, result, fileName = "TRDB_Estimate.pdf" }) {
  try {
    if (!state || !market || !result) {
      // Fallback: capture the main app as-is (legacy behaviour)
      const rootEl = document.querySelector("main");
      const canvas = await window.html2canvas(rootEl, { scale: 2, useCORS: true });
      const img = canvas.toDataURL("image/png");
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
      const W = pdf.internal.pageSize.getWidth();
      const H = pdf.internal.pageSize.getHeight();
      const r = Math.min(W / canvas.width, H / canvas.height);
      const w = canvas.width * r;
      const h = canvas.height * r;
      pdf.addImage(img, "PNG", (W - w) / 2, 28, w, h);
      pdf.save(fileName);
      return;
    }

    // Build and render the nice PDF
    const doc = buildPdfDom({ state, market, result });
    // Temporarily attach to DOM for accurate layout
    doc.style.position = "fixed";
    doc.style.left = "-99999px";
    document.body.appendChild(doc);

    const page = doc.querySelector(".pdf-page");
    await renderMultipagePdf(page, fileName);

    document.body.removeChild(doc);
  } catch (err) {
    console.error("PDF export failed:", err);
    alert("Sorry — PDF export failed.");
  }
}
