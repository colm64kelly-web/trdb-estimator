<script>
/* ===== TRDB Estimator — Modal/UI Fix Pack (JS) =====
   - Background scroll lock when modal is open
   - Basic focus trap (TAB cycling)
   - ESC to close, overlay click to close
   - Radio-card checked styling
*/

// Helper to open/close modals by id.
// Your existing open/close functions can keep calling these.
window.trdbModal = {
  open(id){
    const m = document.getElementById(id);
    if(!m) return;
    m.hidden = false;
    document.body.style.overflow = 'hidden';   // lock page
    // focus trap setup
    const focusables = m.querySelectorAll(
      'a,button,input,select,textarea,[tabindex]:not([tabindex="-1"])'
    );
    m.__trap = {
      first: focusables[0] || m,
      last: focusables[focusables.length-1] || m,
      prev: document.activeElement
    };
    (m.__trap.first).focus();
  },
  close(id){
    const m = document.getElementById(id);
    if(!m) return;
    m.hidden = true;
    document.body.style.overflow = '';         // unlock page
    if(m.__trap && m.__trap.prev) m.__trap.prev.focus();
  }
};

// Global key handling for open modal
document.addEventListener('keydown', (e)=>{
  const m = document.querySelector('.modal:not([hidden])');
  if(!m) return;
  if(e.key === 'Escape'){ m.dataset.id ? trdbModal.close(m.dataset.id) : (m.hidden = true); document.body.style.overflow = ''; }
  if(e.key === 'Tab'){
    const {first,last} = m.__trap || {};
    if(!first || !last) return;
    if(e.shiftKey && document.activeElement === first){ last.focus(); e.preventDefault(); }
    else if(!e.shiftKey && document.activeElement === last){ first.focus(); e.preventDefault(); }
  }
});

// Overlay click to close (requires your modal overlay to have class .modal)
document.addEventListener('click', (e)=>{
  const openModal = document.querySelector('.modal:not([hidden])');
  if(!openModal) return;
  if(e.target.classList.contains('modal')){    // clicked the overlay
    openModal.dataset.id ? trdbModal.close(openModal.dataset.id) : (openModal.hidden = true);
    document.body.style.overflow = '';
  }
});

// Radio card checked state enhancer
function wireRadioCards(){
  document.querySelectorAll('.radio-card input[type="radio"]').forEach(r=>{
    const card = r.closest('.radio-card');
    if(!card) return;
    const setState = () => {
      document.querySelectorAll('.radio-card').forEach(c=>c.classList.remove('radio-card--checked'));
      card.classList.add('radio-card--checked');
    };
    r.addEventListener('change', setState);
    card.addEventListener('click', ()=>{ r.checked = true; r.dispatchEvent(new Event('change',{bubbles:true})); });
    if(r.checked) setState();
  });
}
// run once DOM is ready
document.addEventListener('DOMContentLoaded', wireRadioCards);
</script>
