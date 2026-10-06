// 6 · 링크 보관함
import { html, uid, today, fmtDur, relDay } from '../lib/util.js';
import { detectKind, linkBadge, isYT, taskById, host } from '../lib/data.js';
import { I, thumbStyle, goButton, statusText, toast } from '../lib/ui.js';
import { applyYT, linkDialog } from '../lib/modal.js';

const emptyPaste = () => ({ url: '', draft: null, loading: false, date: today(), taskId: '' });

export default {
  id: 'links',
  title: '링크',
  initUi: () => ({ filter: 'all', paste: emptyPaste() }),

  render(s, ui) {
    const L = s.links.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const long = L.filter(l => l.kind === 'long'), shorts = L.filter(l => l.kind === 'short');
    const docs = L.filter(l => l.kind === 'doc'), webs = L.filter(l => l.kind === 'web');
    const f = ui.filter;
    const show = (k) => f === 'all' || f === k;
    const p = ui.paste;
    const d = p.draft;
    const tasks = s.tasks.filter(t => !t.done).sort((a, b) => (a.date || '9').localeCompare(b.date || '9')).slice(0, 60);

    return html`<div class="links-wrap">
      <main class="links-main" data-keep="links">
        <div class="head">
          <div><div class="eyebrow">LINKS</div><h1 class="h1">링크 보관함</h1></div>
          <span class="grow"></span>
          <div class="chips">
            ${[['all', `전체 ${L.length}`], ['long', `롱폼 ${long.length}`], ['short', `숏폼 ${shorts.length}`], ['doc', `문서 ${docs.length}`], ['web', `사이트 ${webs.length}`]].map(([k, n]) => html`<button class="chip ${f === k ? 'on' : ''}" data-act="filter" data-f="${k}">${n}</button>`)}
          </div>
        </div>

        ${show('long') ? html`<section>
          <div class="sec-h"><span class="h2" style="font-size:15.5px">YouTube · 롱폼</span><span class="muted" style="font-size:12px">${long.length}개</span></div>
          ${long.length ? html`<div class="lgrid">${long.map(l => vcard(l))}</div>` : html`<div class="empty">오른쪽에 유튜브 링크를 붙여넣어 보세요.</div>`}
        </section>` : ''}

        ${show('short') ? html`<section>
          <div class="sec-h"><span class="h2" style="font-size:15.5px">YouTube · 숏폼</span><span class="muted" style="font-size:12px">Shorts ${shorts.length}개</span></div>
          ${shorts.length ? html`<div class="sgrid">${shorts.map(l => vcard(l))}</div>` : html`<div class="empty">/shorts/ 주소는 자동으로 숏폼으로 분류돼요.</div>`}
        </section>` : ''}

        ${f === 'doc' || f === 'web' ? html`<section>
          <div class="sec-h"><span class="h2" style="font-size:15.5px">${f === 'doc' ? '문서' : '사이트'}</span><span class="muted" style="font-size:12px">${(f === 'doc' ? docs : webs).length}개</span></div>
          ${(f === 'doc' ? docs : webs).map(l => docRow(s, l))}
          ${(f === 'doc' ? docs : webs).length ? '' : html`<div class="empty">아직 없어요</div>`}
        </section>` : ''}
      </main>

      <aside class="links-side">
        <div class="card paste">
          <label class="field" style="gap:7px"><span style="color:var(--ink)">링크 붙여넣기 — 자동 인식</span>
            <input type="url" value="${p.url}" data-input="paste-in" data-enter="paste-save" data-focus="pasteUrl" placeholder="https://youtube.com/shorts/…">
          </label>
          ${p.loading ? html`<div class="muted" style="font-size:12.5px">정보 가져오는 중…</div>` : ''}
          ${d ? html`
            <div class="pv ${d.kind === 'short' ? 'short' : ''}">
              ${isYT(d) ? html`<div class="thumb" style="${thumbStyle(d)}">${d.kind === 'short' ? html`<span class="badge b-short" style="position:absolute;left:4px;top:4px">Shorts</span>` : ''}</div>` : ''}
              <div class="info">
                <span class="muted">${isYT(d) ? (d.kind === 'short' ? '숏폼' : '롱폼') + (d.duration ? ' · ' + fmtDur(d.duration) : '') : linkBadge(d).t + ' · ' + host(d.url)}</span>
                <input type="text" value="${d.title}" data-change="paste-title" style="font-weight:700;font-size:13.5px;border:none;border-bottom:1px dashed var(--line2);background:transparent;outline:none;padding:2px 0" placeholder="제목">
                ${d.channel ? html`<span class="muted">${d.channel}</span>` : ''}
                ${d.publishAt ? html`<span class="${statusText(d).cls}" style="display:flex;align-items:center;gap:4px">${I.clock(12)}${statusText(d).text}</span>` : ''}
              </div>
            </div>
            <div class="frow" style="gap:8px;font-size:12px">
              <label class="field"><span>연결 날짜</span><input type="date" value="${p.date}" data-change="paste-date" style="height:30px;border-width:1px"></label>
              ${isYT(d) ? html`<label class="field" style="flex:none;justify-content:flex-end"><span>&nbsp;</span><span class="row" style="gap:6px;height:30px;color:var(--ink);font-weight:400"><input type="checkbox" data-change="paste-mine" ${d.mine ? 'checked' : ''}>내 채널</span></label>` : ''}
            </div>
            <label class="field"><span>연결할 할 일</span><select data-change="paste-task" style="height:30px;border-width:1px">
              <option value="">— 없음 —</option>${tasks.map(t => html`<option value="${t.id}" ${p.taskId === t.id ? 'selected' : ''}>${t.date ? relDay(t.date) + ' · ' : ''}${t.title}</option>`)}
            </select></label>
            <div class="row" style="gap:8px">
              <span class="muted" style="font-size:12px">${p.taskId && taskById(s, p.taskId) ? '연결: ' + taskById(s, p.taskId).title : p.date ? '캘린더 ' + relDay(p.date) + '에 표시' : ''}</span>
              <span class="grow"></span>
              <button class="btn ghost" data-act="paste-more">자세히…</button>
              <button class="btn dark" data-act="paste-save" style="height:30px">저장</button>
            </div>` : ''}
          <span class="muted" style="font-size:11.5px;line-height:1.55">썸네일 · 제목 · 길이를 자동으로 가져와요. /shorts/ 주소거나 3분 이하 영상이면 숏폼(Shorts)으로 분류돼요. 예약 공개 시간은 [자세히…]에서 넣을 수 있어요.</span>
        </div>

        <div>
          <div class="sec-h" style="margin-bottom:4px"><span class="h2" style="font-size:15px">문서 · 사이트</span><span class="muted" style="font-size:12px">${docs.length + webs.length}개</span></div>
          ${docs.concat(webs).slice(0, 40).map(l => docRow(s, l))}
          ${docs.length + webs.length ? '' : html`<div class="empty">노션 · 구글 문서 · 사이트 주소를 붙여넣으면 여기 모여요.</div>`}
        </div>
      </aside>
    </div>`;
  },

  actions: {
    filter(el, e, ctx) { ctx.ui('links').filter = el.dataset.f; ctx.render(); },
    async 'paste-in'(el, e, ctx) {
      const ui = ctx.ui('links');
      const url = el.value.trim();
      ui.paste.url = url;
      const kind = detectKind(url);
      if (!kind || !/^https?:\/\/[^\s]+\.[^\s]+/.test(url)) { if (ui.paste.draft) { ui.paste.draft = null; ctx.render(); } return; }
      if (ui.paste.draft && ui.paste.draft.url === url) return;
      const draft = { id: uid(), url, kind, title: '', thumb: '', mine: false, createdAt: Date.now() };
      ui.paste.draft = draft;
      if (isYT(draft)) {
        ui.paste.loading = true; ctx.render();
        const r = await window.harukan.ytLookup(url);
        ui.paste.loading = false;
        if (ui.paste.draft !== draft) return;
        if (r.ok) { applyYT(draft, r.data); if (r.data.privateGuess) toast('비공개 · 예약 영상은 제목을 직접 적어 주세요'); }
      } else {
        try { const u = new URL(url); draft.title = u.hostname.replace(/^www\./, '') + (u.pathname.length > 1 ? u.pathname.replace(/\/$/, '') : ''); } catch (err) { /* 무시 */ }
      }
      ctx.render();
    },
    'paste-title'(el, e, ctx) { const d = ctx.ui('links').paste.draft; if (d) { d.title = el.value; d.titleEdited = true; } },
    'paste-date'(el, e, ctx) { ctx.ui('links').paste.date = el.value; ctx.render(); },
    'paste-task'(el, e, ctx) {
      const p = ctx.ui('links').paste;
      p.taskId = el.value;
      const t = taskById(ctx.s, el.value);
      if (t && t.date) p.date = t.date;
      ctx.render();
    },
    'paste-mine'(el, e, ctx) { const d = ctx.ui('links').paste.draft; if (d) d.mine = el.checked; },
    'paste-more'(el, e, ctx) {
      const p = ctx.ui('links').paste;
      if (!p.draft) return;
      linkDialog(null, Object.assign({}, p.draft, { date: p.date || null, taskId: p.taskId || null }));
      ctx.ui('links').paste = emptyPaste();
    },
    'paste-save'(el, e, ctx) {
      const ui = ctx.ui('links');
      const p = ui.paste;
      if (!p.draft) return;
      const l = Object.assign({}, p.draft, { date: p.date || null, taskId: p.taskId || null });
      if (!l.title) l.title = l.url;
      ctx.update(s => {
        s.links.push(l);
        if (l.taskId) { const t = taskById(s, l.taskId); if (t) t.links.push(l.id); }
      });
      ui.paste = emptyPaste();
      ctx.render();
      toast('링크를 저장했어요');
    }
  }
};

