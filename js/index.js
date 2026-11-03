'use strict';
(() => {
  const isJapanese = document.documentElement.lang === 'ja';
  const motionLabels = isJapanese
    ? { pause: 'アニメーションを停止 Ⅱ', resume: 'アニメーションを再開 ↻' }
    : { pause: 'Pause motion Ⅱ', resume: 'Resume motion ↻' };
  const updateLanguageLinks = () => {
    document.querySelectorAll('a[data-language]').forEach(link => {
      const path = link.dataset.language === 'ja' ? '/ja/' : '/';
      link.setAttribute('href', path + window.location.hash);
    });
  };
  updateLanguageLinks();
  window.addEventListener('hashchange', updateLanguageLinks);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const strand = document.getElementById('scroll-strand-path');
  const canvas = strand?.ownerSVGElement;
  let scheduled = false;
  let geometryDirty = true;
  let length = 0;
  let samples = [];

  // Build the curve in document pixels so ultrawide screens never distort its speed.
  const measureStrand = () => {
    if (!strand || !canvas) return;
    const width = document.documentElement.clientWidth;
    const height = document.body.scrollHeight;
    canvas.setAttribute('viewBox', `0 0 ${width} ${height}`);
    strand.removeAttribute('pathLength');
    const inset = Math.max(18, Math.min(width * .07, 150));
    const stops = [0, ...Array.from(document.querySelectorAll('main > section, footer'),
      element => element.getBoundingClientRect().top - document.body.getBoundingClientRect().top), height];
    const ys = [...new Set(stops.map(y => Math.max(0, Math.min(height, Math.round(y)))))].sort((a, b) => a - b)
      .filter((y, index, all) => index === 0 || y - all[index - 1] > 80);
    let previousX = width - inset;
    let previousY = 0;
    let d = `M ${previousX} 0`;
    ys.slice(1).forEach((y, index) => {
      const x = index % 2 ? width - inset : inset;
      const middle = previousY + (y - previousY) / 2;
      d += ` C ${previousX} ${middle}, ${x} ${middle}, ${x} ${y}`;
      previousX = x;
      previousY = y;
    });
    strand.setAttribute('d', d);
    length = strand.getTotalLength();
    strand.style.strokeDasharray = `${length} ${length}`;
    // Cached geometry keeps the scroll handler free of expensive path measurements.
    samples = Array.from({ length: 321 }, (_, index) => {
      const distance = length * index / 320;
      return { y: strand.getPointAtLength(distance).y, distance };
    });
    geometryDirty = false;
  };
  const update = () => {
    if (geometryDirty) measureStrand();
    if (strand && samples.length) {
      const origin = document.body.getBoundingClientRect().top + window.scrollY;
      const target = window.scrollY + window.innerHeight * .95 - origin;
      const index = samples.findIndex(point => point.y >= target);
      let drawn = length;
      if (index === 0) drawn = 0;
      else if (index > 0) {
        const before = samples[index - 1];
        const after = samples[index];
        const mix = (target - before.y) / Math.max(1, after.y - before.y);
        drawn = before.distance + (after.distance - before.distance) * mix;
      }
      strand.style.strokeDashoffset = reducedMotion.matches ? '0' : String(length - drawn);
    }
    scheduled = false;
  };
  const schedule = () => {
    if (!scheduled) { scheduled = true; requestAnimationFrame(update); }
  };
  const remeasure = () => { geometryDirty = true; schedule(); };
  schedule();
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', remeasure, { passive: true });
  reducedMotion.addEventListener('change', schedule);
  if ('ResizeObserver' in window) new ResizeObserver(remeasure).observe(document.body);

  const hero = document.querySelector('.hero');
  const graphic = document.querySelector('.hero-graphic');
  const motionToggle = document.querySelector('.motion-toggle');
  let animations = [];
  let paused = false;
  let heroVisible = true;
  const syncMotion = () => {
    const shouldPlay = !paused && heroVisible && !document.hidden && !reducedMotion.matches;
    animations.forEach(animation => shouldPlay ? animation.play() : animation.pause());
  };
  const animateHero = () => {
    animations.forEach(animation => animation.cancel());
    animations = [];
    if (!graphic || reducedMotion.matches || !graphic.animate) {
      if (motionToggle) motionToggle.hidden = true;
      return;
    }
    motionToggle.hidden = false;
    graphic.querySelectorAll('.hero-anim').forEach((element) => {
      // Identical positions share timing, keeping the original glow layers aligned.
      const x = Number(element.getAttribute('x') || element.getAttribute('x1') || 0);
      const y = Number(element.getAttribute('y') || element.getAttribute('y1') || 0);
      const delay = (x + y) * .6;
      animations.push(element.animate([
        { transform: 'translateY(24px) scale(.55)', opacity: 0 },
        { transform: 'translateY(-3px) scale(1.035)', opacity: 1, offset: .8 },
        { transform: 'translateY(0) scale(1)', opacity: 1 }
      ], { duration: 900, delay, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' }));
      if (element.tagName.toLowerCase() === 'rect') {
        animations.push(element.animate([
          { transform: 'scale(1)' }, { transform: 'scale(1.045)' }, { transform: 'scale(1)' }
        ], { duration: 4200, delay: delay + 1000, iterations: Infinity, easing: 'ease-in-out' }));
      }
    });
    animations.push(graphic.animate([
      { transform: 'translateY(0)' }, { transform: 'translateY(-9px)' }, { transform: 'translateY(0)' }
    ], { duration: 6000, iterations: Infinity, easing: 'ease-in-out' }));
    syncMotion();
  };
  motionToggle?.addEventListener('click', () => {
    paused = !paused;
    motionToggle.setAttribute('aria-pressed', String(paused));
    motionToggle.textContent = paused ? motionLabels.resume : motionLabels.pause;
    syncMotion();
  });
  if (hero && 'IntersectionObserver' in window) new IntersectionObserver(([entry]) => {
    heroVisible = entry.isIntersecting;
    syncMotion();
  }).observe(hero);
  document.addEventListener('visibilitychange', syncMotion);
  reducedMotion.addEventListener('change', animateHero);
  animateHero();
  // Animate decorative SVG pieces without replacing their original SVG transforms.
  const decorations = Array.from(document.querySelectorAll(
    'svg.graphic-left, svg.graphic-right, svg.footer-graphic-left, svg.footer-graphic-right'
  ));
  const decorationAnimations = new Map();
  decorations.forEach(svg => {
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.querySelectorAll('rect, line').forEach(shape => {
      const wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      wrapper.classList.add('decoration-piece');
      shape.before(wrapper);
      wrapper.append(shape);
    });
  });
  const animateDecoration = svg => {
    decorationAnimations.get(svg)?.forEach(animation => animation.cancel());
    if (reducedMotion.matches || !svg.animate) return;
    const pieces = Array.from(svg.querySelectorAll('.decoration-piece'));
    const fromLeft = svg.classList.contains('graphic-left') || svg.classList.contains('footer-graphic-left');
    const active = pieces.map((piece, index) => piece.animate([
      { opacity: 0, transform: `translate(${fromLeft ? -12 : 12}px, 14px) scale(.65)` },
      { opacity: 1, transform: 'translate(0, -2px) scale(1.04)', offset: .75 },
      { opacity: 1, transform: 'translate(0, 0) scale(1)' }
    ], {
      duration: 700,
      delay: index * 65,
      easing: 'cubic-bezier(.2,.7,.2,1)',
      fill: 'backwards'
    }));
    decorationAnimations.set(svg, active);
  };
  if ('IntersectionObserver' in window) {
    const decorationObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) animateDecoration(entry.target);
        else {
          // Offscreen pieces return to their normal appearance without running work.
          decorationAnimations.get(entry.target)?.forEach(animation => animation.cancel());
          decorationAnimations.delete(entry.target);
        }
      });
    }, { threshold: .15, rootMargin: '0px 0px -8% 0px' });
    decorations.forEach(svg => decorationObserver.observe(svg));
    reducedMotion.addEventListener('change', () => {
      decorationAnimations.forEach(active => active.forEach(animation => animation.cancel()));
      decorationAnimations.clear();
      decorationObserver.disconnect();
      decorations.forEach(svg => decorationObserver.observe(svg));
    });
  }
  const status = document.getElementById('form-status');
  const result = new URLSearchParams(window.location.search).get('contact');
  const messages = isJapanese ? {
    sent: 'お問い合わせを受け付けました。メッセージは送信処理に進みました。',
    invalid: 'お名前、正しいメールアドレス、お問い合わせ内容（5,000文字以内）をご入力ください。',
    unavailable: '送信できませんでした。malte@omnilabs.digital までメールでお問い合わせください。',
    verification: '迷惑送信の確認を完了してから、もう一度送信してください。'
  } : {
    sent: 'Thank you. Your message has been accepted for delivery.',
    invalid: 'Please enter a valid name, email address and message (up to 5,000 characters).',
    unavailable: 'Your message could not be sent. Please email malte@omnilabs.digital.',
    verification: 'Please complete the spam verification and submit your message again.'
  };
  if (status && messages[result]) status.textContent = messages[result];
})();
