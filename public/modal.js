/* public/modal.js
   Get Estimate modal: open/close, WhatsApp share, Email (mailto),
   and “Download PDF” (print-friendly) without blocking the calculator.
*/

(function () {
  // Elements (created in index.html)
  const openBtn = document.getElementById('openEstimateBtn');
  const modal = document.getElementById('estimateModal');
  const closeBtn = document.getElementById('estimateCloseBtn');

  const nameInput = document.getElementById('leadName');
  const emailInput = document.getElementById('leadEmail');

  const emailBtn = document.getElementById('sendEmailBtn');
  const pdfBtn = document.getElementById('downloadPdfBtn');
  const waBtn = document.getElementById('sendWhatsAppBtn');

  // Result fields to compile message
  const totalEl = document.getElementById('totalValue');
  const rateEl = document.getElementById('rateValue');
  const sizeEl = document.getElementById('sizeValue');
  const locationEl = document.getElementById('locationValue');

  // Inputs to show in message
  const countryEl = document.getElementById('countrySelect');
  const cityEl = document.getElementById('citySelect');
  const zoneEl = document.getElementById('zoneSelect');
  const qualityEl = document.getElementById('qualitySelect');
  const addFurnitureEl = document.getElementById('addFurniture');
  const addAVEl = document.getElementById('addAV');
  const addSmartEl = document.getElementById('addSmart');
  const addGreenEl = document.getElementById('addGreen');

  // Safety: bail if modal isn’t on the page
  if (!openBtn || !modal) return;

  // Open / Close
  function openModal() {
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('is-open');
    // focus first input for better UX
    setTimeout(() => nameInput && nameInput.focus(), 50);
  }
  function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }

  openBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    // click on backdrop closes modal
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // Build the message text from current UI values
  function currentMessage() {
    const total = (totalEl?.dataset.raw || totalEl?.textContent || '').trim();
    const rate = (rateEl?.dataset.raw || rateEl?.textContent || '').trim();
    const size = (sizeEl?.dataset.raw || sizeEl?.textContent || '').trim();
    const loc = (locationEl?.textContent || '').trim();

    const country = countryEl?.value || '';
    const city = cityEl?.value || '';
    const zone = zoneEl?.value || '';
    const quality = qualityEl?.value || '';

    const adds = []
      .concat(addFurnitureEl?.checked ? ['Furniture Supply (+10%)'] : [])
      .concat(addAVEl?.checked ? ['Advanced AV/IT (+5%)'] : [])
      .concat(addSmartEl?.checked ? ['Smart Workplace Systems (+6%)'] : [])
      .concat(addGreenEl?.checked ? ['Green / LEED Certified (+8%)'] : [])
      .join(', ') || 'None';

    return [
      'TRDB Fit-Out Estimate (Midpoint)',
      `Total: ${total}`,
      `Per SqFt: ${rate}`,
      `Size: ${size}`,
      `Location: ${loc || [country, city, zone].filter(Boolean).join(' • ')}`,
      `Quality: ${quality}`,
      `Optional Adds: ${adds}`,
      '',
      'This estimate reflects prevailing industry benchmarks for the selected city/zone and quality.',
    ].join('\n');
  }

  // Email via mailto (keeps things simple and CSP-safe)
  emailBtn.addEventListener('click', () => {
    const name = (nameInput?.value || '').trim();
    const email = (emailInput?.value || '').trim();

    // Build mailto to internal address + lead copy (if they entered email)
    const to = 'info@thetemplerock.com';
    const cc = email ? `&cc=${encodeURIComponent(email)}` : '';
    const subject = `TRDB Estimate Request — ${name || 'Prospect'}`;
    const body = currentMessage();

    const href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(
      subject
    )}${cc}&body=${encodeURIComponent(body)}`;

    window.location.href = href;
  });

  // WhatsApp share
  waBtn.addEventListener('click', () => {
    const text = currentMessage();
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  });

  // Download PDF (print)
  pdfBtn.addEventListener('click', () => {
    // Hide modal during print (CSS also handles this, but double-safe)
    const wasOpen = modal.classList.contains('is-open');
    if (wasOpen) modal.classList.remove('is-open');
    window.print();
    if (wasOpen) modal.classList.add('is-open');
  });
})();
