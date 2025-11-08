(function () {
  var MEASUREMENT_ID = 'G-CBEDXTN27Q'; // TODO: set real GA4 ID
  if (!MEASUREMENT_ID || /^G-XXXX/.test(MEASUREMENT_ID)) {
    console.warn('[GA4] Skipping init: set MEASUREMENT_ID');
    return;
  }
  window.dataLayer = window.dataLayer || [];
  function gtag(){ window.dataLayer.push(arguments); }
  window.gtag = gtag;

  var s = document.querySelector('script[src*="googletagmanager.com/gtag/js"]');
  if (!s) {
    s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(MEASUREMENT_ID);
    document.head.appendChild(s);
  }
  gtag('js', new Date());
  gtag('config', MEASUREMENT_ID, { anonymize_ip:true, send_page_view:true });
})();

