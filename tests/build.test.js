import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

test('public build excludes private/source files and configures only public widget key', () => {
  execFileSync(process.execPath, ['scripts/build.mjs'], { env: { ...process.env, TURNSTILE_SITE_KEY: 'test-public-site-key' } });
  const html = readFileSync('dist/index.html', 'utf8');
  const ja = readFileSync('dist/ja/index.html', 'utf8');
  assert.match(ja, /<html lang="ja">/);
  assert.match(ja, /アイデアを、デジタルのかたちに。/);
  assert.match(ja, /action="\/api\/contact\?lang=ja"/);
  assert.match(ja, /rel="canonical" href="https:\/\/omnilabs.digital\/ja\/"/);
  assert.match(ja, /data-language="ja" aria-label="日本語" aria-current="page"/);
  assert.ok(!ja.includes('data-language="en" aria-label="English" aria-current="page"'));
  assert.ok(!ja.includes('src="img/') && !ja.includes('href="css/'), 'Nested locale must use root-relative assets');
  for (const language of ['en', 'ja', 'x-default']) {
    assert.ok(html.includes(`hreflang="${language}"`));
    assert.ok(ja.includes(`hreflang="${language}"`));
  }
  assert.match(html, /action="\/api\/contact"/);
  assert.match(html, /data-sitekey="test-public-site-key"/);
  assert.match(html, /data-action="contact"/);
  assert.equal((html.match(/id="scroll-strand-path"/g) || []).length, 1);
  assert.ok(!html.includes('<!-- scroll-strand -->'), 'SVG must be embedded in the public build');
  for (const file of ['vendor', 'functions', '.env', '.dev.vars', 'package.json', 'sendgrid-form.php', 'img/surya.png']) assert.equal(existsSync(`dist/${file}`), false, file);
  assert.deepEqual(JSON.parse(readFileSync('dist/_routes.json', 'utf8')).include, ['/api/contact']);
});


test('both language builds retain the serverless contact form when the public key is not configured', () => {
  execFileSync(process.execPath, ['scripts/build.mjs'], { env: { ...process.env, TURNSTILE_SITE_KEY: '' }, stdio: 'pipe' });
  for (const [file, action] of [['dist/index.html', '/api/contact'], ['dist/ja/index.html', '/api/contact?lang=ja']]) {
    const page = readFileSync(file, 'utf8');
    assert.ok(page.includes(`action="${action}"`));
    for (const name of ['name', 'email', 'message']) assert.ok(page.includes(`name="${name}"`));
    assert.match(page, /type="submit"/);
    assert.ok(!page.includes('Please email Malte to discuss your project.'));
  }
});
