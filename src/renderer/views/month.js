// 2 · 월간
import { html, today, addDays, addMonths, parse, ymd, WD, mondayOf, fmtDur } from '../lib/util.js';
import { tasksOn, linksOn, cat, isYT, linkBadge } from '../lib/data.js';
import { holiday } from '../lib/holidays.js';
import { photoUrl, bgImg, thumbStyle, statusText, I } from '../lib/ui.js';

let clickTimer = null;
const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

export default {
  id: 'month',
  title: '월간',
  initUi: () => ({ first: today().slice(0, 8) + '01' }),
  onArg(arg, ui) { if (arg.date) ui.first = arg.date.slice(0, 8) + '01'; },
  defaultDate: (ui) => (ui.first.slice(0, 7) === today().slice(0, 7) ? today() : ui.first),

  render(s, ui) {
    const first = ui.first, t0 = today();
    const fd = parse(first);
    const start = addDays(first, -fd.getDay());
    const last = ymd(new Date(fd.getFullYear(), fd.getMonth() + 1, 0));
    const weeks = Math.ceil((fd.getDay() + +last.slice(8)) / 7);
    const cells = Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));
    const mk = first.slice(0, 7);
    const monthTasks = s.tasks.filter(t => t.date && t.date.startsWith(mk));
    const done = monthTasks.filter(t => t.done).length;
    const byCat = s.categories.map(c => ({ c, n: monthTasks.filter(t => t.cat === c.id && t.done).length }));
    const maxCat = Math.max(1, ...byCat.map(x => x.n));
    const vids = s.links.filter(l => isYT(l) && l.mine && l.publishAt && ymd(new Date(l.publishAt)).startsWith(mk))
      .sort((a, b) => a.publishAt.localeCompare(b.publishAt));
    const isThis = mk === t0.slice(0, 7);

    return html`<div class="month-wrap">
      <main style="flex:1;min-width:0;display:flex;flex-direction:column;gap:12px">
        <div class="head" style="gap:14px">
          <div>
            <div class="eyebrow">${MONTHS[fd.getMonth()]}</div>
            <h1 class="h1">${fd.getFullYear()}년 ${fd.getMonth() + 1}월</h1>
          </div>
          <div class="row" style="gap:6px;margin-bottom:3px">
            <button class="btn sq" data-act="prev" aria-label="이전 달" title="이전 달 (←)">‹</button>
            <button class="btn" data-act="this" ${isThis ? 'disabled' : ''}>오늘</button>
            <button class="btn sq" data-act="next" aria-label="다음 달" title="다음 달 (→)">›</button>
          </div>
          <span class="grow"></span>
          <div class="row muted" style="gap:12px;font-size:12px;margin-bottom:6px">
            <span class="row" style="gap:4px"><span style="width:13px;height:13px;background:#C4A88C;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.2)"></span>사진</span>
            <span class="row" style="gap:4px">${I.link(13)}링크</span>
            <span>칸을 누르면 그 주로 · <b>+</b> 로 바로 추가</span>
          </div>
        </div>
        <div class="mgrid" style="grid-template-rows:26px repeat(${weeks}, minmax(0, 1fr))">
          ${WD.map((w, i) => html`<div class="wh" style="${i === 0 ? 'color:var(--red)' : ''}">${w}</div>`)}
          ${cells.map((d, i) => {
            const out = !d.startsWith(mk);
            const list = tasksOn(s, d);
            const hol = holiday(d);
            const red = i % 7 === 0 || hol;
            const ph = list.find(t => t.photos.length);
            const lk = linksOn(s, d)[0];
            const dn = list.filter(t => t.done).length;
            const maxItems = weeks === 6 ? 2 : 3;
            return html`<div class="mcell ${out ? 'out' : ''} ${d === t0 ? 'today' : ''}" data-act="open-week" data-date="${d}" data-drop-date="${d}" data-dbl="quick-add">
              <div class="row" style="gap:5px">
                <span class="num" style="${d !== t0 && red ? 'color:var(--red)' : ''}">${+d.slice(8)}</span>
                <span class="ell" style="font-size:10px;color:var(--red)">${hol}</span>
                <span class="grow"></span>
                <span class="muted" style="font-size:10.5px;margin-right:${out ? 0 : 20}px">${list.length ? dn + '/' + list.length : ''}</span>
              </div>
              ${list.slice(0, maxItems).map(t => html`<div class="it ${t.done ? 'done' : ''}" data-ctx="task" data-id="${t.id}" draggable="true"><span class="dot" style="width:6px;height:6px;background:${cat(s, t.cat).color}"></span><span class="ell">${t.title}</span></div>`)}
              ${list.length > maxItems ? html`<span class="more">+${list.length - maxItems}개 더</span>` : ''}
              ${ph ? html`<span class="mph"><span style="${bgImg(photoUrl(ph.photos[0]))}"></span></span>` : ''}
              ${lk ? html`<span class="mlk badge ${linkBadge(lk).cls}">${linkBadge(lk).t}</span>` : ''}
              ${out ? '' : html`<button class="plus" data-act="quick-add" data-date="${d}" aria-label="${d} 할 일 추가">+</button>`}
            </div>`;
          })}
        </div>
      </main>

      <aside class="side">
        <div class="card">
          <div class="h2">${fd.getMonth() + 1}월 완료</div>
          <div class="bignum" style="font-size:40px">${done}<small> / ${monthTasks.length}</small></div>
          ${byCat.map(x => html`<div style="display:flex;flex-direction:column;gap:4px">
            <div class="row" style="font-size:12.5px"><span style="color:${x.c.color}">●</span>&nbsp;${x.c.name}<span class="grow"></span>${x.n}개</div>
            <div class="bar"><div style="width:${x.n / maxCat * 100}%;background:${x.c.color}"></div></div>
          </div>`)}
        </div>
        <div class="sticky" style="padding:14px 16px">
          <div class="h2" style="font-size:13.5px;margin-bottom:4px">이번 달 목표</div>
          <textarea rows="4" data-change="goal" placeholder="이번 달 목표를 적어 보세요">${s.notes.month[mk] || ''}</textarea>
        </div>
        <div class="card">
          <div class="row"><span class="h2 grow">이달의 유튜브</span><a href="#" data-act="go" data-view="youtube" style="font-size:12px">전체 ›</a></div>
          ${vids.length ? vids.slice(0, 5).map(v => {
            const st = statusText(v);
            return html`<div class="vrow lk" data-act="edit-link" data-id="${v.id}" data-ctx="link">
              <div class="thumb" style="${thumbStyle(v)}">${v.duration ? html`<span class="len">${fmtDur(v.duration)}</span>` : ''}</div>
              <div style="display:flex;flex-direction:column;gap:3px;min-width:0">
                <span class="row" style="gap:5px;min-width:0"><span class="badge ${v.kind === 'short' ? 'b-short' : 'b-notion'}">${v.kind === 'short' ? 'Shorts' : '롱폼'}</span><span class="ell" style="font-size:12.5px">${v.title}</span></span>
                <span class="${st.cls}" style="font-size:11px">${st.text}</span>
              </div>
            </div>`;
          }) : html`<div class="empty">이번 달 업로드 일정이 없어요</div>`}
        </div>
      </aside>
    </div>`;
  },

  onKey(e, ui, ctx) {
    if (e.key === 'ArrowLeft') { ui.first = addMonths(ui.first, -1); ctx.render(); }
    if (e.key === 'ArrowRight') { ui.first = addMonths(ui.first, 1); ctx.render(); }
    if (e.key === 't' || e.key === 'T') { ui.first = today().slice(0, 8) + '01'; ctx.render(); }
  },

  actions: {
    prev(el, e, ctx) { const ui = ctx.ui('month'); ui.first = addMonths(ui.first, -1); ctx.render(); },
    next(el, e, ctx) { const ui = ctx.ui('month'); ui.first = addMonths(ui.first, 1); ctx.render(); },
    this(el, e, ctx) { ctx.ui('month').first = today().slice(0, 8) + '01'; ctx.render(); },
    'open-week'(el, e, ctx) {
      if (e.detail > 1) return; // 더블클릭 중 첫 클릭은 무시
      clearTimeout(clickTimer);
      const d = el.dataset.date;
      clickTimer = setTimeout(() => ctx.go('week', { date: d }), 220);
    },
    'quick-add'(el, e, ctx) {
      e.stopPropagation();
      clearTimeout(clickTimer);
      import('../lib/modal.js').then(m => m.taskDialog({ date: el.dataset.date }));
    },
    goal(el, e, ctx) { const mk = ctx.ui('month').first.slice(0, 7); ctx.update(s => { s.notes.month[mk] = el.value; }); }
  }
};
