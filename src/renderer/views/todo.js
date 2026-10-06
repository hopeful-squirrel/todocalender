// 3 · 할 일
import { html, today, addDays, mondayOf, mdw, relDay, uid, ymd } from '../lib/util.js';
import { cat, byTime, newTask, toggleTask, taskById, linkById, linkBadge, detectKind } from '../lib/data.js';
import { parseTask } from '../lib/parse.js';
import { I, photoUrl, bgImg, thumbStyle, goButton, toast } from '../lib/ui.js';
import { linkDialog, photoViewer, fillLinkInfo } from '../lib/modal.js';

const VIEWS = [['today', '오늘'], ['week', '이번 주'], ['upcoming', '예정'], ['nodate', '날짜 없음'], ['done', '완료']];

function filtered(s, ui) {
  const t0 = today(), sun = addDays(mondayOf(t0), 6);
  let list = s.tasks;
  if (ui.cat) list = list.filter(t => t.cat === ui.cat);
  if (ui.attach === 'photo') list = list.filter(t => t.photos.length);
  if (ui.attach === 'link') list = list.filter(t => t.links.length);
  const f = ui.filter;
  if (f === 'done') return list.filter(t => t.done);
  if (f === 'today') return list.filter(t => t.date && (t.date === t0 || (t.date < t0 && !t.done)));
  if (f === 'week') return list.filter(t => t.date && t.date <= sun && (t.date >= t0 || !t.done));
  if (f === 'upcoming') return list.filter(t => !t.done && t.date && t.date > t0);
  if (f === 'nodate') return list.filter(t => !t.done && !t.date);
  return list.filter(t => !t.done);
}

function groups(s, ui, list) {
  const t0 = today(), t1 = addDays(t0, 1), sun = addDays(mondayOf(t0), 6);
  if (ui.filter === 'done') {
    const m = new Map();
    list.slice().sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)).forEach(t => {
      const k = t.doneAt ? ymd(new Date(t.doneAt)) : '';
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(t);
    });
    return [...m].slice(0, 30).map(([k, rows]) => ({ t: k ? relDay(k) : '날짜 모름', sub: k ? mdw(k) + ' 완료' : '', rows }));
  }
  const g = [
    { t: '기한 지남', sub: '', rows: list.filter(t => t.date && t.date < t0 && !t.done), late: true },
    { t: '오늘', sub: mdw(t0), rows: list.filter(t => t.date === t0) },
    { t: '내일', sub: mdw(t1), rows: list.filter(t => t.date === t1) },
    { t: '이번 주', sub: t1 < sun ? `${mdw(addDays(t1, 1)).split(' ')[0]} – ${mdw(sun).split(' ')[0]}` : '', rows: list.filter(t => t.date > t1 && t.date <= sun) },
    { t: '이후', sub: '', rows: list.filter(t => t.date > sun) },
    { t: '날짜 없음', sub: '', rows: list.filter(t => !t.date) }
  ];
  g.forEach(x => x.rows.sort((a, b) => (a.date || '').localeCompare(b.date || '') || byTime(a, b)));
  return g.filter(x => x.rows.length || (x.t === '오늘' && ui.filter === 'today'));
}

function whenText(t) {
  const t0 = today();
  if (!t.date) return '';
  if (t.date === t0) return t.time || '오늘';
  const n = (new Date(t.date) - new Date(t0)) / 86400000;
  if (n > 0 && n < 7 && t.date <= addDays(mondayOf(t0), 13)) return '월화수목금토일'[(new Date(t.date).getDay() + 6) % 7] + (t.time ? ' ' + t.time : '');
  return t.date.slice(5).replace('-', '.') + (t.time ? ' ' + t.time : '');
}

