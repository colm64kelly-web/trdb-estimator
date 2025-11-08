// =============================
// src/ui/lead.js  (FULL REPLACEMENT)
// =============================
//
// Purpose: A drop-in lead modal with real email submission via Formspree (or any POST endpoint).
// - ZERO changes required outside this file.
// - bindings.js already calls openLeadModal(payload) — that will now open this modal.
//
// Setup: Put your Formspree endpoint below. Example: "https://formspree.io/f/abcdxyz"
// If left empty, the Submit button is disabled with guidance text in the modal.
//
const FORMSPREE_ENDPOINT = ""; // <---- add your endpoint URL here

let stylesInjected = false;

function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const css = `
  .trdb-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,.55);
    display: flex; align-items: center; justify-content: center;
    z-index: 9999;
  }
  .trdb-modal {
    width: min(640px, 92vw);
    background: #0f2a35;
    color: #eaf2f6;
    border-radius: 18px;
    box-shadow: 0 18px 60px rgba(0,0,0,.35);
    overflow: hidden;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji","Segoe UI Emoji";
  }
  .trdb-modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 22px;
    border-bottom: 1px solid rgba(255,255,255,.08);
  }
  .trdb-modal-title {
    font-weight: 800; font-size: 20px; letter-spacing:.2px;
  }
  .trdb-close {
    background: transparent; border: 0; color: #eaf2f6;
    font-size: 22px; cursor: pointer; line-height: 1; padding: 6px 8px;
  }
  .trdb-modal-body { padding: 20px 22px; background: #0d2430; }
  .trdb-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .trdb-field { display:flex; flex-direction: column; margin-bottom: 12px; }
  .trdb-label { font-size: 13px; color: #b9d0db; margin-bottom: 6px; }
  .trdb-input, .trdb-textarea {
    background: #0b1e27; color: #eaf2f6; border: 1px solid rgba(255,255,255,.12);
    border-radius: 10px; padding: 12px 12px; font-size: 14px; outline: none;
  }
  .trdb-input:focus, .trdb-textarea:focus { border-color: #f39a2e; box-shadow: 0 0 0 3px rgba(243,154,46,.2); }
  .trdb-textarea { min-height: 90px; resize: vertical; }
  .trdb-hint { font-size: 12px; color: #89aabb; margin-top: 6px; }
  .trdb-system {
    background: #08202a; border: 1px dashed rgba(255,255,255,.12);
    padding: 10px 12px; border-radius: 10px; font-size: 12px; color: #a4c2cf; margin-top: 10px;
  }
  .trdb-actions {
    display:flex; gap:10px; justify-content: flex-end; padding: 16px 22px; background:#0f2a35;
    border-top: 1px solid rgba(255,255,255,.08);
  }
  .trdb-btn {
    border: 0; cursor: pointer; font-weight: 800; border-radius: 14px; padding: 12px 16px; font-size: 14px;
  }
  .trdb-btn.secondary { background: #113948; color: #eaf2f6; }
  .trdb-btn.primary    { background: #f39a2e; color: #0b1e27; }
  .trdb-btn[disabled]  { opacity:.55; cursor: not-allowed; }
  .trdb-error { color:#ffd0d0; font-size: 12px; margin-top: 6px; }
  .trdb-success {
    display: none; padding: 14px; border-radius: 10px; background: #09361d; color:#cbf7d3; margin-bottom: 12px;
    border: 1px solid #1f7a3a;
  }
  .trdb-spinner { display:none; width:18px; height:18px; border:3px solid rgba(255,255,255,.25); border-top-color:#fff; border-radius:50%; animation: trdbspin .8s linear infinite; }
  .trdb-btn.busy .trdb-spinner { display:inline-block; vertical-align: -3px; margin-right: 8px; }
  @keyframes trdbspin { to { transform: rotate(360deg); } }
  @media (max-width: 600px) { .trdb-row { grid-template-columns: 1fr; } }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email||"").trim());
}

function toJsonBlob(obj) {
  return JSON.stringify(obj, null, 2);
}

function closeOnEsc(e, overlay) {
  if (e.key === 'Escape') {
    overlay?.remove();
    document.removeEventListener('keydown', bound);
  }
}
let bound = null;

export function openLeadModal(payload = {}) {
  injectStyles();

  // Build overlay + modal
  const overlay = document.createElement('div');
  overlay.className = 'trdb-overlay';
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  const modal = document.createElement('div');
  modal.className = 'trdb-modal';
  modal.innerHTML = `
    <div class="trdb-modal-header">
      <div class="trdb-modal-title">Get Your Estimate</div>
      <button class="trdb-close" type="button" aria-label="Close">×</button>
    </div>

    <div class="trdb-modal-body">
      <div class="trdb-success" id="trdbLeadSuccess">Thanks! Your estimate details were sent — we’ll be in touch shortly.</div>

      <form id="trdbLeadForm" novalidate>
        <div class="trdb-row">
          <div class="trdb-field">
            <label class="trdb-label" for="leadName">Name *</label>
            <input class="trdb-input" id="leadName" name="name" autocomplete="name" required />
            <div class="trdb-error" data-err="name"></div>
          </div>

          <div class="trdb-field">
            <label class="trdb-label" for="leadCompany">Company</label>
            <input class="trdb-input" id="leadCompany" name="company" autocomplete="organization" />
          </div>
        </div>

        <div class="trdb-row">
          <div class="trdb-field">
            <label class="trdb-label" for="leadEmail">Email *</label>
            <input class="trdb-input" id="leadEmail" type="email" name="email" autocomplete="email" required />
            <div class="trdb-error" data-err="email"></div>
          </div>

          <div class="trdb-field">
            <label class="trdb-label" for="leadPhone">Phone (optional)</label>
            <input class="trdb-input" id="leadPhone" name="phone" autocomplete="tel" />
          </div>
        </div>

        <div class="trdb-field">
          <label class="trdb-label" for="leadNotes">Notes (optional)</label>
          <textarea class="trdb-textarea" id="leadNotes" name="notes" placeholder="Any specific requirements, target move-in date, etc."></textarea>
        </div>

        <div class="trdb-system">
          <strong>Estimate snapshot</strong><br/>
          Location: <code>${(payload.marketId||'').toUpperCase()}</code> —
          Size: <code>${payload.sizeSqFt || '—'} SqFt</code> —
          Quality: <code>${payload.quality || '—'}</code> —
          Options: <code>${(payload.options||[]).join(', ') || 'None'}</code>
        </div>

        <input type="hidden" name="estimateJson" value="${encodeURIComponent(toJsonBlob(payload))}">
      </form>

      ${FORMSPREE_ENDPOINT ? '' : `
        <div class="trdb-hint" id="trdbNoEndpoint">
          <strong>Heads up:</strong> Add your Formspree endpoint in <code>src/ui/lead.js</code> (FORMSPREE_ENDPOINT) to enable live submissions.
        </div>
      `}
    </div>

    <div class="trdb-actions">
      <button class="trdb-btn secondary" type="button" id="trdbCancelBtn">Cancel</button>
      <button class="trdb-btn primary" type="button" id="trdbSubmitBtn" ${FORMSPREE_ENDPOINT ? '' : 'disabled'}>
        <span class="trdb-spinner"></span>
        <span class="trdb-submit-label">Send Estimate</span>
      </button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Wiring
  const btnClose   = modal.querySelector('.trdb-close');
  const btnCancel  = modal.querySelector('#trdbCancelBtn');
  const btnSubmit  = modal.querySelector('#trdbSubmitBtn');
  const form       = modal.querySelector('#trdbLeadForm');
  const successBox = modal.querySelector('#trdbLeadSuccess');

  btnClose.addEventListener('click', () => overlay.remove());
  btnCancel.addEventListener('click', () => overlay.remove());

  bound = (e) => closeOnEsc(e, overlay);
  document.addEventListener('keydown', bound);

  const errName  = modal.querySelector('[data-err="name"]');
  const errEmail = modal.querySelector('[data-err="email"]');

  async function handleSubmit() {
    if (!FORMSPREE_ENDPOINT) return;

    // Basic validation
    errName.textContent = "";
    errEmail.textContent = "";

    const name  = form.querySelector('#leadName').value.trim();
    const email = form.querySelector('#leadEmail').value.trim();
    const company = form.querySelector('#leadCompany').value.trim();
    const phone   = form.querySelector('#leadPhone').value.trim();
    const notes   = form.querySelector('#leadNotes').value.trim();

    let ok = true;
    if (!name) { errName.textContent = "Please enter your name."; ok = false; }
    if (!validateEmail(email)) { errEmail.textContent = "Please enter a valid email."; ok = false; }
    if (!ok) return;

    // Build payload
    const body = {
      name, email, company, phone, notes,
      estimate: payload
    };

    // Busy state
    btnSubmit.classList.add('busy');
    btnSubmit.setAttribute('disabled', 'disabled');

    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Success UI
      successBox.style.display = 'block';
      form.reset();
      setTimeout(() => overlay.remove(), 1400);
    } catch (err) {
      // Show inline error hint near Submit
      const hint = modal.querySelector('#trdbSubmitErr') || document.createElement('div');
      hint.id = 'trdbSubmitErr';
      hint.className = 'trdb-error';
      hint.style.marginRight = 'auto';
      hint.textContent = 'Sorry — something went wrong sending your request. Please try again.';
      modal.querySelector('.trdb-actions').prepend(hint);
    } finally {
      btnSubmit.classList.remove('busy');
      btnSubmit.removeAttribute('disabled');
    }
  }

  btnSubmit.addEventListener('click', handleSubmit);
}
