// 데이터 모델 · 클라이언트 저장소 · 선택자
import { uid, today, addDays, mondayOf, diffDays, ymd } from './util.js';

export const DEFAULT_CATEGORIES = [
  { id: 'work', name: '작업', color: '#8A3B12' },
  { id: 'life', name: '개인', color: '#9A6B15' },
  { id: 'study', name: '공부', color: '#4A5A8C' },
  { id: 'health', name: '운동', color: '#3F6B4F' }
];
export const IDEA_COLS = [
  { id: 'idea', t: '아이디어', sub: '브레인스토밍', bg: '#F5EBC4' },
  { id: 'story', t: '줄거리', sub: '스토리', bg: '#EAE6DA' },
  { id: 'conti', t: '콘티', sub: '컷 구성', bg: '#E3E8DD' },
  { id: 'done', t: '완성 · 업로드', sub: '', bg: '#EFE2DC' }
];
export const PHOTO_TINTS = ['#C4A88C', '#A9B79C', '#B59A8A', '#9AA3B5', '#B5A3BF', '#9DB0A3', '#C2B4A1'];

export function emptyState() {
  return {
    version: 1,
    settings: {},
    categories: DEFAULT_CATEGORIES.map(c => ({ ...c })),
    tasks: [],
    links: [],
    ideas: [],
    folders: [
      { id: 'webtoon', name: '웹툰', color: '#8A3B12' },
      { id: 'video', name: '유튜브 영상', color: '#8A2A16' },
      { id: 'goods', name: '굿즈 · 상품', color: '#9A6B15' },
      { id: 'memo', name: '메모', color: '#4A5A8C' }
    ],
    notes: { week: {}, month: {} },
    yt: { channel: null, lastSync: null, snapshots: [] }
  };
}

// 누락된 키를 채워 이전 버전 데이터와 호환
export function normalize(s) {
  const e = emptyState();
  s = Object.assign(e, s || {});
  s.notes = Object.assign({ week: {}, month: {} }, s.notes || {});
  s.yt = Object.assign({ channel: null, lastSync: null, snapshots: [] }, s.yt || {});
  s.tasks.forEach(t => { t.subtasks = t.subtasks || []; t.photos = t.photos || []; t.links = t.links || []; });
  s.ideas.forEach(i => { i.tags = i.tags || []; });
  return s;
}

// ---------- 저장소 ----------
const listeners = new Set();
export const store = {
  state: null,
  async init() {
    const s = await window.harukan.getState();
    this.state = s ? normalize(s) : null;
    window.harukan.onState(next => { this.state = normalize(next); emit(); });
    return this.state;
  },
  update(fn) {
    fn(this.state);
    window.harukan.setState(this.state);
    emit();
  },
  replace(next) {
    this.state = normalize(next);
    window.harukan.setState(this.state);
    emit();
  },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
};
function emit() { listeners.forEach(fn => fn(store.state)); }

// ---------- 선택자 ----------
export const cat = (s, id) => s.categories.find(c => c.id === id) || { id: '', name: '기타', color: '#6E625A' };
export const tasksOn = (s, d) => s.tasks.filter(t => t.date === d).sort(byTime);
export function byTime(a, b) {
  if (a.done !== b.done) return a.done ? 1 : -1;
  return (a.time || '99').localeCompare(b.time || '99') || (a.createdAt || 0) - (b.createdAt || 0);
}
export const linksOn = (s, d) => s.links.filter(l => l.date === d || (!l.date && l.publishAt && ymd(new Date(l.publishAt)) === d));
export const linkById = (s, id) => s.links.find(l => l.id === id);
export const taskById = (s, id) => s.tasks.find(t => t.id === id);
export const doneOn = (s, d) => s.tasks.filter(t => t.done && t.doneAt && ymd(new Date(t.doneAt)) === d);

export function streak(s) {
  const days = new Set(s.tasks.filter(t => t.done && t.doneAt).map(t => ymd(new Date(t.doneAt))));
  let d = today();
  if (!days.has(d)) d = addDays(d, -1);
  let n = 0;
  while (days.has(d)) { n++; d = addDays(d, -1); }
  return n;
}

export function weekStats(s, monday) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(monday, i);
    const list = tasksOn(s, d);
    return { d, total: list.length, done: list.filter(t => t.done).length };
  });
}

export function newTask(p) {
  return {
    id: uid(), title: p.title || '', date: p.date || null, time: p.time || null, cat: p.cat || 'work',
    done: false, doneAt: null, subtasks: [], photos: [], links: p.links || [], memo: p.memo || '', createdAt: Date.now()
  };
}
export function toggleTask(t) {
  t.done = !t.done;
  t.doneAt = t.done ? Date.now() : null;
}

