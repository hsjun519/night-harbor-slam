// Small static server for development: node serve.mjs [port]
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const port = Number(process.argv[2] || 4390), root = path.resolve('.');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.resolve(root, '.' + p);
  if (!f.startsWith(root)) { res.writeHead(403); res.end(); return; }
  fs.readFile(f, (e, b) => { res.writeHead(e ? 404 : 200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(e ? 'Not found' : b); });
}).listen(port, '127.0.0.1', () => console.log('http://127.0.0.1:' + port));
