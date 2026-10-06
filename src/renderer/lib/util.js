// 공용 도우미 — 날짜, HTML 이스케이프, 아이디
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 태그드 템플릿: ${}는 자동 이스케이프, raw()로 감싼 값과 배열은 그대로
class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Raw(s);
export function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => {
    out += s;
    if (i < vals.length) out += flat(vals[i]);
  });
  return new Raw(out);
}
function flat(v) {
  if (v == null || v === false) return '';
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(flat).join('');
  return esc(v);
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// ---------- 날짜 (모두 로컬 'YYYY-MM-DD') ----------
export const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const today = () => ymd(new Date());
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
export const addMonths = (s, n) => { const d = parse(s); d.setDate(1); d.setMonth(d.getMonth() + n); return ymd(d); };
export const dow = (s) => parse(s).getDay(); // 0=일
export const WD = ['일', '월', '화', '수', '목', '금', '토'];
export const mondayOf = (s) => addDays(s, -((dow(s) + 6) % 7));
export const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
export const md = (s) => { const d = parse(s); return `${d.getMonth() + 1}.${d.getDate()}`; };
export const mdw = (s) => `${md(s)} ${WD[dow(s)]}`;
export const monthKey = (s) => s.slice(0, 7);

// ISO 주차 번호
export function isoWeek(s) {
  const d = parse(s);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - y0) / 86400000 + 1) / 7);
}
// "10월 2주차" — 그 주 목요일이 속한 달 기준
export function monthWeekLabel(monday) {
  const thu = parse(addDays(monday, 3));
  const first = new Date(thu.getFullYear(), thu.getMonth(), 1);
  const firstThu = new Date(first);
  firstThu.setDate(1 + ((4 - first.getDay() + 7) % 7));
  const n = Math.floor((thu - firstThu) / (7 * 86400000)) + 1;
  return `${thu.getMonth() + 1}월 ${n}주차`;
}

export function relDay(s) {
  if (!s) return '';
  const n = diffDays(today(), s);
  if (n === 0) return '오늘';
  if (n === 1) return '내일';
  if (n === -1) return '어제';
  return mdw(s);
}

export function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${pad(m)}`;
}

export function fmtNum(n) {
  if (n == null || isNaN(n)) return '—';
  if (n >= 100000000) return (n / 100000000).toFixed(1).replace(/\.0$/, '') + '억';
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '만';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + '천';
  return String(n);
}

export function fmtDur(sec) {
  if (!sec) return '';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// ISO 날짜시간 → "10.6 화 19:00" / "오늘 19:00"
export function fmtWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const day = ymd(d);
  const t = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const n = diffDays(today(), day);
  if (n === 0) return `오늘 ${t}`;
  if (n === 1) return `내일 ${t}`;
  return `${mdw(day)} ${t}`;
}

export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
