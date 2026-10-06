// 바탕화면 위젯 — 달력 · 오늘 할 일 · 이번 주 작업량
import { html, today, addDays, addMonths, mondayOf, parse, ymd, md, mdw, WD, dow } from './lib/util.js';
import { store, tasksOn, cat, newTask, toggleTask, taskById, streak, linksOn } from './lib/data.js';
import { holiday } from './lib/holidays.js';
import { parseTask } from './lib/parse.js';
import { I } from './lib/ui.js';
import { clickThrough } from './lib/clickthrough.js';

const $root = document.getElementById('root');
let calFirst = today().slice(0, 8) + '01';
let lastBadge = null;

const closeBtn = (k, label) => html`<button class="wx" data-act="close" data-k="${k}" aria-label="${label} 위젯 닫기" title="닫기 (트레이 메뉴에서 다시 켤 수 있어요)"><svg width="13" height="13" viewBox="0 0 14 14"><path d="M1 1l12 12M13 1 1 13" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg></button>`;

function render() {
  const s = store.state;
  if (!s) {
    $root.innerHTML = html`<div class="none">하루칸을 시작하려면 플래너 창에서 시작 방법을 골라 주세요.<br><button data-act="planner">플래너 열기</button></div>`.toString();
    return;
  }
  const st = s.settings || {};
  const show = Object.assign({ cal: true, todo: true, week: true }, st.widgets);
  document.body.classList.toggle('locked', !!st.widgetLocked);
  const active = document.activeElement;
  const typing = active && active.id === 'qa' ? active.value : null;
  $root.innerHTML = html`
    ${show.cal ? calendar(s) : ''}
    ${show.todo ? todoW(s) : ''}
    ${show.week ? weekW(s) : ''}
    ${!show.cal && !show.todo && !show.week ? html`<div class="none drag">위젯이 모두 닫혀 있어요.<br>트레이 아이콘 우클릭 › 위젯 선택에서 다시 켤 수 있어요.<br><button data-act="all-on">모두 다시 켜기</button></div>` : ''}
  `.toString();
  if (typing != null) { const q = document.getElementById('qa'); if (q) { q.value = typing; q.focus(); } }
  badge(s);
}

function calendar(s) {
  const t0 = today();
  const fd = parse(calFirst);
  const start = addDays(calFirst, -fd.getDay());
  const lastDay = new Date(fd.getFullYear(), fd.getMonth() + 1, 0).getDate();
  const n = Math.ceil((fd.getDay() + lastDay) / 7) * 7;
  const mk = calFirst.slice(0, 7);
  const cells = Array.from({ length: n }, (_, i) => addDays(start, i));
  const td = parse(t0);
  const isThis = mk === t0.slice(0, 7);
  return html`<div class="wg"><div class="w yellow cal">
    <div class="row drag" style="align-items:flex-start">
      <div>
        <div class="row" style="gap:4px;font-size:12.5px;color:var(--sticky-ink)">
          <button class="nav" data-act="cal-prev" aria-label="이전 달">‹</button>
          <span>${fd.getFullYear()}년 ${fd.getMonth() + 1}월</span>
          <button class="nav" data-act="cal-next" aria-label="다음 달">›</button>
          ${isThis ? '' : html`<button class="nav" style="width:auto;padding:0 5px;font-size:11px" data-act="cal-today">오늘</button>`}
        </div>
        <div class="big">${td.getDate()}일 <span>${WD[td.getDay()]}요일</span></div>
      </div>
      <span class="grow"></span>
      <button class="ob" data-act="open" data-view="month" data-date="${calFirst}" aria-label="월간 열기" title="월간 열기">${I.open(17)}</button>
    </div>
    <div class="mini">
      ${WD.map((w, i) => html`<div class="h" style="${i === 0 ? 'color:var(--red)' : ''}">${w}</div>`)}
      ${cells.map((d, i) => {
        const out = !d.startsWith(mk);
        const list = out ? [] : tasksOn(s, d);
        const first = list.find(t => !t.done) || list[0];
        const red = i % 7 === 0 || holiday(d);
        return html`<button class="c ${out ? 'out' : ''} ${d === t0 ? 'today' : ''} ${red && !out ? 'red' : ''}" data-act="open" data-view="week" data-date="${d}" title="${mdw(d)}${holiday(d) ? ' · ' + holiday(d) : ''}${list.length ? ` · 할 일 ${list.length}개` : ''}">
          <span class="n">${+d.slice(8)}</span>
          <span class="d" style="background:${first && d !== t0 ? cat(s, first.cat).color : 'transparent'}"></span>
        </button>`;
      })}
    </div>
  </div>${closeBtn('cal', '달력')}</div>`;
}

