// Bundles src/ (ES modules) into one self-contained dist/index.html that opens with a double click.
// Each module becomes a function scope; imports become reads from the module table, in dependency order.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, 'src'), OUT = path.join(ROOT, 'dist');
const IMPORT_RE = /^\s*import\s+(?:\{([^}]*)\}|\*\s+as\s+(\w+))\s+from\s+['"](.+?)['"];?\s*$/gm;
const rel = (from, spec) => path.relative(SRC, path.resolve(path.dirname(from), spec)).replace(/\\/g, '/');

const mods = new Map(), order = [], state = new Map();
function load(file) {
  const id = path.relative(SRC, file).replace(/\\/g, '/');
  if (state.get(id) === 'done') return id;
  if (state.get(id) === 'busy') throw new Error('import cycle at ' + id);
  state.set(id, 'busy');
  const code = fs.readFileSync(file, 'utf8');
  const deps = [];
  for (const m of code.matchAll(IMPORT_RE)) deps.push(rel(file, m[3]));
  for (const d of deps) load(path.join(SRC, d));
  mods.set(id, { file, code });
  order.push(id);
  state.set(id, 'done');
  return id;
}
load(path.join(SRC, 'main.js'));

// Names declared by `a = 1, b = [..], c = f(x, y)` starting at index i, up to the end of the statement.
function declaredNames(src, i) {
  const names = [];
  let depth = 0, expectName = true, q = null;
  const BS = String.fromCharCode(92), NL = String.fromCharCode(10);
  for (; i < src.length; i++) {
    const ch = src[i];
    if (q) { if (ch === BS) { i++; continue; } if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { q = ch; continue; }
    if (ch === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== NL) i++; if (depth === 0) break; continue; }
    if (expectName && depth === 0) { const m = /^[A-Za-z_$][\w$]*/.exec(src.slice(i)); if (m) { names.push(m[0]); i += m[0].length - 1; expectName = false; continue; } }
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    else if (ch === ',' && depth === 0) expectName = true;
    else if ((ch === ';' || ch === NL) && depth === 0 && !expectName) { if (ch === ';') break; const rest = src.slice(i + 1).trimStart(); if (!/^[,.?:+\-*/|&]/.test(rest)) break; }
  }
  return names;
}
function transform(id, file, code) {
  const exports = [];
  code = code.replace(IMPORT_RE, (all, names, star, spec) => {
    const dep = rel(file, spec);
    if (star) return `const ${star} = __m[${JSON.stringify(dep)}];`;
    const parts = names.split(',').map(s => s.trim()).filter(Boolean).map(s => { const m = /^(\w+)\s+as\s+(\w+)$/.exec(s); return m ? `${m[1]}: ${m[2]}` : s; });
    return `const { ${parts.join(', ')} } = __m[${JSON.stringify(dep)}];`;
  });
  // functions and classes: one name each
  code = code.replace(/^export\s+(function|class|async function)\s+(\w+)/gm, (all, kw, name) => { exports.push(name); return `${kw} ${name}`; });
  // const/let/var may declare several names: walk the statement and take every top-level declarator
  code = code.replace(/^export\s+(const|let|var)\s+/gm, (all, kw, offset, whole) => { for (const n of declaredNames(whole, offset + all.length)) exports.push(n); return kw + ' '; });
  code = code.replace(/^export\s+\{([^}]*)\};?\s*$/gm, (all, names) => { for (const n of names.split(',')) { const s = n.trim(); if (s) exports.push(s); } return ''; });
  if (/^\s*export\s/m.test(code)) throw new Error('unhandled export in ' + id);
  return `__m[${JSON.stringify(id)}] = (function () {\n${code}\nreturn { ${exports.join(', ')} };\n})();\n`;
}
let js = '"use strict";\nconst __m = {};\n';
for (const id of order) { const m = mods.get(id); js += `// ---- ${id}\n` + transform(id, m.file, m.code); }
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'game.js'), js);
const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>밤항구 슬램 — NIGHT HARBOR SLAM</title>
<style>
html,body{margin:0;height:100%;background:#05060f;overflow:hidden}
body{display:flex;align-items:center;justify-content:center}
canvas{display:block;image-rendering:pixelated;outline:none}
#boot{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;color:#9aa6d6;font:14px sans-serif;pointer-events:none}
</style>
</head>
<body>
<canvas id="game" tabindex="0"></canvas>
<div id="boot">불러오는 중…</div>
<script>
${js.replace(/<\/script/gi, '<\\/script')}
document.getElementById('boot').remove();
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(OUT, 'index.html'), html);
// Page body for a hosted copy: the host supplies the document skeleton, so only title, style and body content.
const hosted = `<title>밤항구 슬램</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
html,body{height:100%;margin:0;background:#05060f;overflow:hidden}
body{display:flex;align-items:center;justify-content:center;color:#c9d4ff}
canvas{display:block;image-rendering:pixelated;outline:none}
#focusHint{position:fixed;left:50%;bottom:calc(10px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);font:13px sans-serif;background:rgba(5,6,15,.82);border:1px solid #3a4a8c;padding:6px 12px;border-radius:4px;pointer-events:none}
</style>
<canvas id="game" tabindex="0" aria-label="밤항구 슬램 게임 화면"></canvas>
<div id="focusHint">화면을 한 번 클릭하면 키보드로 조작할 수 있습니다 · PC 키보드·게임패드용</div>
<script>
${js.replace(/<\/script/gi, '<\/script')}
(function(){var c=document.getElementById('game'),h=document.getElementById('focusHint');function go(){c.focus();if(h){h.remove();h=null;}}c.addEventListener('pointerdown',go);window.addEventListener('keydown',function(){if(h){h.remove();h=null;}});c.focus();})();
</script>
`;
fs.writeFileSync(path.join(OUT, 'hosted.html'), hosted);
console.log(`dist/index.html ${(html.length / 1024).toFixed(0)} KB, ${order.length} modules`);
