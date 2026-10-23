const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { JSDOM } = require('jsdom');
const config = readFileSync('bridge-config.js', 'utf8');
const content = readFileSync('content.js', 'utf8');
const tick = () => new Promise(resolve => setTimeout(resolve, 70));
function environment(url, html = '', frame = false) {
  const frameUrl = new URL(url).hostname === 'antigravity.google.com' ? 'https://antigravity.static.usercontent.goog/web/2.24.0/' : url;
  const dom = new JSDOM(`<!doctype html><body>${frame ? `<iframe src="${frameUrl}"></iframe>` : html}</body>`, {
    url, pretendToBeVisual: true, runScripts: 'outside-only'
  });
  const outer = dom.window;
  const w = frame ? outer.document.querySelector('iframe').contentWindow : outer;
  if (frame) { w.document.open(); w.document.write(`<!doctype html><body>${html}</body>`); w.document.close(); }
  const reports = [], calls = [], popups = [];
  if (frame) outer.postMessage = (data, origin) => reports.push({ data, origin });
  w.chrome = {
    runtime: { getURL: path => `chrome-extension://test/${path}` },
    storage: { sync: {
      get: (defaults, cb) => cb(defaults),
      set: (data, cb) => { calls.push(data); cb(); }
    } }
  };
  w.open = (...args) => { const popup = { location: {}, close() { this.closed = true; } }; popups.push({ args, popup }); return popup; };
  w.eval(config);
  function start() { w.eval(content); }
  return { dom, w, outer, reports, calls, popups, start, close() {
    w.dispatchEvent(new w.PageTransitionEvent('pagehide'));
    outer.close();
  } };
}
const toolbar = '<header><div id="actions" style="display:flex"><button data-testid="titlebar-more-actions">More</button><button data-testid="toggle-overview-panel">Overview</button></div></header>';

test('official assets are bundled unchanged and used for both navigation and extension icons', () => {
  const manifest = JSON.parse(readFileSync('manifest.json'));
  assert.deepEqual(new Set(Object.values(manifest.icons)), new Set(['antigravity-logo.png']));
  assert.equal(createHash('sha256').update(readFileSync('antigravity-logo.png')).digest('hex'), 'e0cd08ccd10cd8d08ccf0ba449823ee88495825c0841619618100d3ab089f51e');
  assert.equal(createHash('sha256').update(readFileSync('gemini-logo.png')).digest('hex'), 'f39c8b1c0dbdf1411a52b203cd7d2815ef1dc5f899f457499e7d5aa57f25b6c8');
  assert.equal(manifest.host_permissions.includes('https://*.usercontent.goog/*'), false);
  for (const name of ['antigravity-logo.png', 'gemini-logo.png']) assert.ok(manifest.web_accessible_resources[0].resources.includes(name));
});

test('endpoint validation keeps supported remote/local URLs and rejects unsupported schemes/hosts', () => {
  const p = environment('https://gemini.google.com');
  try {
    const c = p.w.BridgeConfig;
    for (const url of ['https://antigravity.google.com/r/my-pc?p=c%2Fexample', 'https://dev.antigravity.google.com/', 'http://localhost:8080/', 'http://127.0.0.1:9000/']) assert.equal(c.endpoint(url), new URL(url).href);
    assert.equal(c.endpoint('  '), 'https://antigravity.google.com/');
    for (const url of ['javascript:alert(1)', 'data:text/html,test', 'https://evil.test/', 'https://antigravity.google.com.evil.test/', 'http://antigravity.google.com/', 'https://user:pass@antigravity.google.com/', 'http://localhost.evil.test/', 'https://antigravity.google.com:444/']) assert.throws(() => c.endpoint(url));
  } finally { p.close(); }
});

test('Gemini mounts beside its native control, uses official Antigravity icon, and recovers after SPA rerender', async () => {
  const p = environment('https://gemini.google.com/app/test', '<header><temp-chat-button></temp-chat-button><button>Download app</button></header>');
  try {
    p.start();
    const doc = p.w.document;
    let el = doc.getElementById('antigravity-remote-btn');
    assert.equal(el.nextElementSibling.localName, 'temp-chat-button');
    assert.ok(el.querySelector('img').src.endsWith('/antigravity-logo.png'));
    assert.equal(doc.querySelector('header>button:last-child').style.display, 'none');
    doc.querySelector('header').innerHTML = '<temp-chat-button></temp-chat-button>';
    await tick();
    el = doc.getElementById('antigravity-remote-btn');
    assert.ok(el);
    el.dispatchEvent(new p.w.MouseEvent('auxclick', { button: 1, bubbles: true }));
    assert.equal(p.popups.length, 1);
    assert.equal(p.popups[0].popup.opener, null);
    assert.equal(p.popups[0].popup.location.href, 'https://antigravity.google.com/');
  } finally { p.close(); }
});

