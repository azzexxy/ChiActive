(() => {
  const dialog = document.querySelector('#student-discount-dialog');
  const form = document.querySelector('#student-discount-form');
  const email = document.querySelector('#student-email');
  const status = document.querySelector('#discount-status');
  if (!dialog || !form) return;
  const discountLink = document.querySelector('#student-discount-link');
  discountLink?.addEventListener('click', event => {
    event.preventDefault();
    if (!dialog.open) dialog.showModal();
    email.focus();
  });
  let seen = false;
  try { seen = sessionStorage.getItem('chiactive-student-offer-seen') === 'yes'; } catch (_) {}
  const close = () => dialog.close();
  dialog.querySelector('.discount-close').addEventListener('click', close);
  dialog.querySelector('.discount-later').addEventListener('click', close);
  dialog.addEventListener('close', () => {
    try { sessionStorage.setItem('chiactive-student-offer-seen', 'yes'); } catch (_) {}
  });
  email.addEventListener('input', () => { email.setCustomValidity(''); status.textContent = ''; });
  form.addEventListener('submit', event => {
    event.preventDefault();
    email.value = email.value.trim();
    if (!/^[^\s@]+@(?:[a-z0-9-]+\.)+edu$/i.test(email.value)) {
      email.setCustomValidity('Please enter your student email ending in .edu.');
      email.reportValidity();
      return;
    }
    email.setCustomValidity('');
    status.textContent = 'Your .edu email looks valid. This preview does not send or store your email or issue a discount yet.';
  });
  if (!seen) dialog.showModal();
})();
