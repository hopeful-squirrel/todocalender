// 플래너 창 — 탭 전환, 이벤트 위임, 공용 동작
import { esc, today, addDays, mondayOf, debounce } from './lib/util.js';
import { store, sampleState, emptyState, toggleTask, taskById, linkById } from './lib/data.js';
import { taskDialog, linkDialog, deleteLink, confirmDialog, openDialog } from './lib/modal.js';
import { toast } from './lib/ui.js';
import { clickThrough } from './lib/clickthrough.js';
import week from './views/week.js';
import month from './views/month.js';
import todo from './views/todo.js';
import work from './views/work.js';
import ideas from './views/ideas.js';
import links from './views/links.js';
import youtube from './views/youtube.js';
import settingsView from './views/settings.js';

const TABS = [
  { v: week, t: '주간', c: '#D9C9A8' },
  { v: month, t: '월간', c: '#C8D3C0' },
  { v: todo, t: '할 일', c: '#CBD0DE' },
  { v: work, t: '작업', c: '#E4CBC2' },
  { v: ideas, t: '아이디어', c: '#D6E3D0' },
  { v: links, t: '링크', c: '#E8DEB0' },
  { v: youtube, t: '유튜브', c: '#F3D9D2' }
];
const ACTIVE = { week: '#8A3B12', month: '#8A3B12', todo: '#8A3B12', work: '#8A3B12', ideas: '#3F6B4F', links: '#8A3B12', youtube: '#8A2A16' };
const VIEWS = Object.fromEntries([...TABS.map(t => [t.v.id, t.v]), ['settings', settingsView]]);
const uiState = {}; // 화면별 상태 (선택, 필터, 보고 있는 주 등)

let current = 'week';
try { current = localStorage.getItem('harukan.view') || 'week'; } catch (e) { /* 무시 */ }
if (!VIEWS[current]) current = 'week';

const $view = document.getElementById('view');
const ctx = {
  get s() { return store.state; },
  ui: (id) => (uiState[id] = uiState[id] || (VIEWS[id].initUi ? VIEWS[id].initUi() : {})),
  go, render,
  update: (fn) => store.update(fn)
};

function go(id, arg) {
  if (!VIEWS[id]) return;
  current = id;
  try { localStorage.setItem('harukan.view', id); } catch (e) { /* 무시 */ }
  if (arg && VIEWS[id].onArg) VIEWS[id].onArg(arg, ctx.ui(id), ctx);
  render();
  $view.scrollTop = 0;
}

// 스크롤 위치를 보존하면서 다시 그린다
function render() {
  if (!store.state) return;
  const v = VIEWS[current];
  const scrolls = {};
  $view.querySelectorAll('[data-keep]').forEach(el => { scrolls[el.dataset.keep] = el.scrollTop; });
  const active = document.activeElement;
  const focusKey = active && $view.contains(active) && active.dataset.focus;
  const sel = focusKey && active.selectionStart != null ? [active.selectionStart, active.selectionEnd] : null;
  $view.innerHTML = v.render(store.state, ctx.ui(current), ctx).toString();
  $view.querySelectorAll('[data-keep]').forEach(el => { if (scrolls[el.dataset.keep] != null) el.scrollTop = scrolls[el.dataset.keep]; });
  if (focusKey) {
    const el = $view.querySelector(`[data-focus="${focusKey}"]`);
    if (el) { el.focus(); if (sel) try { el.setSelectionRange(sel[0], sel[1]); } catch (e) { /* 무시 */ } }
  }
  if (v.mount) v.mount($view, ctx.ui(current), ctx);
  document.getElementById('viewTitle').textContent = '— ' + v.title;
  renderTabs();
}

function renderTabs() {
  document.getElementById('tabs').innerHTML = TABS.map((t, i) => {
    const on = t.v.id === current;
    return `<a class="${on ? 'on' : ''}" data-tab="${t.v.id}" title="${esc(t.t)} (Ctrl+${i + 1})" style="background:${on ? ACTIVE[t.v.id] : t.c}">${[...t.t.replace(/\s/g, '')].map(ch => `<span>${esc(ch)}</span>`).join('')}</a>`;
  }).join('');
}

