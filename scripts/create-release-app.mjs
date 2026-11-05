#!/usr/bin/env node
// Registers the release App from app/release-app.manifest.json through GitHub's
// manifest flow. See docs/release-app.md. Run once, by the account owner.
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const MANIFEST_PATH = new URL('../app/release-app.manifest.json', import.meta.url);
const WEB_URL = 'https://github.com';
const API_URL = 'https://api.github.com';

export function loadManifest(redirectUrl, path = MANIFEST_PATH) {
  return { ...JSON.parse(readFileSync(path, 'utf8')), redirect_url: redirectUrl };
}

export function escapeHtml(text) {
  return text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function renderForm(manifest, state, webUrl = WEB_URL) {
  const action = `${webUrl}/settings/apps/new?state=${encodeURIComponent(state)}`;
  return `<!doctype html>
<meta charset="utf-8">
<title>Create the release App</title>
<form method="post" action="${escapeHtml(action)}">
  <input type="hidden" name="manifest" value="${escapeHtml(JSON.stringify(manifest))}">
  <button type="submit">Continue to GitHub to create ${escapeHtml(manifest.name)}</button>
</form>
`;
}

async function convert(code, apiUrl) {
  const response = await fetch(`${apiUrl}/app-manifests/${encodeURIComponent(code)}/conversions`, {
    method: 'POST',
    headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (!response.ok) throw new Error(`GitHub rejected the manifest code: HTTP ${response.status}`);
  return response.json();
}

// Resolves once the App exists. The private key goes only to keyPath, never to the output.
export function createReleaseApp({ keyPath, webUrl = WEB_URL, apiUrl = API_URL, port = 0, onListening = () => {} }) {
  const state = randomBytes(24).toString('hex');
  return new Promise((resolve, reject) => {
    // Checked before GitHub creates anything: the conversion returns the key only once.
    if (existsSync(keyPath)) {
      reject(new Error(`${keyPath} already exists. Choose another path.`));
      return;
    }
    const server = createServer(async (request, response) => {
      const url = new URL(request.url, 'http://localhost');
      const reply = (status, text, type = 'text/plain') => {
        response.writeHead(status, { 'Content-Type': `${type}; charset=utf-8` });
        response.end(text);
      };
      if (url.pathname === '/') {
        const manifest = loadManifest(`http://localhost:${server.address().port}/callback`);
        reply(200, renderForm(manifest, state, webUrl), 'text/html');
      } else if (url.pathname === '/callback') {
        const code = url.searchParams.get('code');
        if (!code || url.searchParams.get('state') !== state) {
          reply(400, 'The state or code does not match this run. Nothing was saved.');
          return;
        }
        try {
          const app = await convert(code, apiUrl);
          mkdirSync(dirname(keyPath), { recursive: true, mode: 0o700 });
          writeFileSync(keyPath, app.pem, { mode: 0o600, flag: 'wx' });
          reply(200, 'The App exists. Return to your terminal.');
          server.close();
          resolve({ id: app.id, slug: app.slug, htmlUrl: app.html_url, keyPath });
        } catch (error) {
          reply(500, 'Creating the App failed. See your terminal.');
          server.close();
          reject(error);
        }
      } else {
        reply(404, 'Not found');
      }
    });
    server.on('error', reject);
    server.listen(port, 'localhost', () => onListening(`http://localhost:${server.address().port}/`));
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const keyPath = process.argv[2] ?? join(homedir(), '.config', 'release-app', 'release-app.pem');
  const app = await createReleaseApp({
    keyPath,
    onListening: (url) => console.log(`Open ${url} in a browser signed in to GitHub.`),
  });
  console.log(`App ID: ${app.id}`);
  console.log(`Private key: ${app.keyPath}`);
  console.log(`Install it on one repository: ${app.htmlUrl}/installations/new`);
  console.log('Continue with "Enroll a repository" in docs/release-app.md.');
}