// ---------- 링크 ----------
export function detectKind(url) {
  let u;
  try { u = new URL(url.trim()); } catch (e) { return null; }
  const h = u.hostname.replace(/^www\.|^m\./, '');
  if (h === 'youtu.be' || h.endsWith('youtube.com')) return /\/shorts\//.test(u.pathname) ? 'short' : 'long';
  if (/notion\.(so|site)$/.test(h) || h === 'docs.google.com' || h === 'drive.google.com' || /dropbox|onedrive|sharepoint|figma\.com|miro\.com/.test(h)) return 'doc';
  return 'web';
}
export function linkBadge(l) {
  if (l.kind === 'long' || l.kind === 'short') return { t: l.kind === 'short' ? 'Shorts' : 'YouTube', cls: 'b-yt', go: '유튜브로' };
  if (l.kind === 'doc') {
    const h = host(l.url);
    if (/notion/.test(h)) return { t: 'Notion', cls: 'b-notion', go: '노션으로' };
    if (/google/.test(h)) return { t: 'Docs', cls: 'b-notion', go: '문서로' };
    return { t: '문서', cls: 'b-notion', go: '문서로' };
  }
  return { t: '웹', cls: 'b-web', go: '사이트로' };
}
export function host(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
export const isYT = (l) => l.kind === 'long' || l.kind === 'short';

export function linkStatus(l) {
  if (l.publishAt) {
    const future = new Date(l.publishAt) > new Date();
    return { scheduled: future, text: future ? '예약' : '공개됨' };
  }
  return { scheduled: false, text: '' };
}

// ---------- 샘플 데이터 (디자인 시안과 같은 구성, 오늘 기준) ----------
export function sampleState() {
  const s = emptyState();
  const t0 = today();
  const mon = mondayOf(t0);
  const D = (n) => addDays(t0, n);
  const W = (i) => addDays(mon, i);
  const ago = (n, h = 18) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(h, 0, 0, 0); return d.getTime(); };
  const at = (n, hh, mm = 0) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(hh, mm, 0, 0); return d.toISOString(); };

  const L = (o) => { const l = Object.assign({ id: uid(), createdAt: Date.now(), mine: false, title: '', thumb: '', color: '#C9B8A6' }, o); s.links.push(l); return l.id; };
  const lVlog = L({ url: 'https://www.youtube.com/', kind: 'long', title: '포장 브이로그 3편', mine: true, color: '#B59A8A', duration: 768, publishAt: at(0, 19), date: t0 });
  const lConti = L({ url: 'https://www.youtube.com/', kind: 'long', title: '콘티 3화 메이킹', mine: true, color: '#9AA3B5', duration: 495, publishAt: at(2, 20), date: D(2) });
  L({ url: 'https://www.youtube.com/', kind: 'long', title: '9월 작업 결산', mine: true, color: '#9DB0A3', duration: 902, publishAt: at(-4, 19), views: 1200, likes: 64 });
  L({ url: 'https://www.youtube.com/', kind: 'long', title: '작업실 소개', mine: true, color: '#C4A88C', duration: 631, publishAt: at(-12, 19), views: 3400, likes: 170 });
  L({ url: 'https://www.youtube.com/shorts/', kind: 'short', title: '포장 ASMR', mine: true, color: '#B59A8A', duration: 42, publishAt: at(1, 12) });
  L({ url: 'https://www.youtube.com/shorts/', kind: 'short', title: '키링 클릭 소리', mine: true, color: '#A9B79C', duration: 18, publishAt: at(3, 12) });
  L({ url: 'https://www.youtube.com/shorts/', kind: 'short', title: '콘티 30초', mine: true, color: '#9AA3B5', duration: 30, publishAt: at(-2, 12), views: 8100, likes: 412 });
  L({ url: 'https://www.youtube.com/shorts/', kind: 'short', title: '택배 언박싱', mine: true, color: '#C2B4A1', duration: 25, publishAt: at(-3, 12), views: 5600, likes: 288 });
  L({ url: 'https://www.youtube.com/shorts/', kind: 'short', title: '색칠 타임랩스', mine: true, color: '#B5A3BF', duration: 55, publishAt: at(-5, 12), views: 2900, likes: 150 });
  const lPlan = L({ url: 'https://www.notion.so/', kind: 'doc', title: '10월 계획표', color: '#E7E3DA', date: W(0) });
  L({ url: 'https://www.notion.so/', kind: 'doc', title: '콘티 3화 기획안', color: '#E7E3DA' });
  const lStore = L({ url: 'https://sell.smartstore.naver.com/', kind: 'web', title: '스마트스토어 관리', color: '#DDE3EE', date: D(1) });
  L({ url: 'https://www.cjlogistics.com/', kind: 'web', title: '송장 조회', color: '#DDE3EE' });
  const lRef = L({ url: 'https://www.youtube.com/', kind: 'long', title: '컷 연출 참고 영상', color: '#B59A8A', duration: 610 });

  const T = (title, date, cat, time, done, extra) => {
    const t = Object.assign(newTask({ title, date, cat, time }), extra || {});
    if (done) { t.done = true; t.doneAt = typeof done === 'number' ? done : ago(diffDays(date, t0)); }
    s.tasks.push(t);
    return t;
  };
  // 지난 날짜들 (작업 기록·연속 일수용)
  for (let i = 12; i >= 1; i--) {
    const d = D(-i);
    if (d >= W(0)) continue;
    T(['택배 발송 6건', '디자인 시안 수정', '재고 체크'][i % 3], d, 'work', '10:00', ago(i, 11));
    T(['헬스', '러닝 3km', '스트레칭'][i % 3], d, 'health', '19:00', ago(i, 20));
    if (i % 2) T(['영어 단어 50개', '강의 1강', '색 이론 정리'][i % 3], d, 'study', '21:00', ago(i, 22), i === 5 ? { memo: 'Day 12 / 30' } : {});
    if (i % 3 === 0) T('장보기', d, 'life', null, ago(i, 15));
  }
  // 이번 주
  const before = (i) => W(i) < t0;
  T('주간 계획', W(0), 'life', '09:00', before(0) || t0 === W(0) ? ago(diffDays(W(0), t0), 9) : false, { links: [lPlan] });
  T('택배 발송 6건', W(0), 'work', '10:00', before(0) ? ago(diffDays(W(0), t0), 11) : false, { photos: [] });
  T('영어 단어', W(0), 'study', '21:00', before(0) ? ago(diffDays(W(0), t0), 21) : false);
  T('택배 발송 8건', t0, 'work', '10:00', ago(0, 11), { links: [lStore] });
  T('영수증 정리', t0, 'life', '09:00', ago(0, 9), { memo: '9월분까지 끝!' });
  T('콘티 3화 작업', t0, 'work', '14:00', false, {
    subtasks: [{ id: uid(), t: '대사 정리', done: true }, { id: uid(), t: '컷 나누기 (8컷)', done: false }, { id: uid(), t: '러프 스케치', done: false }],
    links: [lRef], memo: '마지막 컷은 클로즈업으로!\n배경은 3화 사진 참고'
  });
  T('러닝 5km', t0, 'health', '19:00');
  T('강의 노트 정리', t0, 'study', '20:00');
  T('상세페이지 수정', D(1), 'work', '11:00', false, { links: [lStore] });
  T('헬스', D(1), 'health', '18:00');
  T('강의 4강', D(2), 'study', null);
  T('샘플 주문', D(2), 'work', null, false, { links: [lConti] });
  T('쉬기', D(3), 'life', null);
  T('전시 보러가기', D(4), 'life', null);
  T('다음 주 준비', D(5), 'life', null);
  T('월간 정산', D(6), 'work', null);
  T('치과', D(8), 'life', '15:00');
  T('샘플 촬영', D(10), 'work', '15:00');
  T('자격증 접수', D(14), 'study', null);
  T('재고 정리', D(21), 'work', null);
  T('세금계산서 발행', null, 'work', null);

  s.notes.week[mon] = { goal: '콘티 3화 마감 · 택배 지연 0건', deferred: '재고 사진 촬영 · 세금계산서' };
  s.notes.month[t0.slice(0, 7)] = '콘티 4화까지 완성\n운동 주 3회\n택배 지연 0건!';

  const I = (col, title, body, tags, folder, extra) => s.ideas.push(Object.assign({ id: uid(), col, title, body: body || '', tags: tags || [], folder: folder || 'webtoon', createdAt: Date.now() }, extra || {}));
  I('idea', '택배 상자 속 고양이 시점', '포장하는 하루를 고양이가 지켜보는 이야기', ['일상', '고양이']);
  I('idea', '“마감 3시간 전” 시리즈', '', ['공감']);
  I('idea', '비 오는 날 작업실 루틴', '빗소리 + 작업 브이로그 겸용', ['브이로그'], 'video');
  I('story', '4화 — 첫 주문의 기억', '기 : 첫 주문 알림\n승 : 포장 실수 연발\n전 : 고객의 손편지\n결 : 지금의 작업실', ['4화']);
  I('story', '5화 — 한글날 휴무', '쉬는 날인데 결국 일하는 이야기', ['5화', '공감']);
  I('conti', '3화 — 콘티 작업 중', '8컷 · 러프 4/8', ['3화'], 'webtoon', { panels: 8, panelsDone: 4, due: t0 });
  I('conti', '2화 — 수정본', '6컷 · 대사 수정', ['2화'], 'webtoon', { panels: 6, panelsDone: 6 });
  I('done', '3화 메이킹 영상', '', ['유튜브'], 'video', { linkId: lConti });
  I('done', '1화 — 작업실 소개', '', ['1화'], 'webtoon');
  I('idea', '키링 신상 패키지', '투명 파우치 + 스티커 동봉', ['굿즈'], 'goods');

  s.yt.channel = null;
  s.sample = true;
  return s;
}