// ---------- 공용 동작 ----------
const common = {
  toggle(el) {
    const id = el.dataset.id;
    let nowDone = false;
    store.update(s => { const t = taskById(s, id); if (t) { toggleTask(t); nowDone = t.done; } });
    if (nowDone) {
      const t = taskById(store.state, id);
      toast(`‘${t.title}’ 완료!`, { label: '되돌리기', fn: () => store.update(s => { const x = taskById(s, id); if (x && x.done) toggleTask(x); }) });
    }
  },
  'open-task'(el) { go('todo', { select: el.dataset.id }); },
  'open-url'(el, e) { e.stopPropagation(); window.harukan.openExternal(el.dataset.url); },
  'edit-link'(el) { const l = linkById(store.state, el.dataset.id); if (l) linkDialog(l); },
  'new-task'(el) { taskDialog({ date: el.dataset.date }); },
  'go'(el) { go(el.dataset.view, el.dataset.arg ? JSON.parse(el.dataset.arg) : null); }
};

async function taskMenu(id) {
  const t = taskById(store.state, id);
  if (!t) return;
  const r = await window.harukan.contextMenu([
    { id: 'toggle', label: t.done ? '완료 취소' : '완료' },
    { id: 'open', label: '자세히 보기 · 편집' },
    { type: 'separator' },
    { id: 'today', label: '오늘로' },
    { id: 'tomorrow', label: '내일로 미루기' },
    { id: 'nextweek', label: '다음 주 월요일로' },
    { id: 'nodate', label: '날짜 없음' },
    { type: 'separator' },
    { id: 'dup', label: '복제' },
    { id: 'del', label: '삭제' }
  ]);
  if (!r) return;
  if (r === 'toggle') return common.toggle({ dataset: { id } });
  if (r === 'open') return go('todo', { select: id });
  if (r === 'del') return deleteTask(id);
  store.update(s => {
    const x = taskById(s, id);
    if (r === 'today') x.date = today();
    if (r === 'tomorrow') x.date = addDays(x.date && x.date > today() ? x.date : today(), 1);
    if (r === 'nextweek') x.date = addDays(mondayOf(today()), 7);
    if (r === 'nodate') { x.date = null; x.time = null; }
    if (r === 'dup') s.tasks.push(Object.assign(JSON.parse(JSON.stringify(x)), { id: Date.now().toString(36) + 'd', done: false, doneAt: null, createdAt: Date.now() }));
  });
}

export function deleteTask(id) {
  const s = store.state;
  const idx = s.tasks.findIndex(t => t.id === id);
  if (idx < 0) return;
  const backup = s.tasks[idx];
  store.update(st => st.tasks.splice(idx, 1));
  toast(`‘${backup.title}’ 삭제했어요`, { label: '되돌리기', fn: () => store.update(st => st.tasks.splice(idx, 0, backup)) });
}
ctx.deleteTask = deleteTask;

async function linkMenu(id) {
  const l = linkById(store.state, id);
  if (!l) return;
  const r = await window.harukan.contextMenu([
    { id: 'open', label: '브라우저로 열기' },
    { id: 'edit', label: '편집' },
    { id: 'copy', label: '주소 복사' },
    { type: 'separator' },
    { id: 'del', label: '삭제' }
  ]);
  if (r === 'open') window.harukan.openExternal(l.url);
  if (r === 'edit') linkDialog(l);
  if (r === 'copy') { navigator.clipboard.writeText(l.url); toast('주소를 복사했어요'); }
  if (r === 'del') deleteLink(id);
}

function findAction(name) {
  const v = VIEWS[current];
  return (v.actions && v.actions[name]) || common[name];
}

$view.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || !$view.contains(el)) return;
  const fn = findAction(el.dataset.act);
  if (fn) { if (el.tagName === 'A') e.preventDefault(); fn(el, e, ctx); }
});
$view.addEventListener('dblclick', (e) => {
  const el = e.target.closest('[data-dbl]');
  if (!el) return;
  const fn = findAction(el.dataset.dbl);
  if (fn) fn(el, e, ctx);
});
$view.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (!el) return;
  const fn = findAction(el.dataset.change);
  if (fn) fn(el, e, ctx);
});
$view.addEventListener('input', (e) => {
  const el = e.target.closest('[data-input]');
  if (!el) return;
  const fn = findAction(el.dataset.input);
  if (fn) fn(el, e, ctx);
});
$view.addEventListener('keydown', (e) => {
  const el = e.target.closest('[data-enter]');
  if (!el || e.isComposing) return;
  if (e.key === 'Enter' && !(e.shiftKey && el.tagName === 'TEXTAREA')) {
    const fn = findAction(el.dataset.enter);
    if (fn) { e.preventDefault(); fn(el, e, ctx); }
  } else if (e.key === 'Escape' && el.dataset.esc) {
    const fn = findAction(el.dataset.esc);
    if (fn) fn(el, e, ctx);
  }
});
$view.addEventListener('contextmenu', (e) => {
  const el = e.target.closest('[data-ctx]');
  if (!el) return;
  e.preventDefault();
  const v = VIEWS[current];
  if (v.actions && v.actions['ctx-' + el.dataset.ctx]) return v.actions['ctx-' + el.dataset.ctx](el, e, ctx);
  if (el.dataset.ctx === 'task') taskMenu(el.dataset.id);
  if (el.dataset.ctx === 'link') linkMenu(el.dataset.id);
});

