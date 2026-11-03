import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

// Exercise the actual scroll controller with a deterministic geometry provider.
// Width changes arc length independently from height, exposing percentage-based drift.
function preview(width, reduced = false) {
  const events = new Map();
  const tip = { attrs: {}, setAttribute(key, value) { this.attrs[key] = value; } };
  const window = {
    innerHeight: 900, scrollY: 0,
    matchMedia: () => ({ matches: reduced, addEventListener() {} }),
    addEventListener: (name, callback) => events.set(name, callback),
  };
  const height = 9000;
  const origin = 88;
  const svg = {
    setAttribute() {}, append() {},
    getBoundingClientRect: () => ({ width, height, top: origin - window.scrollY }),
  };
  const path = {
    ownerSVGElement: svg, attrs: {}, removeAttribute() {},
    setAttribute(key, value) { this.attrs[key] = value; },
    getTotalLength: () => height + width * 7,
    getPointAtLength: length => ({ x: width / 2, y: height * length / (height + width * 7) }),
  };
  const document = {
    body: {}, getElementById: () => path, createElementNS: () => tip,
    querySelectorAll: () => [{ getBoundingClientRect: () => ({ top: origin + 4500 - window.scrollY }) }],
  };
  vm.runInNewContext(readFileSync('js/motion.js', 'utf8'), {
    window, document, requestAnimationFrame: callback => callback(),
  });
  return { window, path, tip, events, origin };
}

test('strand follows viewport Y immediately on phone, desktop and ultrawide screens in both scroll directions', () => {
  for (const width of [320, 1280, 2560]) {
    const page = preview(width);
    for (const scroll of [0, 2000, 5000, 2000, 0]) {
      page.window.scrollY = scroll;
      page.events.get('scroll')();
      const screenY = Number(page.tip.attrs.cy) + page.origin - scroll;
      assert.ok(Math.abs(screenY - page.window.innerHeight * .72) < .1, `${width}px at scroll ${scroll}: ${screenY}`);
      assert.equal(page.tip.attrs.visibility, 'visible');
    }
  }
});

test('reduced motion shows the full strand without a moving endpoint', () => {
  const page = preview(1920, true);
  assert.equal(page.path.attrs['stroke-dashoffset'], '0');
  assert.equal(page.tip.attrs.visibility, 'hidden');
});
