// 4 · 작업 기록 (끝낸 일 스크랩북)
import { html, today, addDays, mondayOf, ymd, md, parse } from '../lib/util.js';
import { cat, streak, linkById, linkBadge } from '../lib/data.js';
import { photoUrl, bgImg, goButton, I } from '../lib/ui.js';
import { photoViewer } from '../lib/modal.js';

function range(period) {
  const t0 = today();
  if (period === 'week') { const m = mondayOf(t0); return [m, addDays(m, 6), '이번 주']; }
  if (period === 'year') return [t0.slice(0, 4) + '-01-01', t0.slice(0, 4) + '-12-31', t0.slice(0, 4) + '년'];
  const d = parse(t0);
  return [t0.slice(0, 8) + '01', ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0)), (d.getMonth() + 1) + '월'];
}

export default {
  id: 'work',
  title: '작업',
  initUi: () => ({ period: 'month', filter: 'all' }),

  render(s, ui) {
    const t0 = today();
    const [from, to, label] = range(ui.period);
    const doneIn = s.tasks.filter(t => t.done && t.doneAt).map(t => ({ t, d: ymd(new Date(t.doneAt)) })).filter(x => x.d >= from && x.d <= to);
    const end = to < t0 ? to : t0;
    const elapsed = end >= from ? (parse(end) - parse(from)) / 86400000 + 1 : 1;
    const avg = (doneIn.length / elapsed).toFixed(1).replace(/\.0$/, '');
    const byCat = s.categories.map(c => ({ c, n: doneIn.filter(x => x.t.cat === c.id).length }));
    // 날짜별 막대 (올해는 월별)
    let bars;
    if (ui.period === 'year') {
      bars = Array.from({ length: 12 }, (_, m) => {
        const key = `${t0.slice(0, 4)}-${String(m + 1).padStart(2, '0')}`;
        return { k: m + 1 + '월', n: doneIn.filter(x => x.d.startsWith(key)).length, cur: key === t0.slice(0, 7), future: key > t0.slice(0, 7) };
      });
    } else {
      const len = (parse(to) - parse(from)) / 86400000 + 1;
      bars = Array.from({ length: len }, (_, i) => { const d = addDays(from, i); return { k: md(d), n: doneIn.filter(x => x.d === d).length, cur: d === t0, future: d > t0 }; });
    }
    const max = Math.max(1, ...bars.map(b => b.n));
    let cards = doneIn.slice().sort((a, b) => b.t.doneAt - a.t.doneAt);
    if (ui.filter === 'photo') cards = cards.filter(x => x.t.photos.length);
    else if (ui.filter !== 'all') cards = cards.filter(x => x.t.cat === ui.filter);
    const filters = [['all', `전체 ${doneIn.length}`], ['photo', `사진 있는 것 ${doneIn.filter(x => x.t.photos.length).length}`], ...s.categories.map(c => [c.id, c.name])];

    return html`<div class="pad">
      <div class="head">
        <div><div class="eyebrow">DONE LOG</div><h1 class="h1">작업 기록</h1></div>
        <span class="grow"></span>
        <div class="seg" role="group" aria-label="기간">
          ${[['week', '이번 주'], ['month', label.endsWith('월') ? label : (parse(t0).getMonth() + 1) + '월'], ['year', t0.slice(0, 4) + '년']].map(([k, n]) => html`<button class="${ui.period === k ? 'on' : ''}" data-act="period" data-p="${k}">${n}</button>`)}
        </div>
      </div>

      <div class="stats">
        <div class="card">
          <span class="muted" style="font-size:12px">${label}에 끝낸 일</span>
          <span class="big">${doneIn.length}<small>개</small></span>
          <span class="muted" style="font-size:12px">하루 평균 ${avg}개 · 연속 ${streak(s)}일</span>
        </div>
        <div class="card cats4" style="align-content:center">
          ${byCat.map(x => html`<div><span class="dot" style="background:${x.c.color}"></span><span>${x.c.name}</span><span class="grow"></span><b>${x.n}</b><span class="muted"> 개</span></div>`)}
        </div>
        <div class="card" style="gap:6px">
          <div class="row" style="font-size:12px"><span class="h2" style="font-size:13.5px">${ui.period === 'year' ? '월별' : '날짜별'} 완료 수</span><span class="grow"></span><span class="muted">${md(from)} – ${md(to)}</span></div>
          <div class="daily" style="grid-template-columns:repeat(${bars.length}, minmax(0, 1fr))">
            ${bars.map(b => html`<div title="${b.k} · ${b.n}개" style="height:${b.future ? 5 : Math.max(3, b.n / max * 64)}px;${b.cur ? 'background:var(--accent)' : b.future ? 'border:1px dashed var(--line2);background:transparent' : 'background:var(--ink)'}"></div>`)}
          </div>
          <div class="row muted" style="justify-content:space-between;font-size:10px"><span>${bars[0].k}</span><span>${bars[Math.floor(bars.length / 2)].k}</span><span>${bars[bars.length - 1].k}</span></div>
        </div>
      </div>

      <div class="row" style="gap:12px;flex:none">
        <div class="chips">${filters.map(([k, n]) => html`<button class="chip ${ui.filter === k ? 'on' : ''}" data-act="filter" data-f="${k}">${n}</button>`)}</div>
        <span class="grow"></span><span class="muted" style="font-size:12px">최근 완료순</span>
      </div>

      <div class="scrap" data-keep="scrap">
        ${cards.length ? cards.map(({ t, d }, i) => {
          const c = cat(s, t.cat);
          const lk = t.links.map(id => linkById(s, id)).filter(Boolean)[0];
          return html`<div class="scard lk" style="transform:rotate(${[-1.2, 0.8, -0.5, 1.4, -1][i % 5]}deg)" data-act="open-task" data-id="${t.id}" data-ctx="task">
            ${t.photos.length
              ? html`<div class="ph" style="${bgImg(photoUrl(t.photos[0]))}" data-act="photo" data-name="${t.photos[0]}"></div>`
              : html`<div class="memo-n">${t.memo || t.subtasks.map(x => (x.done ? '✓ ' : '· ') + x.t).join('\n') || t.title}</div>`}
            <div class="tt"><span class="dot" style="background:${c.color}"></span><span class="ell">${t.title}</span></div>
            <div class="mt"><span>${md(d)}</span><span>· ${c.name}</span>${t.photos.length > 1 ? html`<span>· 사진 ${t.photos.length}</span>` : ''}<span class="grow"></span>${lk ? html`<span class="badge ${linkBadge(lk).cls}">${linkBadge(lk).t}</span>` : ''}</div>
            ${lk ? html`<div class="go" style="position:absolute;left:0;right:0;top:0;height:124px;display:flex;align-items:center;justify-content:center;background:rgba(43,36,32,0.45)">${goButton(lk)}</div>` : ''}
          </div>`;
        }) : html`<div class="empty" style="grid-column:1/-1;padding:30px 0">${label}에 끝낸 일이 아직 없어요. 할 일을 완료하면 여기에 차곡차곡 쌓여요.</div>`}
      </div>
    </div>`;
  },

  actions: {
    period(el, e, ctx) { ctx.ui('work').period = el.dataset.p; ctx.render(); },
    filter(el, e, ctx) { ctx.ui('work').filter = el.dataset.f; ctx.render(); },
    photo(el, e) { e.stopPropagation(); photoViewer(photoUrl(el.dataset.name)); }
  }
};
