'use strict';
(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const strand = document.getElementById('scroll-strand-path');
  const svg = strand?.ownerSVGElement;
  let total = 0;
  let origin = 0;
  let pending = false;
  let dirty = true;
  let tip;
  if (svg) {
    tip = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    tip.setAttribute('r', '5');
    tip.setAttribute('fill', '#e96d5e');
    tip.setAttribute('class', 'strand-tip');
    svg.append(tip);
  }
  function measure() {
    if (!strand || !svg) return;
    const bounds = svg.getBoundingClientRect();
    const width = bounds.width;
    const height = bounds.height;
    origin = bounds.top + window.scrollY;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    strand.removeAttribute('pathLength');
    const inset = width < 600 ? 18 : Math.max(40, (width - 1440) / 2 + 30);
    const stops = [0, ...Array.from(document.querySelectorAll('main > section, footer'),
      section => section.getBoundingClientRect().top + window.scrollY - origin), height];
    const ys = [...new Set(stops.map(y => Math.max(0, Math.min(height, Math.round(y)))))].sort((a, b) => a - b);
    let x = width - inset;
    let y = 0;
    let d = `M ${x} 0`;
    ys.slice(1).forEach((nextY, index) => {
      if (nextY <= y) return;
      const nextX = index % 2 ? width - inset : inset;
      const middle = (y + nextY) / 2;
      d += ` C ${x} ${middle} ${nextX} ${middle} ${nextX} ${nextY}`;
      x = nextX;
      y = nextY;
    });
    strand.setAttribute('d', d);
    total = strand.getTotalLength();
    strand.setAttribute('stroke-dasharray', `${total} ${total}`);
    dirty = false;
  }
  function draw() {
    pending = false;
    if (!strand || !svg) return;
    if (dirty) measure();
    if (reduced.matches) {
      strand.setAttribute('stroke-dashoffset', '0');
      tip.setAttribute('visibility', 'hidden');
      return;
    }
    // Solve for the path's actual Y coordinate, independent of width or arc length.
    // No easing or scrub delay: the leading point stays at 72% of the viewport.
    const target = Math.max(0, Math.min(svg.getBoundingClientRect().height,
      window.scrollY + window.innerHeight * .72 - origin));
    let low = 0;
    let high = total;
    for (let i = 0; i < 18; i++) {
      const middle = (low + high) / 2;
      if (strand.getPointAtLength(middle).y < target) low = middle;
      else high = middle;
    }
    const distance = (low + high) / 2;
    const point = strand.getPointAtLength(distance);
    strand.setAttribute('stroke-dashoffset', String(total - distance));
    tip.setAttribute('cx', String(point.x));
    tip.setAttribute('cy', String(point.y));
    tip.setAttribute('visibility', 'visible');
  }
  function schedule() {
    if (!pending) { pending = true; requestAnimationFrame(draw); }
  }
  function remeasure() { dirty = true; schedule(); }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', remeasure, { passive: true });
  window.addEventListener('load', remeasure, { once: true });
  reduced.addEventListener('change', schedule);
  if ('ResizeObserver' in window) new ResizeObserver(remeasure).observe(document.body);
  schedule();

  if (!window.gsap || !window.ScrollTrigger) return;
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);
  const graphic = document.querySelector('.hero-graphic');
  const decorations = Array.from(document.querySelectorAll('svg.graphic-left, svg.graphic-right, svg.footer-graphic-left, svg.footer-graphic-right'));
  function wrapShapes(parent, selector, className) {
    return Array.from(parent.querySelectorAll(selector), shape => {
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('class', className);
      shape.before(group);
      group.append(shape);
      return group;
    });
  }
  const blocks = graphic ? wrapShapes(graphic, 'rect', 'hero-piece') : [];
  const sidePieces = decorations.map(decoration => {
    decoration.setAttribute('aria-hidden', 'true');
    return { decoration, pieces: wrapShapes(decoration, 'rect, line', 'decoration-piece') };
  });
  const button = document.querySelector('.motion-toggle');
  const japanese = document.documentElement.lang === 'ja';
  let paused = false;
  let heroTimeline;
  let heroVisible = true;
  const syncHero = () => {
    if (heroTimeline) heroTimeline.paused(paused || !heroVisible || document.hidden);
  };
  button?.addEventListener('click', () => {
    paused = !paused;
    button.setAttribute('aria-pressed', String(paused));
    button.textContent = japanese
      ? (paused ? 'アニメーションを再開 ↻' : 'アニメーションを停止 Ⅱ')
      : (paused ? 'Resume motion ↻' : 'Pause motion Ⅱ');
    syncHero();
  });
  document.addEventListener('visibilitychange', syncHero);
  const media = gsap.matchMedia();
  media.add('(prefers-reduced-motion: no-preference)', () => {
    if (button) button.hidden = false;
    if (graphic) {
      heroTimeline = gsap.timeline();
      heroTimeline.from(blocks, { scale: 0, y: 65, rotation: -30, opacity: 0, transformOrigin: '50% 50%', stagger: .075, duration: .85, ease: 'back.out(1.8)' });
      blocks.forEach((block, index) => {
        const shape = block.firstElementChild;
        // Glow copies share timing with the corresponding solid block.
        const x = Number(shape.getAttribute('x') || 0);
        const y = Number(shape.getAttribute('y') || 0);
        heroTimeline.to(block, { y: (x + y) % 2 ? 12 : -12, rotation: x < 300 ? -6 : 6,
          scale: 1.035, duration: 2.2 + (y % 3) * .2, ease: 'sine.inOut', repeat: -1, yoyo: true }, 1.5 + (x + y) / 1500);
      });
      const lines = graphic.querySelectorAll('line');
      heroTimeline.from(lines, { opacity: 0, stagger: .05, duration: .6 }, .25);
      ScrollTrigger.create({ trigger: graphic, start: 'top bottom', end: 'bottom top',
        onToggle: self => { heroVisible = self.isActive; syncHero(); } });
      syncHero();
    }
    sidePieces.forEach(({ decoration, pieces }) => {
      gsap.from(pieces, {
        scale: .25, y: 60, rotation: decoration.classList.contains('graphic-left') ? -20 : 20,
        opacity: 0, transformOrigin: '50% 50%', stagger: .12, duration: 1, ease: 'back.out(1.4)',
        scrollTrigger: { trigger: decoration, start: 'top 92%', end: 'bottom 45%', scrub: .15, invalidateOnRefresh: true }
      });
    });
    return () => { heroTimeline = undefined; if (button) button.hidden = true; };
  });
  ScrollTrigger.addEventListener('refresh', remeasure);
  // A font or lazy image can change section positions after the initial layout.
  document.fonts?.ready.then(() => { ScrollTrigger.refresh(); remeasure(); });
  window.addEventListener('load', () => { ScrollTrigger.refresh(); remeasure(); }, { once: true });
})();