// 할 일 끌어서 다른 날짜로 옮기기 (주간 · 월간)
$view.addEventListener('dragstart', (e) => {
  const t = e.target.closest && e.target.closest('[data-ctx="task"][draggable="true"]');
  if (!t) return;
  e.dataTransfer.setData('text/x-task', t.dataset.id);
  e.dataTransfer.effectAllowed = 'move';
});
$view.addEventListener('dragover', (e) => {
  const z = e.target.closest('[data-drop-date]');
  if (!z || !e.dataTransfer.types.includes('text/x-task')) return;
  e.preventDefault();
  $view.querySelectorAll('.drop').forEach(x => x !== z && x.classList.remove('drop'));
  z.classList.add('drop');
});
$view.addEventListener('dragleave', (e) => {
  const z = e.target.closest('[data-drop-date]');
  if (z && !z.contains(e.relatedTarget)) z.classList.remove('drop');
});
$view.addEventListener('drop', (e) => {
  const z = e.target.closest('[data-drop-date]');
  const id = e.dataTransfer.getData('text/x-task');
  if (!z || !id) return;
  e.preventDefault();
  z.classList.remove('drop');
  store.update(s => { const t = taskById(s, id); if (t) t.date = z.dataset.dropDate; });
});

// ---------- 제목 표시줄 ----------
document.querySelectorAll('[data-win]').forEach(b => b.addEventListener('click', () => window.harukan.win(b.dataset.win)));
document.getElementById('newTask').onclick = () => taskDialog({ date: VIEWS[current].defaultDate ? VIEWS[current].defaultDate(ctx.ui(current)) : today() });
document.getElementById('openSettings').onclick = () => go(current === 'settings' ? 'week' : 'settings');
document.getElementById('tabs').addEventListener('click', (e) => { const a = e.target.closest('[data-tab]'); if (a) go(a.dataset.tab); });
document.querySelector('.titlebar').addEventListener('dblclick', (e) => { if (!e.target.closest('button,input,label')) window.harukan.win('max'); });
clickThrough((el) => !!el.closest('.paper, .tabs a, #modal > *, .search-pop, .toast, .viewer'));
document.querySelectorAll('[data-resize]').forEach(g => g.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  g.setPointerCapture(e.pointerId);
  window.harukan.resizeStart(g.dataset.resize);
  const end = () => { window.harukan.resizeEnd(); g.removeEventListener('pointerup', end); g.removeEventListener('lostpointercapture', end); };
  g.addEventListener('pointerup', end);
  g.addEventListener('lostpointercapture', end);
}));
window.harukan.onMaximized((m) => {
  document.body.classList.toggle('max', m);
  document.getElementById('maxBtn').innerHTML = m
    ? '<svg width="10" height="10" viewBox="0 0 10 10"><rect x="0.5" y="2.5" width="7" height="7" fill="none" stroke="#2B2420"/><path d="M2.5 2.5V.5h7v7h-2" fill="none" stroke="#2B2420"/></svg>'
    : '<svg width="10" height="10" viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="#2B2420"/></svg>';
});
window.harukan.onNavigate((view, arg) => { if (view && VIEWS[view]) go(view, arg); });

