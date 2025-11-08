// src/index.js
// Minimal, stable boot: load default market, bind UI, fire GA "ready".
// (No URL state sync in this version.)

import { loadMarket, bindUi } from './ui/bindings.js';
import { track } from './core/ga.js';

window.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadMarket('uae-dubai');  // default initial market
    bindUi();                       // wire up controls and first render
    track('app_ready');
  } catch (err) {
    console.error('Boot failed:', err);
  }
});
