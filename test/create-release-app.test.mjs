import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createReleaseApp, escapeHtml, loadManifest, renderForm } from '../scripts/create-release-app.mjs';

const PEM = '-----BEGIN KEY-----\nsecret\n-----END KEY-----\n';

function fakeGithub() {
  const seen = [];
  const server = createServer((request, response) => {
    seen.push(`${request.method} ${request.url}`);
    response.writeHead(201, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ id: 42, slug: 'eimerreis-release', html_url: 'https://github.com/apps/eimerreis-release', pem: PEM }));
  });
  return new Promise((resolve) => server.listen(0, 'localhost', () => resolve({ server, seen, url: `http://localhost:${server.address().port}` })));
}

async function startRun(keyPath, apiUrl) {
  let listening;
  const ready = new Promise((resolve) => { listening = resolve; });
  const run = createReleaseApp({ keyPath, apiUrl, onListening: listening });
  const base = await ready;
  const page = await (await fetch(base)).text();
  return { run, base, state: new URL(page.match(/action="([^"]+)"/)[1].replaceAll('&amp;', '&')).searchParams.get('state'), page };
}

test('the manifest asks for release authority and nothing more', () => {
  const manifest = loadManifest('http://localhost:1/callback');
  assert.deepEqual(manifest.default_permissions, { contents: 'write', workflows: 'write' });
  assert.deepEqual(manifest.default_events, []);
  assert.equal(manifest.public, false);
  assert.equal(manifest.hook_attributes.active, false);
  assert.equal(manifest.redirect_url, 'http://localhost:1/callback');
});

test('the form carries the manifest safely', () => {
  const html = renderForm({ name: 'a"><script>' }, 'abc');
  assert.ok(!html.includes('<script>'));
  assert.match(html, /action="https:\/\/github\.com\/settings\/apps\/new\?state=abc"/);
  assert.equal(escapeHtml('<&">'), '&lt;&amp;&quot;&gt;');
});

test('a callback with the wrong state saves nothing and the right one saves the key privately', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'release-app-'));
  const keyPath = join(directory, 'nested', 'key.pem');
  const github = await fakeGithub();
  try {
    const { run, base, state } = await startRun(keyPath, github.url);
    const rejected = await fetch(`${base}callback?code=c&state=wrong`);
    assert.equal(rejected.status, 400);
    assert.equal(existsSync(keyPath), false);
    assert.deepEqual(github.seen, []);

    const accepted = await fetch(`${base}callback?code=c1&state=${state}`);
    assert.equal(accepted.status, 200);
    assert.ok(!(await accepted.text()).includes('secret'));
    const app = await run;
    assert.deepEqual(github.seen, ['POST /app-manifests/c1/conversions']);
    assert.equal(app.id, 42);
    assert.ok(!JSON.stringify(app).includes('secret'));
    assert.equal(readFileSync(keyPath, 'utf8'), PEM);
    assert.equal(statSync(keyPath).mode & 0o777, 0o600);
  } finally {
    github.server.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('an existing key stops the run before GitHub is involved', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'release-app-'));
  const keyPath = join(directory, 'key.pem');
  writeFileSync(keyPath, 'existing');
  let listened = false;
  try {
    await assert.rejects(createReleaseApp({ keyPath, onListening: () => { listened = true; } }), /already exists/);
    assert.equal(listened, false);
    assert.equal(readFileSync(keyPath, 'utf8'), 'existing');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
