// Headless Chrome driver over the DevTools protocol (test tool only: throwaway profile, local server).
// CHROME_PATH overrides the browser, NHS_SHOTS the screenshot folder.
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = process.env.NHS_SHOTS || path.join(os.tmpdir(), 'nhs-shots');
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };

export function serve(root = ROOT, port = 0) {
  return new Promise(res => {
    const s = http.createServer((req, rs) => {
      const u = decodeURIComponent(req.url.split('?')[0]);
      const f = path.join(root, u === '/' ? '/index.html' : u);
      fs.readFile(f, (e, b) => { rs.writeHead(e ? 404 : 200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); rs.end(e ? 'nf ' + u : b); });
    }).listen(port, '127.0.0.1', () => res({ s, port: s.address().port }));
  });
}

export async function launch({ w = 1280, h = 720, gpu = true, port = 0 } = {}) {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'nhs-chrome-'));
  const exe = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const args = ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + prof, `--window-size=${w},${h}`, '--hide-scrollbars', '--mute-audio', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--force-device-scale-factor=1', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];
  if (!gpu) args.push('--use-angle=swiftshader', '--enable-unsafe-swiftshader');
  else args.push('--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu');
  const p = spawn(exe, [...args, 'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const wsUrl = await new Promise((res, rej) => {
    let buf = '';
    const t = setTimeout(() => rej(new Error('chrome start timeout ' + buf.slice(0, 400))), 20000);
    p.stderr.on('data', d => { buf += d; const m = /ws:\/\/[^\s]+/.exec(buf); if (m) { clearTimeout(t); res(m[0]); } });
  });
  const base = new URL(wsUrl);
  let target = null;
  for (let i = 0; i < 40 && !target; i++) {
    const list = await (await fetch(`http://127.0.0.1:${base.port}/json`)).json();
    target = list.find(t => t.type === 'page');
    if (!target) await new Promise(r => setTimeout(r, 100));
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => (ws.onopen = r));
  let id = 0;
  const pend = new Map(), logs = [];
  const handlers = new Map();
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { const { res, rej } = pend.get(m.id); pend.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); return; }
    if (m.method === 'Runtime.consoleAPICalled') logs.push('[' + m.params.type + '] ' + m.params.args.map(a => a.value ?? a.description ?? a.type).join(' '));
    if (m.method === 'Runtime.exceptionThrown') logs.push('[EXC] ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text) + ' @' + (m.params.exceptionDetails.url || '') + ':' + m.params.exceptionDetails.lineNumber);
    if (m.method === 'Log.entryAdded') logs.push('[log ' + m.params.entry.level + '] ' + m.params.entry.text + ' ' + (m.params.entry.url || ''));
    if (handlers.has(m.method)) handlers.get(m.method)(m.params);
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  const page = {
    send, logs,
    async goto(url, wait = 600) { const p1 = new Promise(r => handlers.set('Page.loadEventFired', r)); await send('Page.navigate', { url }); await Promise.race([p1, new Promise(r => setTimeout(r, 15000))]); await new Promise(r => setTimeout(r, wait)); },
    async eval(code, awaitPromise = true) { const r = await send('Runtime.evaluate', { expression: code, awaitPromise, returnByValue: true, userGesture: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; },
    async shot(name, clip) { const r = await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { scale: 1, ...clip } } : {}) }); const f = path.join(OUT, name + '.png'); fs.writeFileSync(f, Buffer.from(r.data, 'base64')); return f; },
    async key(code, down = true, key) { const map = { Space: ' ', Escape: 'Escape', Enter: 'Enter', Tab: 'Tab' }; const k = key || map[code] || code.replace(/^Key/, '').toLowerCase(); const vk = code.startsWith('Key') ? code.charCodeAt(3) : { Space: 32, Escape: 27, Enter: 13, Tab: 9, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 }[code] || 0; await send('Input.dispatchKeyEvent', { type: down ? 'keyDown' : 'keyUp', code, key: k, windowsVirtualKeyCode: vk }); },
    async tap(code, ms = 60) { await page.key(code, true); await new Promise(r => setTimeout(r, ms)); await page.key(code, false); },
    wait: ms => new Promise(r => setTimeout(r, ms)),
    async close() { try { await send('Browser.close'); } catch { } try { ws.close(); } catch { } p.kill(); await new Promise(r => setTimeout(r, 300)); try { fs.rmSync(prof, { recursive: true, force: true }); } catch { } },
  };
  return page;
}
