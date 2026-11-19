// Builds the installable phone app (PWA) into /docs for GitHub Pages.
// Run from the repo root: node golf-swing-guide/build-app.js
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'docs');
fs.mkdirSync(path.join(out, 'icons'), { recursive: true });
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const VERSION = Date.now().toString(36);

const head = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#2f6b3e">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Golf Swing">
<meta name="description" content="A beginner's golf swing guide that shows one technique at a time.">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}[hidden]{display:none!important}img{max-width:100%}</style>
`;
const sw = `<script>if('serviceWorker' in navigator){addEventListener('load',()=>navigator.serviceWorker.register('sw.js'))}</script>`;
const body = src.replace(/<meta name="claude:viewport-fit-sides"[^>]*>\n?/, '');
const splitAt = body.indexOf('</style>') + '</style>'.length;
fs.writeFileSync(path.join(out, 'index.html'),
  head + body.slice(0, splitAt) + '\n</head>\n<body>\n' + body.slice(splitAt) + '\n' + sw + '\n</body>\n</html>\n');

fs.writeFileSync(path.join(out, 'manifest.webmanifest'), JSON.stringify({
  name: 'One Thing Golf', short_name: 'Golf Swing',
  description: "A beginner's golf swing guide that shows one technique at a time.",
  start_url: './', scope: './', display: 'standalone', orientation: 'portrait',
  background_color: '#eef2ec', theme_color: '#2f6b3e',
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
  ]
}, null, 2));

fs.writeFileSync(path.join(out, 'sw.js'), `// Offline support: keeps the guide working at the range with no signal.
const CACHE = 'golf-${VERSION}';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'golf-swing-guide.pdf'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate') {   // network first for the page, so updates arrive; cache when offline
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put('index.html', c)); return r; }).catch(() => caches.match('index.html')));
    return;
  }
  if (url.origin === location.origin || /fonts\\.(googleapis|gstatic)\\.com$/.test(url.hostname)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok || r.type === 'opaque') { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return r; })));
  }
});
`);
fs.copyFileSync(path.join(__dirname, 'golf-swing-guide.pdf'), path.join(out, 'golf-swing-guide.pdf'));
fs.writeFileSync(path.join(out, '.nojekyll'), '');

// Icon: a pin flag on a green, drawn once as SVG and rendered to PNGs.
const icon = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<rect width="512" height="512" fill="#2f6b3e"/>
<g transform="translate(256 256) scale(${pad}) translate(-256 -256)">
<ellipse cx="256" cy="398" rx="150" ry="34" fill="#4f8f5e"/>
<ellipse cx="256" cy="398" rx="26" ry="9" fill="#17241b"/>
<rect x="250" y="100" width="12" height="300" rx="6" fill="#ffffff"/>
<path d="M262 104 L392 150 L262 196 Z" fill="#e2533a"/>
<circle cx="344" cy="378" r="20" fill="#ffffff"/>
</g></svg>`;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  for (const [name, size, pad] of [['icon-512.png', 512, 1], ['icon-192.png', 192, 1], ['apple-touch-icon.png', 180, 0.92], ['icon-maskable-512.png', 512, 0.78]]) {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<body style="margin:0"><img src="data:image/svg+xml;base64,${Buffer.from(icon(pad)).toString('base64')}" style="width:${size}px;height:${size}px;display:block">`);
    await p.screenshot({ path: path.join(out, 'icons', name) });
  }
  await b.close(); console.log('built docs/ version', VERSION);
})();
