// 1 · 주간
import { html, today, addDays, mondayOf, isoWeek, monthWeekLabel, md, WD, dow } from '../lib/util.js';
import { tasksOn, linksOn, cat, newTask, toggleTask } from '../lib/data.js';
import { holiday } from '../lib/holidays.js';
import { parseTask } from '../lib/parse.js';
import { taskLine, weekLink, photoUrl, bgImg, toast } from '../lib/ui.js';
import { taskDialog, photoViewer } from '../lib/modal.js';

export default {
  id: 'week',
  title: '주간',
  initUi: () => ({ monday: mondayOf(today()), adding: null }),
  onArg(arg, ui) { if (arg.date) ui.monday = mondayOf(arg.date); },
  defaultDate: (ui) => (mondayOf(today()) === ui.monday ? today() : ui.monday),

  render(s, ui) {
    const mon = ui.monday, t0 = today();
    const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
    const all = days.flatMap(d => tasksOn(s, d));
    const done = all.filter(t => t.done).length;
    const counts = s.categories.map(c => ({ c, n: all.filter(t => t.cat === c.id).length }));
    const note = s.notes.week[mon] || {};
    const overdue = days.filter(d => d < t0).flatMap(d => tasksOn(s, d).filter(t => !t.done));
    const isThis = mon === mondayOf(t0);

    return html`<div class="pad">
      <div class="head">
        <div>
          <div class="eyebrow">WEEK ${isoWeek(mon)}</div>
          <h1 class="h1">${monthWeekLabel(mon)} <small>${md(mon)} – ${md(addDays(mon, 6))}</small></h1>
        </div>
        <div class="row" style="gap:6px;margin-bottom:3px">
          <button class="btn sq" data-act="prev" aria-label="이전 주" title="이전 주 (←)">‹</button>
          <button class="btn" data-act="this" ${isThis ? 'disabled' : ''}>이번 주</button>
          <button class="btn sq" data-act="next" aria-label="다음 주" title="다음 주 (→)">›</button>
        </div>
        <span class="grow"></span>
        <div class="legend" style="margin-bottom:6px">${counts.map(x => html`<span style="color:${x.c.color}">● ${x.c.name} ${x.n}</span>`)}</div>
        <div style="text-align:right">
          <div class="muted" style="font-size:12px">이번 주 완료</div>
          <div class="bignum">${done}<small> / ${all.length}</small></div>
        </div>
        <button class="btn dark" style="height:40px;padding:0 16px" data-act="new-task" data-date="${isThis ? t0 : mon}">+ 기록하기</button>
      </div>

      <div class="week-grid">
        ${days.map((d, i) => {
          const list = tasksOn(s, d);
          const hol = holiday(d);
          const isToday = d === t0;
          const red = i === 6 || hol;
          const photos = list.filter(t => t.photos.length).slice(0, 2);
          const lks = linksOn(s, d);
          return html`<div class="wcol ${isToday ? 'today' : ''}" data-drop-date="${d}" data-dbl="add" data-date="${d}">
            <div class="dh">
              <span class="dn ${isToday ? 'acc' : red ? 'red' : ''}">${+d.slice(8)}</span>
              <span class="dw ${isToday ? 'acc' : red ? 'red' : ''}">${WD[dow(d)]}요일</span>
              ${isToday ? html`<span class="tag">오늘</span>` : hol ? html`<span class="tag hol">${hol}</span>` : ''}
            </div>
            <div class="wbody" data-keep="w${i}">
              ${list.map(t => taskLine(s, t, { drag: true }))}
              ${photos.map(t => html`<div class="polaroid wphoto" data-act="photo" data-name="${t.photos[0]}" style="transform:rotate(${i % 2 ? 2 : -2}deg)">
                <div class="ph" style="${bgImg(photoUrl(t.photos[0]))}"></div><span class="ell" style="padding:0 6px">${t.title}</span></div>`)}
              ${lks.map(l => weekLink(l))}
              ${ui.adding === d ? html`<div class="inline-add"><input type="text" data-enter="add-save" data-esc="add-cancel" data-date="${d}" data-focus="wadd" placeholder="할 일 — Enter" autofocus></div>` : ''}
            </div>
            ${ui.adding === d ? '' : html`<button class="btn ghost" style="align-self:flex-start;flex:none" data-act="add" data-date="${d}">+ 추가</button>`}
          </div>`;
        })}
      </div>

      <div class="foot3">
        <div class="card"><div class="h2">이번 주 목표</div>
          <textarea rows="1" data-change="goal" placeholder="이번 주에 꼭 끝낼 일을 적어 보세요">${note.goal || ''}</textarea></div>
        <div class="card"><div class="row"><span class="h2 grow">미룬 일 → 다음 주</span>
          ${overdue.length ? html`<button class="btn ghost" style="height:22px;margin:-4px -6px 0 0" data-act="defer">${overdue.length}개 다음 주로 ↷</button>` : ''}</div>
          ${overdue.length
            ? html`<div class="ell" style="font-size:13px">${overdue.map(t => t.title).join(' · ')}</div>`
            : html`<textarea rows="1" data-change="deferred" placeholder="미룬 일 메모">${note.deferred || ''}</textarea>`}
        </div>
        <div class="card" style="font-size:12.5px"><div class="h2">팁</div>할 일은 끌어서 다른 요일로 옮겨요. 빈 칸을 더블클릭하면 바로 추가돼요.</div>
      </div>
    </div>`;
  },

  mount(root) {
    const inp = root.querySelector('.inline-add input');
    if (inp) { inp.focus(); inp.scrollIntoView({ block: 'nearest' }); }
  },

  onKey(e, ui, ctx) {
    if (e.key === 'ArrowLeft') { ui.monday = addDays(ui.monday, -7); ctx.render(); }
    if (e.key === 'ArrowRight') { ui.monday = addDays(ui.monday, 7); ctx.render(); }
    if (e.key === 't' || e.key === 'T') { ui.monday = mondayOf(today()); ctx.render(); }
  },

  actions: {
    prev(el, e, ctx) { ctx.ui('week').monday = addDays(ctx.ui('week').monday, -7); ctx.render(); },
    next(el, e, ctx) { ctx.ui('week').monday = addDays(ctx.ui('week').monday, 7); ctx.render(); },
    this(el, e, ctx) { ctx.ui('week').monday = mondayOf(today()); ctx.render(); },
    add(el, e, ctx) {
      if (e.type === 'dblclick' && e.target.closest('.task-line,.wlink,.polaroid,button,input')) return;
      ctx.ui('week').adding = el.dataset.date; ctx.render();
    },
    'add-cancel'(el, e, ctx) { ctx.ui('week').adding = null; ctx.render(); },
    'add-save'(el, e, ctx) {
      const v = el.value.trim();
      if (!v) { ctx.ui('week').adding = null; ctx.render(); return; }
      const p = parseTask(v, ctx.s.categories, el.dataset.date);
      ctx.update(s => s.tasks.push(newTask({ title: p.title || v, date: el.dataset.date, time: p.time, cat: p.cat || s.categories[0].id })));
      // 입력칸을 열어 둔 채 연속으로 적을 수 있다
    },
    goal(el, e, ctx) { const mon = ctx.ui('week').monday; ctx.update(s => { s.notes.week[mon] = Object.assign({}, s.notes.week[mon], { goal: el.value }); }); },
    deferred(el, e, ctx) { const mon = ctx.ui('week').monday; ctx.update(s => { s.notes.week[mon] = Object.assign({}, s.notes.week[mon], { deferred: el.value }); }); },
    defer(el, e, ctx) {
      const mon = ctx.ui('week').monday, t0 = today();
      const next = addDays(mondayOf(t0), 7);
      let n = 0;
      ctx.update(s => s.tasks.forEach(t => { if (!t.done && t.date && t.date >= mon && t.date < t0 && t.date <= addDays(mon, 6)) { t.date = next; n++; } }));
      toast(`${n}개를 다음 주 월요일로 옮겼어요`);
    },
    photo(el) { photoViewer(photoUrl(el.dataset.name)); }
  }
};
