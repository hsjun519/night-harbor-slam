// LocalStorage with a memory fallback (private windows and sandboxed pages may refuse storage).
const PREFIX = 'nhs.';
const memory = new Map();
function store() { try { const s = window.localStorage, k = PREFIX + 'probe'; s.setItem(k, '1'); s.removeItem(k); return s; } catch { return null; } }
export const Save = {
  ok: null,
  get(key, fallback = null) {
    const s = store(); this.ok = !!s;
    try { const v = s ? s.getItem(PREFIX + key) : memory.get(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(key, val) {
    const s = store(); this.ok = !!s;
    const str = JSON.stringify(val);
    try { if (s) s.setItem(PREFIX + key, str); else memory.set(key, str); return true; } catch { memory.set(key, str); return false; }
  },
  del(key) { const s = store(); try { if (s) s.removeItem(PREFIX + key); } catch { } memory.delete(key); },
};
export const DEFAULT_SETTINGS = { master: .8, music: .55, sfx: .85, shake: 1, flash: 1, scan: 0, keys: null, hints: 1, typeSpeed: 1, career: 'normal', entrance: 1 };
export function loadSettings() { return Object.assign({}, DEFAULT_SETTINGS, Save.get('settings', {})); }
export function saveSettings(s) { Save.set('settings', s); }
