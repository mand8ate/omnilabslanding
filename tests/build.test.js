import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

test('public build excludes private/source files and configures only public widget key', () => {
  execFileSync(process.execPath, ['scripts/build.mjs'], { env: { ...process.env, TURNSTILE_SITE_KEY: 'test-public-site-key' } });
  const html = readFileSync('dist/index.html', 'utf8');
  assert.match(html, /action="\/api\/contact"/);
  assert.match(html, /data-sitekey="test-public-site-key"/);
  assert.match(html, /data-action="contact"/);
  for (const file of ['vendor', 'functions', '.env', '.dev.vars', 'package.json', 'sendgrid-form.php', 'img/surya.png']) assert.equal(existsSync(`dist/${file}`), false, file);
  assert.deepEqual(JSON.parse(readFileSync('dist/_routes.json', 'utf8')).include, ['/api/contact']);
});
