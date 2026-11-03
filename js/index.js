'use strict';
(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const strand = document.getElementById('scroll-strand-path');
  let scheduled = false;
  let previousScroll = window.scrollY;
  const update = () => {
    const y = Math.max(0, window.scrollY);
    document.body.classList.toggle('scrollDown', y > previousScroll && y > 150);
    document.body.classList.toggle('scrollUp', y < previousScroll && y > 0);
    previousScroll = y;
    if (strand) {
      const height = document.documentElement.scrollHeight;
      const progress = Math.min(1, Math.max(0, (y + window.innerHeight * .85) / height));
      strand.style.strokeDasharray = '1';
      strand.style.strokeDashoffset = reducedMotion.matches ? '0' : String(1 - progress);
    }
    scheduled = false;
  };
  const schedule = () => {
    if (!scheduled) { scheduled = true; requestAnimationFrame(update); }
  };
  schedule();
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  reducedMotion.addEventListener('change', schedule);
  if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(document.body);
  const status = document.getElementById('form-status');
  const result = new URLSearchParams(window.location.search).get('contact');
  const messages = {
    sent: 'Thank you. Your message has been accepted for delivery.',
    invalid: 'Please enter a valid name, email address and message (up to 5,000 characters).',
    unavailable: 'Your message could not be sent. Please email malte@omnilabs.digital.',
    verification: 'Please complete the spam verification and submit your message again.'
  };
  if (status && messages[result]) status.textContent = messages[result];
})();
