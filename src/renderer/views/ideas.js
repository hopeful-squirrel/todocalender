// 5 · 아이디어 (아이디어 → 줄거리 → 콘티 → 완성)
import { html, uid, today, relDay, md, ymd } from '../lib/util.js';
import { IDEA_COLS, linkById } from '../lib/data.js';
import { I, statusText } from '../lib/ui.js';
import { ideaDialog, openDialog } from '../lib/modal.js';

function visible(s, ui) {
  return s.ideas.filter(i => (!ui.folder || i.folder === ui.folder) && (!ui.tag || i.tags.includes(ui.tag)));
}

export default {
  id: 'ideas',
  title: '아이디어',
  initUi: () => ({ folder: null, tag: null, mode: 'board' }),
  onArg(arg, ui, ctx) { if (arg.open) setTimeout(() => { const it = ctx.s.ideas.find(i => i.id === arg.open); if (it) ideaDialog(it); }, 0); },

  render(s, ui) {
    const list = visible(s, ui);
    const tags = [...new Set(s.ideas.flatMap(i => i.tags))].slice(0, 30);
    const folder = s.folders.find(f => f.id === ui.folder);

    return html`<div class="ideas-wrap">
      <nav class="fnav" aria-label="폴더">
        <div class="sec" style="padding-top:4px">폴더<span class="grow"></span><button class="btn ghost" style="height:22px;padding:0 6px" data-act="add-folder" aria-label="폴더 추가">+</button></div>
        <a class="${!ui.folder ? 'on' : ''}" data-act="folder" data-id="">전체<span class="n">${s.ideas.length}</span></a>
        ${s.folders.map(f => html`<a class="${ui.folder === f.id ? 'on' : ''}" data-act="folder" data-id="${f.id}" data-ctx="folder"><span class="cdot" style="background:${f.color}"></span>${f.name}<span class="n">${s.ideas.filter(i => i.folder === f.id).length}</span></a>`)}
        <div class="sec">태그</div>
        <div class="tags">${tags.length ? tags.map(t => html`<button class="tagc ${ui.tag === t ? 'on' : ''}" data-act="tag" data-t="${t}">#${t}</button>`) : html`<span class="empty" style="padding:0">#태그를 붙이면 여기 모여요</span>`}</div>
      </nav>

      <main style="flex:1;min-width:0;padding:18px 22px;display:flex;flex-direction:column;gap:14px">
        <div class="head" style="gap:14px">
          <div><div class="eyebrow">IDEA → STORY → CONTI</div><h1 class="h1">아이디어 노트 <small>${folder ? folder.name : '전체'}${ui.tag ? ' · #' + ui.tag : ''}</small></h1></div>
          <span class="grow"></span>
          <div class="seg" role="group" aria-label="보기">
            <button class="${ui.mode === 'board' ? 'on' : ''}" data-act="mode" data-m="board">보드</button>
            <button class="${ui.mode === 'list' ? 'on' : ''}" data-act="mode" data-m="list">목록</button>
          </div>
        </div>
        <label class="addbar">
          <span class="acc" style="display:flex">${I.bulb(18)}</span>
          <span class="sr">아이디어 적기</span>
          <input type="text" data-enter="quick" data-focus="ideaAdd" placeholder="떠오른 아이디어 바로 적기 — Enter (#태그 가능)">
          <span class="hint">Shift+Enter: 자세히 적기</span>
        </label>

        ${ui.mode === 'board' ? html`<div class="kanban">
          ${IDEA_COLS.map(col => {
            const cards = list.filter(i => i.col === col.id).sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt));
            return html`<div class="kcol" style="background:${col.bg}" data-col="${col.id}">
              <div class="kh"><span class="h2">${col.t}</span><span class="muted" style="font-size:11.5px">${col.sub}</span><span class="grow"></span><span class="muted" style="font-size:12px">${cards.length}</span></div>
              <div class="kbody" data-keep="k-${col.id}">
                ${cards.map(i => card(s, i))}
              </div>
              <button class="kadd" data-act="add-in" data-col="${col.id}">+ 카드 추가</button>
            </div>`;
          })}
        </div>` : html`<div class="ilist" data-keep="ilist">
          <div class="group-h"><span class="h2 grow">제목</span><span class="muted" style="width:110px;font-size:12px">단계</span><span class="muted" style="width:150px;font-size:12px">태그</span><span class="muted" style="width:70px;font-size:12px;text-align:right">날짜</span></div>
          ${list.length ? list.slice().sort((a, b) => b.createdAt - a.createdAt).map(i => html`<div class="trow" data-act="edit" data-id="${i.id}">
            <span class="t ell"><b>${i.title}</b> <span class="muted" style="font-size:12px">${(i.body || '').split('\n')[0]}</span></span>
            <span style="width:110px;font-size:12.5px">${IDEA_COLS.find(c => c.id === i.col).t}</span>
            <span class="ell acc" style="width:150px;font-size:12px">${i.tags.map(t => '#' + t).join(' ')}</span>
            <span class="when">${md(ymd(new Date(i.createdAt)))}</span>
          </div>`) : html`<div class="empty">아이디어가 없어요</div>`}
        </div>`}
      </main>
    </div>`;
  },

  mount(root, ui, ctx) {
    let dragId = null;
    root.querySelectorAll('.kcard').forEach(c => {
      c.addEventListener('dragstart', (e) => { dragId = c.dataset.id; c.classList.add('dragging'); e.dataTransfer.setData('text/x-idea', dragId); e.dataTransfer.effectAllowed = 'move'; });
      c.addEventListener('dragend', () => { c.classList.remove('dragging'); root.querySelectorAll('.kcol.drop').forEach(x => x.classList.remove('drop')); });
    });
    root.querySelectorAll('.kcol').forEach(col => {
      col.addEventListener('dragover', (e) => { if (!dragId) return; e.preventDefault(); col.classList.add('drop'); });
      col.addEventListener('dragleave', (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove('drop'); });
      col.addEventListener('drop', (e) => {
        e.preventDefault();
        col.classList.remove('drop');
        if (!dragId) return;
        // 놓은 위치 계산 — 마우스 아래 카드 앞에 넣는다
        const cards = [...col.querySelectorAll('.kcard')].filter(k => k.dataset.id !== dragId);
        const after = cards.find(k => e.clientY < k.getBoundingClientRect().top + k.offsetHeight / 2);
        const id = dragId; dragId = null;
        ctx.update(s => {
          const it = s.ideas.find(i => i.id === id);
          if (!it) return;
          it.col = col.dataset.col;
          const ordered = cards.map(k => s.ideas.find(i => i.id === k.dataset.id)).filter(Boolean);
          const pos = after ? ordered.findIndex(i => i.id === after.dataset.id) : ordered.length;
          ordered.splice(pos, 0, it);
          ordered.forEach((x, n) => { x.order = n; });
        });
      });
    });
  },

  actions: {
    folder(el, e, ctx) { ctx.ui('ideas').folder = el.dataset.id || null; ctx.render(); },
    tag(el, e, ctx) { const ui = ctx.ui('ideas'); ui.tag = ui.tag === el.dataset.t ? null : el.dataset.t; ctx.render(); },
    mode(el, e, ctx) { ctx.ui('ideas').mode = el.dataset.m; ctx.render(); },
    edit(el, e, ctx) { if (e.target.closest('a,[data-act="open-url"]')) return; const it = ctx.s.ideas.find(i => i.id === el.dataset.id); if (it) ideaDialog(it); },
    'add-in'(el, e, ctx) { const ui = ctx.ui('ideas'); ideaDialog(null, { col: el.dataset.col, folder: ui.folder || (ctx.s.folders[0] && ctx.s.folders[0].id) }); },
    quick(el, e, ctx) {
      const ui = ctx.ui('ideas');
      const v = el.value.trim();
      if (e.shiftKey) { ideaDialog(null, { title: v, folder: ui.folder || ctx.s.folders[0].id }); el.value = ''; return; }
      if (!v) return;
      const tags = [];
      const title = v.replace(/#([^\s#]+)/g, (_, t) => { tags.push(t); return ''; }).replace(/\s+/g, ' ').trim() || v;
      ctx.update(s => s.ideas.push({ id: uid(), col: 'idea', title, body: '', tags, folder: ui.folder || (s.folders[0] && s.folders[0].id), createdAt: Date.now(), order: -Date.now() }));
      el.value = '';
    },
    'add-folder'(el, e, ctx) {
      openDialog({
        body: html`<h2>폴더 추가</h2><label class="field"><span>이름</span><input id="n" type="text" autofocus></label>
          <label class="field"><span>색</span><input id="c" type="color" value="#4A5A8C" style="height:34px;width:60px;padding:2px"></label>
          <div class="actions"><button class="btn lite" data-close>취소</button><button class="btn dark" id="ok">추가</button></div>`.toString(),
        onMount: (d, close) => {
          const ok = () => { const n = d.querySelector('#n').value.trim(); if (!n) return; ctx.update(s => s.folders.push({ id: uid(), name: n, color: d.querySelector('#c').value })); close(); };
          d.querySelector('#ok').onclick = ok;
          d.querySelector('#n').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) ok(); });
        }
      });
    },
    async 'ctx-folder'(el, e, ctx) {
      const id = el.dataset.id;
      const r = await window.harukan.contextMenu([{ id: 'rename', label: '이름 바꾸기' }, { id: 'del', label: '폴더 삭제 (아이디어는 남음)' }]);
      if (r === 'rename') {
        const f = ctx.s.folders.find(x => x.id === id);
        openDialog({
          body: html`<h2>폴더 이름</h2><label class="field"><span>이름</span><input id="n" type="text" value="${f.name}" autofocus></label><div class="actions"><button class="btn lite" data-close>취소</button><button class="btn dark" id="ok">저장</button></div>`.toString(),
          onMount: (d, close) => { d.querySelector('#ok').onclick = () => { const n = d.querySelector('#n').value.trim(); if (n) ctx.update(s => { s.folders.find(x => x.id === id).name = n; }); close(); }; }
        });
      }
      if (r === 'del') {
        ctx.update(s => {
          s.folders = s.folders.filter(x => x.id !== id);
          s.ideas.forEach(i => { if (i.folder === id) i.folder = s.folders[0] ? s.folders[0].id : null; });
        });
        if (ctx.ui('ideas').folder === id) ctx.ui('ideas').folder = null;
      }
    }
  }
};

function card(s, i) {
  const v = i.linkId && linkById(s, i.linkId);
  const st = v && statusText(v);
  const due = i.due ? (i.due === today() ? '마감 오늘' : '마감 ' + md(i.due)) : '';
  return html`<div class="kcard" draggable="true" data-id="${i.id}" data-act="edit">
    <span class="kt">${i.title}</span>
    ${i.body ? html`<span class="kb">${i.body}</span>` : ''}
    ${i.panels ? html`<div class="panels">${Array.from({ length: i.panels }, (_, n) => html`<div style="background:${n < (i.panelsDone || 0) ? '#DDD3C0' : '#F4EFE6'}"></div>`)}</div>` : ''}
    ${v ? html`<a class="kyt" href="#" data-act="open-url" data-url="${v.url}"><span class="badge b-short" style="height:16px">▶</span><span class="ell">${st.text || v.title}</span></a>` : ''}
    <div class="kf">${i.tags.map(t => html`<span class="tg">#${t}</span>`)}<span class="grow"></span><span class="${i.due === today() ? 'red' : ''}">${due || relDay(ymd(new Date(i.createdAt)))}</span></div>
  </div>`;
}
