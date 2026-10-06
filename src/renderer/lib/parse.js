// 자연어 할 일 입력 해석 — "내일 3시 샘플 촬영 #작업" → { title, date, time, cat }
import { today, addDays, dow, ymd, pad } from './util.js';

const DAYS = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };

export function parseTask(input, categories, base) {
  let s = ' ' + input.trim() + ' ';
  const t0 = base || today();
  let date = null, time = null, cat = null, tags = [];

  const take = (re, fn) => {
    const m = s.match(re);
    if (m) { fn(m); s = s.replace(m[0], ' '); return true; }
    return false;
  };

  // #태그 → 카테고리 이름과 같으면 카테고리, 아니면 태그
  s = s.replace(/#([^\s#]+)/g, (_, name) => {
    const c = categories.find(c => c.name === name);
    if (c && !cat) cat = c.id; else tags.push(name);
    return ' ';
  });

  // 날짜
  take(/\s(오늘)\s/, () => { date = t0; }) ||
  take(/\s(내일)\s/, () => { date = addDays(t0, 1); }) ||
  take(/\s(모레)\s/, () => { date = addDays(t0, 2); }) ||
  take(/\s(글피)\s/, () => { date = addDays(t0, 3); }) ||
  take(/\s(\d+)\s*일\s*(뒤|후)\s/, m => { date = addDays(t0, +m[1]); }) ||
  take(/\s(\d{4})[-./](\d{1,2})[-./](\d{1,2})\.?\s/, m => { date = `${m[1]}-${pad(m[2])}-${pad(m[3])}`; }) ||
  take(/\s(\d{1,2})\s*월\s*(\d{1,2})\s*일\s/, m => { date = nearest(+m[1], +m[2], t0); }) ||
  take(/\s(\d{1,2})[./](\d{1,2})\s/, m => { date = nearest(+m[1], +m[2], t0); }) ||
  take(/\s(다음\s*주|다음주|담주)\s*([일월화수목금토])(요일)?\s/, m => {
    const mon = addDays(t0, 7 - ((dow(t0) + 6) % 7));
    date = addDays(mon, (DAYS[m[2]] + 6) % 7);
  }) ||
  take(/\s(이번\s*주\s*)?([일월화수목금토])요일\s/, m => {
    const diff = (DAYS[m[2]] - dow(t0) + 7) % 7;
    date = addDays(t0, diff);
  }) ||
  take(/\s(\d{1,2})\s*일\s/, m => {
    const [y, mo, d] = t0.split('-').map(Number);
    date = +m[1] >= d ? `${y}-${pad(mo)}-${pad(+m[1])}` : ymd(new Date(y, mo, +m[1]));
  });

  // 시간
  take(/\s(\d{1,2}):(\d{2})\s/, m => { time = `${pad(m[1])}:${m[2]}`; }) ||
  take(/\s(오전|오후|아침|저녁|밤|낮)?\s*(\d{1,2})\s*시\s*(?:(\d{1,2})\s*분|(반))?\s/, m => {
    let h = +m[2];
    const mi = m[4] ? 30 : (m[3] ? +m[3] : 0);
    if ((m[1] === '오후' || m[1] === '저녁' || m[1] === '밤') && h < 12) h += 12;
    else if (m[1] === '낮' && h < 7) h += 12;
    else if (!m[1] && h >= 1 && h <= 7) h += 12; // "3시" → 오후 3시
    if (m[1] === '오전' && h === 12) h = 0;
    time = `${pad(h)}:${pad(mi)}`;
  });
  if (time && !date) date = t0;

  const title = s.replace(/\s+/g, ' ').trim();
  return { title, date, time, cat, tags };
}

function nearest(m, d, t0) {
  const y = +t0.slice(0, 4);
  const cand = `${y}-${pad(m)}-${pad(d)}`;
  // 이미 60일 이상 지난 날짜면 내년으로
  return (new Date(cand) < new Date(t0) - 60 * 86400000) ? `${y + 1}-${pad(m)}-${pad(d)}` : cand;
}
