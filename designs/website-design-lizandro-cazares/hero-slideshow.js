(() => {
  const slides = [...document.querySelectorAll('.hero-slide')];
  const button = document.querySelector('.hero-pause');
  if (slides.length < 2 || !button) return;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let paused = motion.matches;
  let current = 0;
  let timer;
  function schedule() {
    clearInterval(timer);
    button.textContent = paused ? 'Play slideshow' : 'Pause slideshow';
    if (!paused && !document.hidden) timer = setInterval(() => {
      const next = (current + 1) % slides.length;
      if (!slides[next].complete || !slides[next].naturalWidth) return;
      slides[current].classList.remove('is-active');
      slides[next].classList.add('is-active');
      current = next;
    }, 6000);
  }
  button.hidden = false;
  button.addEventListener('click', () => { paused = !paused; schedule(); });
  document.addEventListener('visibilitychange', schedule);
  motion.addEventListener('change', () => { paused = motion.matches; schedule(); });
  schedule();
})();