function vcard(l) {
  const st = statusText(l);
  return html`<div class="vcard lk" data-act="edit-link" data-id="${l.id}" data-ctx="link" title="${l.title}">
    <div class="thumb" style="${thumbStyle(l)}">
      <span class="kind badge ${l.kind === 'short' ? 'b-short' : 'b-notion'}">${l.kind === 'short' ? 'Shorts' : '롱폼'}</span>
      ${l.duration ? html`<span class="len">${fmtDur(l.duration)}</span>` : ''}
      <div class="go go-over">${goButton(l, '유튜브로')}</div>
    </div>
    <span class="t ell">${l.title || l.url}</span>
    <span class="s ${st.cls} ell">${st.text || (l.channel || host(l.url))}</span>
  </div>`;
}

function docRow(s, l) {
  const b = linkBadge(l);
  const t = l.taskId && taskById(s, l.taskId);
  const sub = [b.t === '웹' ? '사이트' : b.t, t ? t.title : (l.date ? relDay(l.date) : host(l.url))].join(' · ');
  return html`<div class="doc-row lk" data-ctx="link" data-id="${l.id}">
    <span class="ic ${b.cls}">${b.t === 'Notion' ? 'N' : b.t === '웹' ? '웹' : b.t.slice(0, 2)}</span>
    <div style="display:flex;flex-direction:column;gap:2px;min-width:0;cursor:pointer" data-act="edit-link" data-id="${l.id}"><span class="ell" style="font-size:13px;font-weight:700">${l.title || l.url}</span><span class="ell muted" style="font-size:11px">${sub}</span></div>
    <button class="go btn lite" style="height:26px;font-size:11.5px;padding:0 8px" data-act="open-url" data-url="${l.url}">${b.go} ↗</button>
  </div>`;
}