function todoW(s) {
  const t0 = today();
  const overdue = s.tasks.filter(t => t.date && t.date < t0 && !t.done);
  const list = tasksOn(s, t0);
  const items = overdue.concat(list);
  const done = list.filter(t => t.done).length;
  const total = items.length;
  const MAX = 8;
  return html`<div class="wg"><div class="w yellow todo">
    <div class="drag" style="display:flex;flex-direction:column;gap:7px">
      <div class="row" style="align-items:baseline"><span class="serif b" style="font-size:15.5px">오늘 할 일</span><span style="font-size:12px;color:var(--sticky-ink);margin-left:6px">${mdw(t0)}</span><span class="grow"></span><span style="font-size:12.5px;color:#5C4B22">${done} / ${total} 완료</span></div>
      <div class="prog"><div style="width:${total ? done / total * 100 : 0}%"></div></div>
    </div>
    <div class="tl">
      ${items.slice(0, MAX).map(t => html`<label class="${t.done ? 'done' : ''}" data-id="${t.id}">
        <input type="checkbox" ${t.done ? 'checked' : ''} data-act="toggle" data-id="${t.id}" aria-label="${t.title} 완료">
        <span class="t">${t.title}</span>
        ${t.date < t0 ? html`<span class="tm late">${md(t.date)}</span>` : t.time ? html`<span class="tm">${t.time}</span>` : ''}
        <span class="dot" style="width:9px;height:9px;background:${cat(s, t.cat).color}"></span>
      </label>`)}
      ${items.length > MAX ? html`<button class="more" data-act="open" data-view="todo">+ ${items.length - MAX}개 더 보기</button>` : ''}
      ${!items.length ? html`<div style="font-size:13px;color:var(--sticky-ink);padding:8px 0">오늘 할 일이 없어요 ☺ 아래에 적어 보세요.</div>` : ''}
    </div>
    <label class="qa">
      ${I.plus(16)}
      <span class="sr">할 일 빠른 추가</span>
      <input id="qa" type="text" placeholder="할 일 추가 — Enter  (예: 내일 3시 촬영 #작업)">
    </label>
  </div>${closeBtn('todo', '할 일')}</div>`;
}