export default {
  id: 'todo',
  title: '할 일',
  initUi: () => ({ filter: 'today', cat: null, attach: null, select: null, pendPhotos: [], pendLink: '', linkOpen: false }),
  onArg(arg, ui, ctx) {
    if (arg.select) {
      const t = taskById(ctx.s, arg.select);
      ui.select = arg.select;
      if (t) {
        const vis = filtered(ctx.s, ui).some(x => x.id === t.id);
        if (!vis) { ui.cat = null; ui.attach = null; ui.filter = t.done ? 'done' : !t.date ? 'nodate' : t.date > addDays(mondayOf(today()), 6) ? 'upcoming' : 'week'; }
      }
    }
  },

  render(s, ui) {
    const t0 = today();
    const list = filtered(s, ui);
    const gs = groups(s, ui, list);
    const left = s.tasks.filter(t => !t.done && t.date && t.date <= t0).length;
    const todayDone = s.tasks.filter(t => t.done && t.doneAt && ymd(new Date(t.doneAt)) === t0).length;
    let sel = ui.select && taskById(s, ui.select);
    if (!sel) sel = gs[0] && gs[0].rows[0];
    const cnt = (f) => filtered(s, { ...ui, filter: f, cat: null, attach: null }).length;

    return html`<div class="todo-wrap">
      <nav class="fnav" aria-label="필터">
        ${VIEWS.map(([k, n]) => html`<a class="${ui.filter === k && !ui.cat && !ui.attach ? 'on' : ''}" data-act="filter" data-f="${k}">${n}<span class="n">${cnt(k)}</span></a>`)}
        <div class="sec">카테고리</div>
        ${s.categories.map(c => html`<a class="${ui.cat === c.id ? 'on' : ''}" data-act="cat" data-id="${c.id}"><span class="cdot" style="background:${c.color}"></span>${c.name}<span class="n">${s.tasks.filter(t => !t.done && t.cat === c.id).length}</span></a>`)}
        <div class="sec">첨부</div>
        <a class="${ui.attach === 'photo' ? 'on' : ''}" data-act="attach" data-a="photo">사진 있는 일<span class="n">${s.tasks.filter(t => t.photos.length).length}</span></a>
        <a class="${ui.attach === 'link' ? 'on' : ''}" data-act="attach" data-a="link">링크 있는 일<span class="n">${s.tasks.filter(t => t.links.length).length}</span></a>
      </nav>

      <main class="tlist">
        <div class="row" style="gap:14px;align-items:flex-end">
          <h1 class="h1" style="margin:0">할 일</h1>
          <span class="muted" style="font-size:13.5px;margin-bottom:4px">남은 일 <b style="color:var(--ink)">${left}개</b> · 오늘 완료 <b class="acc">${todayDone}개</b></span>
          ${ui.cat || ui.attach ? html`<button class="btn ghost" data-act="clear-filter" style="margin-bottom:2px">필터 해제 ✕</button>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;flex:none">
          <label class="addbar">
            ${I.plus(18)}
            <span class="sr">새 할 일</span>
            <input type="text" id="newTodo" data-enter="create" data-input="preview" data-focus="newTodo" placeholder="새 할 일 — 예) 내일 3시 샘플 촬영 #작업">
            <button class="ib ${ui.pendPhotos.length ? 'on' : ''}" data-act="pend-photo" aria-label="사진 첨부" title="사진 첨부">${I.photo()}</button>
            <button class="ib ${ui.linkOpen || ui.pendLink ? 'on' : ''}" data-act="pend-link" aria-label="링크 첨부" title="링크 첨부">${I.link()}</button>
          </label>
          ${ui.linkOpen ? html`<input type="url" class="addbar" style="min-height:36px;padding:0 12px;border-width:1px;font-size:13px" data-input="pend-link-in" data-enter="create-from-link" data-focus="pendLink" value="${ui.pendLink}" placeholder="첨부할 링크 주소 (유튜브 · 노션 · 사이트)">` : ''}
          <div class="preview-chips" id="todoPreview">${ui.pendPhotos.length ? html`<span>사진 ${ui.pendPhotos.length}장</span>` : ''}${ui.pendLink ? html`<span>링크 첨부</span>` : ''}</div>
        </div>
        <div class="scroll" data-keep="tlist">
          ${gs.length ? gs.map(g => html`<div style="display:flex;flex-direction:column">
            <div class="group-h"><span class="h2" style="font-size:15.5px;${g.late ? 'color:var(--red)' : ''}">${g.t}</span><span class="muted" style="font-size:12px">${g.sub}</span><span class="grow"></span><span class="muted" style="font-size:11.5px">${g.rows.filter(r => r.done).length}/${g.rows.length}</span></div>
            ${g.rows.length ? g.rows.map(t => {
              const c = cat(s, t.cat);
              const lk = t.links.map(id => linkById(s, id)).filter(Boolean)[0];
              const subDone = t.subtasks.filter(x => x.done).length;
              return html`<div class="trow ${t.done ? 'done' : ''} ${sel && sel.id === t.id ? 'sel' : ''}" data-act="select" data-id="${t.id}" data-ctx="task">
                <input type="checkbox" ${t.done ? 'checked' : ''} data-act="toggle" data-id="${t.id}" aria-label="${t.title} 완료">
                <span class="t ell">${t.title}${t.subtasks.length ? html` <span class="sub">${subDone}/${t.subtasks.length}</span>` : ''}</span>
                ${t.memo ? html`<span class="muted" title="메모" style="display:flex">${raw_memo}</span>` : ''}
                ${t.photos.length ? html`<span class="muted" aria-label="사진 있음" style="display:flex">${I.photo()}</span>` : ''}
                ${lk ? html`<span class="badge ${linkBadge(lk).cls}">${linkBadge(lk).t}</span>` : ''}
                <span class="pill" style="border-color:${c.color};color:${c.color}">${c.name}</span>
                <span class="when ${!t.done && t.date && t.date < t0 ? 'late' : ''}">${whenText(t)}</span>
              </div>`;
            }) : html`<div class="empty">오늘 할 일이 없어요. 위 입력칸에 적어 보세요.</div>`}
          </div>`) : html`<div class="empty" style="padding:30px 4px">${ui.filter === 'done' ? '아직 완료한 일이 없어요.' : '할 일이 없어요. 위 입력칸에 바로 적어 보세요.'}</div>`}
        </div>
      </main>

      ${sel ? detail(s, sel) : html`<aside class="detail"><div class="empty">할 일을 선택하면 여기에서 자세히 볼 수 있어요.</div></aside>`}
    </div>`;
  },

  mount(root, ui) {
    const d = root.querySelector('.detail[data-id]');
    if (d) {
      d.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); d.classList.add('dropzone-on'); } });
      d.addEventListener('dragleave', (e) => { if (!d.contains(e.relatedTarget)) d.classList.remove('dropzone-on'); });
      d.addEventListener('drop', async (e) => {
        e.preventDefault(); d.classList.remove('dropzone-on');
        const paths = [...e.dataTransfer.files].map(f => window.harukan.pathForFile(f)).filter(Boolean);
        const names = await window.harukan.savePhotoPaths(paths);
        if (names.length) attachPhotos(d.dataset.id, names);
      });
    }
  },

  onKey(e, ui, ctx) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const rows = [...document.querySelectorAll('.trow')];
      const i = rows.findIndex(r => r.classList.contains('sel'));
      const n = rows[Math.max(0, Math.min(rows.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))];
      if (n) { ui.select = n.dataset.id; ctx.render(); document.querySelector('.trow.sel')?.scrollIntoView({ block: 'nearest' }); }
      e.preventDefault();
    }
    if (e.key === ' ' && ui.select) { e.preventDefault(); document.querySelector(`.trow.sel input[type=checkbox]`)?.click(); }
    if (e.key === 'Delete' && ui.select) ctx.deleteTask(ui.select);
    if (e.key === 'n' || e.key === 'N') { document.getElementById('newTodo')?.focus(); e.preventDefault(); }
  },

  actions: {
    filter(el, e, ctx) { const ui = ctx.ui('todo'); ui.filter = el.dataset.f; ui.cat = null; ui.attach = null; ui.select = null; ctx.render(); },
    cat(el, e, ctx) { const ui = ctx.ui('todo'); ui.cat = ui.cat === el.dataset.id ? null : el.dataset.id; ui.attach = null; ui.filter = 'all'; ui.select = null; ctx.render(); },
    attach(el, e, ctx) { const ui = ctx.ui('todo'); ui.attach = ui.attach === el.dataset.a ? null : el.dataset.a; ui.cat = null; ui.filter = 'allx'; ui.select = null; ctx.render(); },
    'clear-filter'(el, e, ctx) { const ui = ctx.ui('todo'); ui.cat = null; ui.attach = null; ui.filter = 'today'; ctx.render(); },
    select(el, e, ctx) {
      if (e.target.closest('input')) return;
      ctx.ui('todo').select = el.dataset.id; ctx.render();
    },
    toggle(el, e, ctx) {
      e.stopPropagation();
      const id = el.dataset.id;
      ctx.update(s => { const t = taskById(s, id); if (t) toggleTask(t); });
    },
    preview(el, e, ctx) {
      const p = parseTask(el.value, ctx.s.categories);
      const ui = ctx.ui('todo');
      const chips = [];
      if (p.date) chips.push(relDay(p.date));
      if (p.time) chips.push(p.time);
      if (p.cat) chips.push('#' + cat(ctx.s, p.cat).name);
      if (ui.pendPhotos.length) chips.push(`사진 ${ui.pendPhotos.length}장`);
      if (ui.pendLink) chips.push('링크 첨부');
      document.getElementById('todoPreview').innerHTML = chips.map(c => `<span>${c.replace(/</g, '&lt;')}</span>`).join('');
    },
    async 'pend-photo'(el, e, ctx) {
      e.preventDefault();
      const names = await window.harukan.pickPhotos();
      if (names.length) { ctx.ui('todo').pendPhotos.push(...names); ctx.render(); document.getElementById('newTodo')?.focus(); }
    },
    'pend-link'(el, e, ctx) { e.preventDefault(); const ui = ctx.ui('todo'); ui.linkOpen = !ui.linkOpen; ctx.render(); if (ui.linkOpen) setTimeout(() => document.querySelector('[data-focus="pendLink"]')?.focus(), 0); },
    'pend-link-in'(el, e, ctx) { ctx.ui('todo').pendLink = el.value.trim(); },
    'create-from-link'(el, e, ctx) { document.getElementById('newTodo').focus(); },
    create(el, e, ctx) {
      const v = el.value.trim();
      if (!v) return;
      const ui = ctx.ui('todo');
      const p = parseTask(v, ctx.s.categories);
      const dateDefault = ui.filter === 'nodate' ? null : (ui.filter === 'upcoming' ? addDays(today(), 1) : today());
      const t = newTask({ title: p.title || v, date: p.date || dateDefault, time: p.time, cat: p.cat || ui.cat || ctx.s.categories[0].id });
      t.photos = ui.pendPhotos.slice();
      let linkId = null;
      if (ui.pendLink && detectKind(ui.pendLink)) {
        linkId = uid();
        t.links.push(linkId);
      }
      ctx.update(s => {
        if (linkId) s.links.push({ id: linkId, url: ui.pendLink, kind: detectKind(ui.pendLink), title: '', thumb: '', date: t.date, taskId: t.id, mine: false, createdAt: Date.now() });
        s.tasks.push(t);
      });
      ui.pendPhotos = []; ui.pendLink = ''; ui.linkOpen = false; ui.select = t.id;
      el.value = '';
      ctx.render();
      if (linkId) fillLinkInfo(linkId);
      toast(`‘${t.title}’ · ${t.date ? relDay(t.date) : '날짜 없음'}${t.time ? ' ' + t.time : ''}`);
    },

    // ----- 상세 -----
    blur(el) { el.blur(); },
    'd-cat'(el, e, ctx) { upd(ctx, el.dataset.tid, t => { t.cat = el.dataset.id; }); },
    'd-title'(el, e, ctx) { const v = el.value.trim(); if (v) upd(ctx, el.dataset.tid, t => { t.title = v; }); },
    'd-date'(el, e, ctx) { upd(ctx, el.dataset.tid, t => { t.date = el.value || null; if (!t.date) t.time = null; }); },
    'd-time'(el, e, ctx) { upd(ctx, el.dataset.tid, t => { t.time = el.value || null; }); },
    'd-done'(el, e, ctx) { upd(ctx, el.dataset.tid, t => toggleTask(t)); },
    'sub-toggle'(el, e, ctx) { upd(ctx, el.dataset.tid, t => { const x = t.subtasks.find(x => x.id === el.dataset.id); if (x) x.done = !x.done; }); },
    'sub-del'(el, e, ctx) { e.preventDefault(); upd(ctx, el.dataset.tid, t => { t.subtasks = t.subtasks.filter(x => x.id !== el.dataset.id); }); },
    'sub-add'(el, e, ctx) { const v = el.value.trim(); if (!v) return; upd(ctx, el.dataset.tid, t => t.subtasks.push({ id: uid(), t: v, done: false })); },
    async 'ph-add'(el, e, ctx) { const names = await window.harukan.pickPhotos(); if (names.length) attachPhotos(el.dataset.tid, names); },
    'ph-view'(el) { photoViewer(photoUrl(el.dataset.name)); },
    'ph-del'(el, e, ctx) {
      e.stopPropagation();
      const name = el.dataset.name;
      upd(ctx, el.dataset.tid, t => { t.photos = t.photos.filter(p => p !== name); });
      if (!ctx.s.tasks.some(t => t.photos.includes(name))) window.harukan.deletePhoto(name);
    },
    'lk-add'(el, e, ctx) { const t = taskById(ctx.s, el.dataset.tid); linkDialog(null, { taskId: t.id, date: t.date }); },
    'lk-del'(el, e, ctx) { e.stopPropagation(); upd(ctx, el.dataset.tid, t => { t.links = t.links.filter(x => x !== el.dataset.id); }); ctx.update(s => { const l = linkById(s, el.dataset.id); if (l && l.taskId === el.dataset.tid) l.taskId = null; }); },
    'd-memo'(el, e, ctx) { upd(ctx, el.dataset.tid, t => { t.memo = el.value; }); },
    'd-del'(el, e, ctx) { ctx.ui('todo').select = null; ctx.deleteTask(el.dataset.tid); },
    'd-week'(el, e, ctx) { const t = taskById(ctx.s, el.dataset.tid); ctx.go('week', { date: t.date || today() }); }
  }
};

const raw_memo = I.logoLines(14);
let ctxRef = null;
function upd(ctx, id, fn) { ctxRef = ctx; ctx.update(s => { const t = taskById(s, id); if (t) fn(t); }); }
function attachPhotos(id, names) {
  import('../lib/data.js').then(({ store }) => store.update(s => { const t = taskById(s, id); if (t) t.photos.push(...names); }));
}

function detail(s, t) {
  const c = cat(s, t.cat);
  const lks = t.links.map(id => linkById(s, id)).filter(Boolean);
  return html`<aside class="detail" aria-label="할 일 상세" data-id="${t.id}">
    <div class="catpick">${s.categories.map(x => html`<button class="${x.id === t.cat ? 'on' : ''}" style="${x.id === t.cat ? `background:${x.color};border-color:${x.color}` : ''}" data-act="d-cat" data-id="${x.id}" data-tid="${t.id}">${x.name}</button>`)}</div>
    <div class="row" style="gap:10px">
      <input type="checkbox" ${t.done ? 'checked' : ''} data-change="d-done" data-tid="${t.id}" aria-label="완료" style="width:20px;height:20px">
      <input class="title-in" type="text" value="${t.title}" data-change="d-title" data-enter="blur" data-tid="${t.id}" aria-label="제목">
    </div>
    <div class="meta-row">
      <input type="date" value="${t.date || ''}" data-change="d-date" data-tid="${t.id}" aria-label="날짜">
      <input type="time" value="${t.time || ''}" data-change="d-time" data-tid="${t.id}" aria-label="시간" ${t.date ? '' : 'disabled'}>
      ${t.date ? html`<button class="btn ghost" data-act="d-week" data-tid="${t.id}">주간에서 보기 ›</button>` : ''}
    </div>
    <div class="lbl">세부 단계 <span class="muted" style="font-family:var(--sans);font-weight:400">${t.subtasks.filter(x => x.done).length}/${t.subtasks.length}</span></div>
    <div class="subs">
      ${t.subtasks.map(x => html`<label class="${x.done ? 'done' : ''}"><input type="checkbox" ${x.done ? 'checked' : ''} data-change="sub-toggle" data-tid="${t.id}" data-id="${x.id}" style="width:15px;height:15px"><span>${x.t}</span><button class="x" data-act="sub-del" data-tid="${t.id}" data-id="${x.id}" aria-label="단계 삭제">✕</button></label>`)}
      <label><span style="width:15px;text-align:center;color:var(--muted)">+</span><input type="text" placeholder="단계 추가 — Enter" data-enter="sub-add" data-tid="${t.id}" data-focus="subAdd"></label>
    </div>
    <div class="lbl">사진 ${t.photos.length || ''} <span class="muted" style="font-family:var(--sans);font-weight:400;font-size:11px">끌어다 놓아도 돼요</span></div>
    <div class="photos">
      ${t.photos.map((p, i) => html`<div class="polaroid" data-act="ph-view" data-name="${p}" style="transform:rotate(${i % 2 ? 1.5 : -1.5}deg)"><div class="ph" style="${bgImg(photoUrl(p))}"></div><button class="x" data-act="ph-del" data-tid="${t.id}" data-name="${p}" aria-label="사진 삭제">✕</button></div>`)}
      <button class="addph" data-act="ph-add" data-tid="${t.id}" aria-label="사진 추가">+</button>
    </div>
    <div class="lbl">링크</div>
    ${lks.map(l => html`<div class="dlink lk hov" data-ctx="link" data-id="${l.id}">
      <div class="thumb" style="${thumbStyle(l)}">${l.kind === 'long' || l.kind === 'short' ? html`<span class="play">${I.playTri}</span>` : html`<span style="font-weight:700;color:var(--muted)">${linkBadge(l).t}</span>`}</div>
      <div class="info"><span class="badge ${linkBadge(l).cls}" style="align-self:flex-start">${linkBadge(l).t}</span><span class="ell">${l.title || l.url}</span></div>
      <div class="go go-over">${goButton(l)}<button class="go-btn" style="margin-left:6px" data-act="edit-link" data-id="${l.id}">편집</button></div>
    </div>`)}
    <button class="btn lite" style="align-self:flex-start;height:28px;font-size:12px" data-act="lk-add" data-tid="${t.id}">${I.link(13)} 링크 추가</button>
    <div class="sticky memo" style="flex:1"><textarea data-change="d-memo" data-tid="${t.id}" placeholder="메모">${t.memo || ''}</textarea></div>
    <div class="row muted" style="font-size:11px;gap:8px">
      <span>${t.done && t.doneAt ? '완료 ' + new Date(t.doneAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '만든 날 ' + new Date(t.createdAt || Date.now()).toLocaleDateString('ko-KR')}</span>
      <span class="grow"></span>
      <button class="btn ghost" style="color:var(--red)" data-act="d-del" data-tid="${t.id}">${I.trash(13)} 삭제</button>
    </div>
  </aside>`;
}