test('invalid stored endpoint is rejected at navigation time and closes a pending new tab', () => {
  const p = environment('https://gemini.google.com/app', '<header></header>');
  try {
    p.w.chrome.storage.sync.get = (_, cb) => cb({ antigravityUrl: 'javascript:alert(1)' });
    p.start();
    const el = p.w.document.getElementById('antigravity-remote-btn');
    el.dispatchEvent(new p.w.MouseEvent('click', { ctrlKey: true }));
    assert.equal(p.popups[0].popup.closed, true);
    assert.match(el.title, /HTTPS Antigravity/);
  } finally { p.close(); }
});

test('workspace inserts Gemini before More actions, reattaches after rerender, removes it on home, and handles middle-click', async () => {
  const p = environment('https://antigravity.google.com/r/test', toolbar, true);
  try {
    p.start();
    const doc = p.w.document;
    let el = doc.getElementById('gemini-back-btn');
    assert.equal(el.nextSibling, doc.querySelector('[data-testid="titlebar-more-actions"]'));
    assert.ok(el.classList.contains('antigravity-bridge-inline'));
    assert.ok(el.querySelector('img').src.endsWith('/gemini-logo.png'));
    assert.equal(el.querySelector('svg'), null);
    assert.equal(p.reports.at(-1).data.inline, true);
    assert.equal(p.reports.at(-1).origin, 'https://antigravity.google.com');
    el.click();
    assert.equal(p.reports.at(-1).data.type, 'ANTIGRAVITY_RETURN_TO_GEMINI');
    doc.querySelector('header').outerHTML = toolbar;
    await tick();
    el = doc.getElementById('gemini-back-btn');
    assert.equal(doc.querySelectorAll('#gemini-back-btn').length, 1);
    assert.equal(el.nextSibling, doc.querySelector('[data-testid="titlebar-more-actions"]'));
    el.dispatchEvent(new p.w.MouseEvent('auxclick', { button: 1 }));
    assert.deepEqual(p.popups[0].args, ['https://gemini.google.com/app', '_blank', 'noopener']);
    doc.querySelector('header').remove();
    await tick();
    assert.equal(doc.getElementById('gemini-back-btn'), null);
    assert.equal(p.reports.at(-1).data.inline, false);
    const count = p.reports.length;
    await tick();
    assert.equal(p.reports.length, count, 'observer settles without repeated reports or polling');
  } finally { p.close(); }
});

test('only the actual official workspace frame can hide the fallback; losing it restores the button', async () => {
  const p = environment('https://antigravity.google.com/r/test', '<button class="header-feedback-btn">Feedback</button><iframe src="https://antigravity.static.usercontent.goog/web/2.24.0/"></iframe>');
  try {
    const doc = p.w.document;
    doc.querySelector('button').getBoundingClientRect = () => ({ left: 950, top: 6, bottom: 34, width: 28, height: 28 });
    p.start();
    const iframe = doc.querySelector('iframe');
    const ready = { type: 'ANTIGRAVITY_INNER_LAYOUT', inline: true, left: null };
    assert.ok(doc.getElementById('gemini-back-btn'));
    for (const [origin, source] of [['https://evil.test', iframe.contentWindow], ['https://antigravity.static.usercontent.goog', p.w]]) {
      p.w.dispatchEvent(new p.w.MessageEvent('message', { origin, source, data: ready }));
    }
    await tick();
    assert.ok(doc.getElementById('gemini-back-btn'));
    p.w.dispatchEvent(new p.w.MessageEvent('message', { origin: 'https://antigravity.static.usercontent.goog', source: iframe.contentWindow, data: ready }));
    await tick();
    assert.equal(doc.getElementById('gemini-back-btn'), null);
    iframe.remove();
    await tick();
    assert.ok(doc.getElementById('gemini-back-btn'));
  } finally { p.close(); }
});

test('unrelated usercontent documents and embedded Gemini pages receive no injected button', () => {
  const p = environment('https://unrelated.usercontent.goog/', toolbar, true);
  try { p.start(); assert.equal(p.w.document.getElementById('gemini-back-btn'), null); } finally { p.close(); }
  const q = environment('https://gemini.google.com/app', toolbar, true);
  try { q.start(); assert.equal(q.w.document.getElementById('antigravity-remote-btn'), null); } finally { q.close(); }
});

test('options reject invalid endpoints without saving, then accept localhost', () => {
  const p = environment('https://extension.test/options', '<input id="endpoint"><button id="save">Save</button><div id="status"></div>');
  try {
    p.w.eval(readFileSync('options.js', 'utf8'));
    const doc = p.w.document;
    doc.getElementById('endpoint').value = 'https://evil.test/';
    doc.getElementById('save').click();
    assert.equal(p.calls.length, 0);
    assert.match(doc.getElementById('status').textContent, /HTTPS Antigravity/);
    doc.getElementById('endpoint').value = 'http://localhost:8080/session';
    doc.getElementById('save').click();
    assert.equal(p.calls[0].antigravityUrl, 'http://localhost:8080/session');
  } finally { p.close(); }
});
