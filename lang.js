/* lang.js — root */
(function () {
  const I18N_BASE = './i18n/'; // folder you just moved
  const MAP = { en: 'en.json', ar: 'ar.json' };

  // Pick saved locale or default to English
  let current = localStorage.getItem('locale') || 'en';

  async function loadLocale(locale) {
    if (!MAP[locale]) locale = 'en';
    const res = await fetch(`${I18N_BASE}${MAP[locale]}`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`i18n load failed: ${res.status}`);
    const dict = await res.json();

    // Apply direction
    document.documentElement.setAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');

    // Replace all elements with data-i18n="key"
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (dict[key] != null) el.textContent = dict[key];
    });

    // Replace placeholders where needed
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      const key = el.getAttribute('data-i18n-ph');
      if (dict[key] != null) el.setAttribute('placeholder', dict[key]);
    });
  }

  // Expose a tiny API for the toggle
  window.TRDBLang = {
    set(locale) {
      current = locale;
      localStorage.setItem('locale', current);
      loadLocale(current).catch(console.error);
    },
    get() { return current; }
  };

  // Initial run
  loadLocale(current).catch(console.error);
})();
