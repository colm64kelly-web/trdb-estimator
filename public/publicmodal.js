// public/modal.js

(function () {
  const $ = (sel) => document.querySelector(sel);

  const overlay = $('#estimateOverlay');
  const modal   = $('#estimateModal');
  const openers = ['#getEstimateBtn', '#getEstimateBtnBottom']
    .map((id) => document.querySelector(id))
    .filter(Boolean);
  const closer  = modal ? modal.querySelector('[data-close]') : null;

  function openModal() {
    if (!overlay || !modal) return;
    overlay.setAttribute('aria-hidden', 'false');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');

    // Pre-fill city from results if available
    try {
      const loc = document.getElementById('locOut')?.textContent?.trim();
      if (loc) $('#leadCity').value = loc;
    } catch(_) {}
  }

  function closeModal() {
    if (!overlay || !modal) return;
    overlay.setAttribute('aria-hidden', 'true');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  openers.forEach((btn) => btn.addEventListener('click', openModal));
  overlay?.addEventListener('click', closeModal);
  closer?.addEventListener('click', closeModal);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  // Helpers to gather summary from the page (keeps your existing IDs)
  function readSummary() {
    const total = document.getElementById('totalMid')?.textContent?.trim() || '';
    const per   = document.getElementById('perSqft')?.textContent?.trim() || '';
    const size  = document.getElementById('sizeOut')?.textContent?.trim() || '';
    const loc   = document.getElementById('locOut')?.textContent?.trim() || '';
    return { total, per, size, loc };
  }

  function toast(msg) {
    try { alert(msg); } catch(_) {}
  }

  // Buttons
  const btnEmail    = $('#btnEmail');
  const btnPdf      = $('#btnPdf');
  const btnWhatsApp = $('#btnWhatsApp');

  btnPdf?.addEventListener('click', () => {
    closeModal();
    // Use your existing PDF generator if you have it;
    // simple fallback:
    window.print();
  });

  btnWhatsApp?.addEventListener('click', () => {
    const name  = $('#leadName')?.value?.trim() || '';
    const email = $('#leadEmail')?.value?.trim() || '';
    const city  = $('#leadCity')?.value?.trim() || '';
    const s = readSummary();

    const text = `TRDB Estimate%0A%0AName: ${encodeURIComponent(name)}%0AEmail: ${encodeURIComponent(email)}%0ALocation: ${encodeURIComponent(city || s.loc)}%0A%0ATotal (Mid): ${encodeURIComponent(s.total)}%0APer SqFt: ${encodeURIComponent(s.per)}%0ASize: ${encodeURIComponent(s.size)}%0A%0Ahttps://thetemplerock.com`;
    const url  = `https://wa.me/?text=${text}`;
    window.open(url, '_blank', 'noopener');
  });

  btnEmail?.addEventListener('click', async () => {
    const name  = $('#leadName')?.value?.trim();
    const email = $('#leadEmail')?.value?.trim();
    const city  = $('#leadCity')?.value?.trim();
    const s     = readSummary();

    if (!name || !email) {
      toast('Please provide your name and email.');
      return;
    }

    // Try Netlify Function first (if you have one)
    try {
      const res = await fetch('/.netlify/functions/send-email', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          name, email, city,
          summary: s,
          page: location.href
        })
      });
      if (res.ok) {
        toast('Estimate has been emailed. Thank you!');
        closeModal();
        return;
      }
    } catch (_) { /* fall back */ }

    // Fallback: user email client
    const subject = `TRDB Estimate Request – ${city || s.loc || ''}`.trim();
    const body =
`Hello TRDB,

Please send me the estimate.

Name: ${name}
Email: ${email}
City: ${city || s.loc}

Total (Mid): ${s.total}
Per SqFt: ${s.per}
Size: ${s.size}

Link: ${location.href}
`;
    location.href = `mailto:info@thetemplerock.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    closeModal();
  });
})();