function weekW(s) {
  const t0 = today();
  const mon = mondayOf(t0);
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const stats = days.map(d => { const l = tasksOn(s, d); return { d, total: l.length, done: l.filter(t => t.done).length }; });
  const weekDone = stats.reduce((a, x) => a + x.done, 0);
  const maxT = Math.max(3, ...stats.map(x => x.total));
  const photos = days.flatMap(d => tasksOn(s, d)).reduce((a, t) => a + t.photos.length, 0);
  const links = days.reduce((a, d) => a + linksOn(s, d).length, 0);
  const st = streak(s);
  return html`<div class="wg"><div class="w paper week">
    <div class="row drag" style="align-items:baseline"><span class="serif b" style="font-size:15.5px">이번 주</span><span class="muted" style="font-size:12px;margin-left:6px">${md(mon)} – ${md(addDays(mon, 6))}</span><span class="grow"></span><span class="serif b acc">${weekDone}개 완료</span></div>
    <div class="bars">
      ${stats.map((x, i) => {
        const h = Math.max(10, x.total / maxT * 62) + 'px';
        const pct = x.total ? x.done / x.total * 100 : 0;
        const isT = x.d === t0, past = x.d < t0;
        const style = isT ? `border:1.5px solid var(--accent);background:linear-gradient(to top, var(--accent) ${pct}%, transparent ${pct}%);`
          : past ? `background:linear-gradient(to top, var(--ink) ${pct}%, #CFC3AE ${pct}%);` : 'border:1.5px dashed #B9AC97;';
        const red = i === 6 || holiday(x.d);
        return html`<button data-act="open" data-view="week" data-date="${x.d}" title="${mdw(x.d)} · ${x.done}/${x.total}">
          <span class="bn">${x.done}/${x.total}</span>
          <span class="bb" style="height:${h};${style}"></span>
          <span style="font-size:12px;${isT ? 'color:var(--accent);font-weight:700' : red ? 'color:var(--red)' : ''}">${WD[dow(x.d)]}</span>
        </button>`;
      })}
    </div>
    <div class="wchips">
      <span class="acc">연속 ${st}일</span>
      <button data-act="open" data-view="work">작업 사진 ${photos}</button>
      <button data-act="open" data-view="links">링크 ${links}</button>
    </div>
  </div>${closeBtn('week', '이번 주')}</div>`;
}

// 트레이 아이콘 · 작업표시줄 배지 (남은 할 일 수)
function badge(s) {
  const t0 = today();
  const left = s.tasks.filter(t => !t.done && t.date && t.date <= t0).length;
  if (left === lastBadge) return;
  lastBadge = left;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#F5E39A';
  rr(g, 2, 2, 28, 28, 6); g.fill();
  g.strokeStyle = '#2B2420'; g.lineWidth = 2.2; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(8, 8); g.lineTo(24, 8); g.lineTo(24, 19); g.lineTo(19, 24); g.lineTo(8, 24); g.closePath(); g.stroke();
  g.beginPath(); g.moveTo(19, 24); g.lineTo(19, 19); g.lineTo(24, 19); g.stroke();
  g.beginPath(); g.moveTo(11.5, 13); g.lineTo(20.5, 13); g.moveTo(11.5, 17); g.lineTo(16, 17); g.stroke();
  if (left > 0) {
    g.fillStyle = '#8A3B12';
    g.beginPath(); g.arc(24, 8, 8, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#FBF7EE'; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(left > 99 ? '99' : String(left), 24, 8.5);
  }
  const o = document.createElement('canvas');
  o.width = o.height = 16;
  const h = o.getContext('2d');
  h.fillStyle = '#8A3B12'; h.beginPath(); h.arc(8, 8, 8, 0, Math.PI * 2); h.fill();
  h.fillStyle = '#fff'; h.font = 'bold 10px sans-serif'; h.textAlign = 'center'; h.textBaseline = 'middle';
  h.fillText(left > 9 ? '9+' : String(left), 8, 8.5);
  window.harukan.setBadge(left, c.toDataURL(), o.toDataURL());
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

// ---------- 이벤트 ----------
$root.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const a = el.dataset.act;
  if (a === 'toggle') { const id = el.dataset.id; store.update(s => { const t = taskById(s, id); if (t) toggleTask(t); }); }
  if (a === 'close') { const k = el.dataset.k; store.update(s => { s.settings.widgets = Object.assign({ cal: true, todo: true, week: true }, s.settings.widgets, { [k]: false }); }); }
  if (a === 'all-on') store.update(s => { s.settings.widgets = { cal: true, todo: true, week: true }; });
  if (a === 'open') window.harukan.openPlanner(el.dataset.view, el.dataset.date ? { date: el.dataset.date } : null);
  if (a === 'planner') window.harukan.openPlanner();
  if (a === 'cal-prev') { calFirst = addMonths(calFirst, -1); render(); }
  if (a === 'cal-next') { calFirst = addMonths(calFirst, 1); render(); }
  if (a === 'cal-today') { calFirst = today().slice(0, 8) + '01'; render(); }
});
$root.addEventListener('keydown', (e) => {
  if (e.target.id !== 'qa' || e.isComposing) return;
  if (e.key === 'Escape') { e.target.value = ''; e.target.blur(); }
  if (e.key !== 'Enter') return;
  const v = e.target.value.trim();
  if (!v) return;
  const p = parseTask(v, store.state.categories);
  e.target.value = '';
  store.update(s => s.tasks.push(newTask({ title: p.title || v, date: p.date || today(), time: p.time, cat: p.cat || s.categories[0].id })));
  setTimeout(() => document.getElementById('qa')?.focus(), 0);
});
$root.addEventListener('contextmenu', (e) => {
  if (e.target.closest('input')) return;
  e.preventDefault();
  window.harukan.widgetMenu();
});

new ResizeObserver(() => {
  const r = $root.getBoundingClientRect();
  window.harukan.widgetResize(Math.ceil(r.width), Math.ceil(r.height));
}).observe($root);

clickThrough((el) => !!el.closest('.w, .wx, .none'));
store.subscribe(render);
let lastDay = today();
setInterval(() => { if (today() !== lastDay) { lastDay = today(); calFirst = lastDay.slice(0, 8) + '01'; lastBadge = null; render(); } }, 30000);
store.init().then(render);