// ---------- 검색 ----------
const $search = document.getElementById('search');
let pop = null, results = [], selIdx = 0;
function closePop() { if (pop) { pop.remove(); pop = null; } }
const runSearch = debounce(() => {
  const q = $search.value.trim().toLowerCase();
  if (!q) return closePop();
  const s = store.state;
  results = [
    ...s.tasks.filter(t => (t.title + ' ' + (t.memo || '')).toLowerCase().includes(q)).slice(0, 12).map(t => ({ k: t.done ? '완료' : '할 일', t: t.title, sub: t.date || '', fn: () => go('todo', { select: t.id }) })),
    ...s.links.filter(l => ((l.title || '') + ' ' + l.url).toLowerCase().includes(q)).slice(0, 8).map(l => ({ k: '링크', t: l.title || l.url, sub: '', fn: () => linkDialog(l) })),
    ...s.ideas.filter(i => (i.title + ' ' + i.body + ' ' + i.tags.join(' ')).toLowerCase().includes(q)).slice(0, 8).map(i => ({ k: '아이디어', t: i.title, sub: '', fn: () => go('ideas', { open: i.id }) }))
  ];
  selIdx = 0;
  if (!pop) { pop = document.createElement('div'); pop.className = 'search-pop'; document.body.appendChild(pop); }
  const r = $search.getBoundingClientRect();
  pop.style.left = Math.max(8, r.left - 60) + 'px';
  drawPop();
}, 120);
function drawPop() {
  pop.innerHTML = results.length
    ? results.map((x, i) => `<div class="r ${i === selIdx ? 'on' : ''}" data-i="${i}"><span class="k">${esc(x.k)}</span><span class="ell grow">${esc(x.t)}</span><span class="muted" style="font-size:11px">${esc(x.sub.slice(5).replace('-', '.'))}</span></div>`).join('')
    : '<div class="empty" style="padding:10px">찾는 항목이 없어요</div>';
  pop.querySelectorAll('.r').forEach(el => el.addEventListener('mousedown', (e) => { e.preventDefault(); pick(+el.dataset.i); }));
}
function pick(i) { const x = results[i]; if (!x) return; closePop(); $search.value = ''; $search.blur(); x.fn(); }
$search.addEventListener('input', runSearch);
$search.addEventListener('blur', () => setTimeout(closePop, 150));
$search.addEventListener('keydown', (e) => {
  if (!pop) return;
  if (e.key === 'ArrowDown') { selIdx = Math.min(results.length - 1, selIdx + 1); drawPop(); e.preventDefault(); }
  if (e.key === 'ArrowUp') { selIdx = Math.max(0, selIdx - 1); drawPop(); e.preventDefault(); }
  if (e.key === 'Enter') { pick(selIdx); e.preventDefault(); }
  if (e.key === 'Escape') { closePop(); $search.value = ''; }
});

// ---------- 단축키 ----------
window.addEventListener('keydown', (e) => {
  if (document.getElementById('modal').firstChild) return;
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  if (e.ctrlKey && !e.altKey && /^[1-7]$/.test(e.key)) { go(TABS[+e.key - 1].v.id); e.preventDefault(); return; }
  if (e.ctrlKey && (e.key === 'n' || e.key === 'N')) { document.getElementById('newTask').click(); e.preventDefault(); return; }
  if (e.ctrlKey && (e.key === 'f' || e.key === 'F')) { $search.focus(); $search.select(); e.preventDefault(); return; }
  if (e.ctrlKey && e.key === ',') { go('settings'); e.preventDefault(); return; }
  if (!typing && VIEWS[current].onKey) VIEWS[current].onKey(e, ctx.ui(current), ctx);
});

// ---------- 시작 ----------
function welcome() {
  openDialog({
    body: `<div class="row" style="gap:10px"><span class="acc" style="display:flex"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v12l-4 4H4z"/><path d="M16 20v-4h4"/><path d="M8 9h8M8 13h5"/></svg></span><h2 style="font-size:24px">하루칸에 오신 걸 환영해요</h2></div>
      <div class="help" style="font-size:13.5px">바탕화면 위젯 · 주간/월간 플래너 · 할 일 · 작업 기록 · 아이디어 · 링크 · 유튜브 일정을 한 곳에서 관리해요.<br>
      트레이 아이콘을 <b>클릭</b>하면 플래너가, <b>우클릭</b>하면 위젯 선택 메뉴가 열려요. 어디서든 <b>Ctrl+Alt+N</b>으로 할 일을 바로 적을 수 있어요.</div>
      <div class="actions" style="justify-content:stretch"><button class="btn lite grow" id="empty" style="height:40px">빈 상태로 시작</button><button class="btn dark grow" id="sample" style="height:40px">예시 데이터로 둘러보기</button></div>`,
    onMount: (d, close) => {
      d.querySelector('#sample').onclick = () => { store.replace(sampleState()); close(); render(); };
      d.querySelector('#empty').onclick = () => { store.replace(emptyState()); close(); render(); };
    }
  });
}

store.subscribe(() => { if (!document.getElementById('modal').querySelector('.dialog') || VIEWS[current].liveUnderModal) render(); else pendingRender = true; });
let pendingRender = false;
new MutationObserver(() => { if (pendingRender && !document.getElementById('modal').firstChild) { pendingRender = false; render(); } })
  .observe(document.getElementById('modal'), { childList: true });

let lastDay = today();
setInterval(() => { if (today() !== lastDay) { lastDay = today(); render(); } }, 30000);

store.init().then((s) => {
  if (!s) welcome(); else render();
  renderTabs();
});

export { ctx, confirmDialog };
