export const fmt = {
  currency(amount, currency='AED', locale='en'){
    if(!Number.isFinite(amount)) return '—';
    return new Intl.NumberFormat(locale,{style:'currency',currency}).format(amount);
  },
  number(n, decimals=0){
    if(!Number.isFinite(n)) return '—';
    return new Intl.NumberFormat('en-US',{minimumFractionDigits:decimals,maximumFractionDigits:decimals}).format(n);
  }
};
