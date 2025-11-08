(function () {
  const SUPPORTED = {
    en: { dir: 'ltr', file: '/i18n/en.json' },
    ar: { dir: 'rtl', file: '/i18n/ar.json' }
  };
  const STORAGE_KEY = 'trdb.lang';

  async function loadDict(lang) {
    const meta = SUPPORTED[lang] || SUPPORTED.en;
    const res = await fetch(meta.file, { cache: 'no-store' });
    if (!res.ok) throw new Error('dict load failed');
    return { dict: await res.json(), meta };
  }

  function applyLang(lang, dict, meta) {
    document.documentElement.lang = lang;
    document.documentElement.dir = meta.dir;
    document.body.classList.toggle('rtl', meta.dir === 'rtl');

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (dict[key]) el.textContent = dict[key];
    });

    const toggle = document.getElementById('langToggle');
    if (toggle) toggle.value = lang;
  }

  async function setLang(lang) {
    try {
      const { dict, meta } = await loadDict(lang);
      localStorage.setItem(STORAGE_KEY, lang);
      applyLang(lang, dict, meta);
    } catch (e) { console.error(e); }
  }

  function ensureToggle() {
    if (document.getElementById('langToggle')) return;
    const wrap = document.createElement('div');
    wrap.className = 'lang-wrap';
    wrap.innerHTML = `
      <select id="langToggle" aria-label="Language">
        <option value="en">EN</option>
        <option value="ar">العربية</option>
      </select>
    `;
    (document.querySelector('header') || document.body).appendChild(wrap);
    document.getElementById('langToggle').addEventListener('change', e => setLang(e.target.value));
  }

  document.addEventListener('DOMContentLoaded', async () => {
    ensureToggle();
    const saved = localStorage.getItem(STORAGE_KEY) || 'en';
    await setLang(saved);
  });
})();
