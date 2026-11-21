// Shared storage and date helpers for both pages.
const STORE_KEY = "staffLeave.v1";

const Store = {
  load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return Store.seed();
  },
  seed() {
    return window.SEED_LEAVES.map((r, i) => ({ ...r, uid: r.uid || `s-${r.id}-${r.from}-${i}` }));
  },
  save(rows) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(rows)); } catch (e) {}
  },
  reset() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    return Store.seed();
  },
  isCustom() {
    try { return !!localStorage.getItem(STORE_KEY); } catch (e) { return false; }
  }
};

const uid = () => "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ---- Dates (all handled as local dates, ISO strings YYYY-MM-DD) ----
const pad = n => String(n).padStart(2, "0");
const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const validISO = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(fromISO(s));
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const daysBetween = (a, b) => Math.round((fromISO(b) - fromISO(a)) / 86400000);
// Company calendar: Saturday is a working day, Sunday is off, plus public holidays.
const HOLIDAYS = {};
(window.HOLIDAY_LIST || []).forEach(h => { HOLIDAYS[h.date] = h.name + (h.tentative ? " (tentative)" : ""); });
const isSunday = s => fromISO(s).getDay() === 0;
const isOffDay = s => isSunday(s) || !!HOLIDAYS[s];
const validRange = r => validISO(r.from) && validISO(r.to) && r.to >= r.from;
// Leave starts on the first working day: Sundays/holidays at the very start don't count.
function effStart(r) {
  if (!validRange(r)) return null;
  let d = r.from;
  while (d <= r.to && isOffDay(d)) d = toISO(addDays(fromISO(d), 1));
  return d <= r.to ? d : null;
}
// Calendar days: last day - (first working day) + 1
const leaveDays = r => {
  if (!validRange(r)) return null;
  const s = effStart(r);
  return s ? daysBetween(s, r.to) + 1 : 0;
};
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmt = s => { if (!validISO(s)) return "—"; const d = fromISO(s); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };

// Parse whatever a spreadsheet throws at us: Date objects, Excel serials,
// ISO strings, dd/mm/yyyy, mm/dd/yyyy, "5 Jan 2026". Returns {y,m,d} candidates.
function dateCandidates(v) {
  if (v == null || v === "") return [];
  if (v instanceof Date && !isNaN(v)) return [{ y: v.getFullYear(), m: v.getMonth() + 1, d: v.getDate() }];
  if (typeof v === "number" && v > 20000 && v < 80000) { // Excel serial
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
    return [{ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }];
  }
  const s = String(v).trim();
  let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return [{ y: +m[1], m: +m[2], d: +m[3] }];
  if ((m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/))) {
    let y = +m[3]; if (y < 100) y += 2000;
    const a = +m[1], b = +m[2];
    const out = [];
    if (a <= 31 && b <= 12) out.push({ y, m: b, d: a });   // dd/mm (house default)
    if (a <= 12 && b <= 31 && a !== b) out.push({ y, m: a, d: b }); // mm/dd
    return out;
  }
  const t = new Date(s);
  if (!isNaN(t)) return [{ y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() }];
  return [];
}

const candISO = c => {
  const d = new Date(c.y, c.m - 1, c.d);
  return (d.getMonth() === c.m - 1 && d.getDate() === c.d) ? toISO(d) : null;
};

// Pick the from/to pair that makes sense: valid dates, to >= from, shortest sane span.
// Also repairs year typos (2016, 1026) using the other date's year.
function smartRange(fromRaw, toRaw) {
  const F = dateCandidates(fromRaw), T = dateCandidates(toRaw);
  const fixYear = (c, ref) => (ref && (c.y < 2000 || Math.abs(c.y - ref.y) > 1)) ? { ...c, y: ref.y } : c;
  let best = null;
  for (const f of F) for (const t0 of T) {
    for (const t of [t0, fixYear(t0, f), { ...fixYear(t0, f), y: f.y + 1 }]) {
      const a = candISO(f), b = candISO(t);
      if (!a || !b || b < a) continue;
      const span = daysBetween(a, b);
      if (span > 180) continue;
      const score = span + (F.indexOf(f) + T.indexOf(t0)) * 0.5; // prefer dd/mm on ties
      if (!best || score < best.score) best = { from: a, to: b, score };
    }
  }
  if (best) return { from: best.from, to: best.to };
  return { from: F[0] ? candISO(F[0]) || "" : "", to: "" };
}

// ---- Approval document photos (kept in this browser's IndexedDB) ----
const Docs = (() => {
  let dbp = null;
  const db = () => dbp ||= new Promise((ok, fail) => {
    const req = indexedDB.open("staffLeaveDocs", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("docs");
    req.onsuccess = () => ok(req.result); req.onerror = () => fail(req.error);
  });
  const tx = async (mode, fn) => {
    const d = await db();
    return new Promise((ok, fail) => {
      const t = d.transaction("docs", mode), r = fn(t.objectStore("docs"));
      t.oncomplete = () => ok(r && r.result); t.onerror = () => fail(t.error);
    });
  };
  return {
    get: k => tx("readonly", s => s.get(k)),
    put: (k, blob) => tx("readwrite", s => s.put(blob, k)),
    del: k => tx("readwrite", s => s.delete(k))
  };
})();

// Shrink a photo to max 1600px JPEG so storage stays small
function shrinkImage(file, max = 1600) {
  return new Promise((ok, fail) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => b ? ok(b) : fail(new Error("Could not read that image")), "image/jpeg", 0.8);
    };
    img.onerror = () => { URL.revokeObjectURL(url); fail(new Error("Could not read that image")); };
    img.src = url;
  });
}

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Theme toggle shared by both pages
function initTheme() {
  const btn = document.getElementById("themeBtn");
  let saved = null;
  try { saved = localStorage.getItem("staffLeave.theme"); } catch (e) {}
  if (saved) document.documentElement.dataset.theme = saved;
  if (!btn) return;
  btn.addEventListener("click", () => {
    const cur = document.documentElement.dataset.theme ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("staffLeave.theme", next); } catch (e) {}
  });
}
