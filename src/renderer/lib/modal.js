// 대화상자 — 할 일 · 링크 · 아이디어 편집
import { html, esc, uid, today, pad, ymd, fmtDur } from './util.js';
import { store, newTask, detectKind, IDEA_COLS, isYT } from './data.js';
import { parseTask } from './parse.js';
import { thumbStyle, toast } from './ui.js';

export function openDialog({ body, wide, onMount }) {
  const root = document.getElementById('modal');
  root.innerHTML = `<div class="scrim"><div class="dialog ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${body}</div></div>`;
  const scrim = root.firstChild, dlg = scrim.firstChild;
  document.body.classList.add('modal-open');
  const close = () => { root.innerHTML = ''; document.body.classList.remove('modal-open'); document.removeEventListener('keydown', onKey, true); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);
  scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) close(); });
  dlg.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
  if (onMount) onMount(dlg, close);
  const first = dlg.querySelector('[autofocus]') || dlg.querySelector('input,textarea');
  if (first) setTimeout(() => first.focus(), 20);
  return close;
}

export function confirmDialog(msg, okLabel = '삭제') {
  return new Promise(resolve => {
    let ok = false;
    const close = openDialog({
      body: html`<h2>확인</h2><div style="font-size:14px;line-height:1.6">${msg}</div>
        <div class="actions"><button class="btn lite" data-close>취소</button><button class="btn dark" id="ok">${okLabel}</button></div>`.toString(),
      onMount: (d, c) => {
        d.querySelector('#ok').onclick = () => { ok = true; c(); resolve(true); };
        const obs = new MutationObserver(() => { if (!document.body.contains(d)) { obs.disconnect(); if (!ok) resolve(false); } });
        obs.observe(document.getElementById('modal'), { childList: true });
      }
    });
    return close;
  });
}

const catOptions = (sel) => raw(store.state.categories.map(c => `<option value="${esc(c.id)}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join(''));

// ---------- 할 일 추가 ----------
export function taskDialog(defaults = {}) {
  const s = store.state;
  openDialog({
    body: html`<h2>할 일 기록하기</h2>
      <label class="field"><span>할 일</span><input id="t" type="text" placeholder="예) 내일 3시 샘플 촬영 #작업" autofocus></label>
      <div class="preview-chips" id="pv"></div>
      <div class="frow">
        <label class="field"><span>날짜</span><input id="d" type="date" value="${defaults.date || today()}"></label>
        <label class="field"><span>시간</span><input id="tm" type="time" value="${defaults.time || ''}"></label>
        <label class="field"><span>카테고리</span><select id="c">${catOptions(defaults.cat || s.categories[0].id)}</select></label>
      </div>
      <label class="field"><span>링크 (선택)</span><input id="u" type="url" placeholder="유튜브 · 노션 · 사이트 주소"></label>
      <label class="field"><span>메모 (선택)</span><textarea id="m" rows="2"></textarea></label>
      <div class="actions"><button class="btn lite" data-close>취소</button><button class="btn dark" id="save">저장</button></div>`.toString(),
    onMount: (d, close) => {
      const $ = (id) => d.querySelector('#' + id);
      let touched = { d: false, tm: false, c: false };
      ['d', 'tm', 'c'].forEach(k => $(k).addEventListener('change', () => { touched[k] = true; }));
      const live = () => {
        const p = parseTask($('t').value, s.categories, defaults.date);
        if (p.date && !touched.d) $('d').value = p.date;
        if (p.time && !touched.tm) $('tm').value = p.time;
        if (p.cat && !touched.c) $('c').value = p.cat;
        const chips = [];
        if (p.date) chips.push('날짜 인식: ' + p.date.slice(5).replace('-', '.'));
        if (p.time) chips.push('시간 ' + p.time);
        if (p.cat) chips.push('#' + s.categories.find(c => c.id === p.cat).name);
        $('pv').innerHTML = chips.map(c => `<span>${esc(c)}</span>`).join('');
        return p;
      };
      $('t').addEventListener('input', live);
      const save = async () => {
        const p = live();
        const title = p.title || $('t').value.trim();
        if (!title) { $('t').focus(); return; }
        const t = newTask({ title, date: $('d').value || null, time: $('tm').value || null, cat: $('c').value, memo: $('m').value });
        const url = $('u').value.trim();
        let linkId = null;
        if (url && detectKind(url)) {
          linkId = uid();
          store.state.links.push({ id: linkId, url, kind: detectKind(url), title: '', thumb: '', date: t.date, taskId: t.id, createdAt: Date.now(), mine: false });
          t.links.push(linkId);
        }
        store.update(st => st.tasks.push(t));
        close();
        toast(`‘${title}’ 추가했어요`);
        if (linkId) fillLinkInfo(linkId);
      };
      $('save').onclick = save;
      d.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && !e.isComposing) { e.preventDefault(); save(); } });
    }
  });
}

// 링크 정보를 유튜브에서 가져와 채운다 (비동기)
export async function fillLinkInfo(id) {
  const l = store.state.links.find(x => x.id === id);
  if (!l) return;
  if (isYT(l)) {
    const r = await window.harukan.ytLookup(l.url);
    if (!r.ok) return;
    store.update(st => {
      const x = st.links.find(y => y.id === id);
      if (!x) return;
      applyYT(x, r.data);
    });
  } else if (!l.title) {
    store.update(st => { const x = st.links.find(y => y.id === id); if (x) x.title = hostTitle(x.url); });
  }
}
export function applyYT(x, v) {
  if (v.title && !x.titleEdited) x.title = v.title;
  x.ytId = v.ytId;
  x.thumb = v.thumb || x.thumb;
  if (v.channel) x.channel = v.channel;
  if (v.duration) x.duration = v.duration;
  if (v.views != null) x.views = v.views;
  if (v.likes != null) x.likes = v.likes;
  if (v.publishAt && !x.publishAtEdited) x.publishAt = v.publishAt;
  if (v.short) x.kind = 'short';
  const chan = store.state.yt && store.state.yt.channel;
  if (chan && v.channelId && v.channelId === chan.id) x.mine = true;
}
function hostTitle(url) {
  try { const u = new URL(url); return u.hostname.replace(/^www\./, '') + (u.pathname.length > 1 ? u.pathname.replace(/\/$/, '') : ''); } catch (e) { return url; }
}

const toLocalInput = (iso) => { if (!iso) return ''; const d = new Date(iso); return `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };

// ---------- 링크 편집 ----------
export function linkDialog(link, prefill = {}) {
  const s = store.state;
  const isNew = !link;
  const l = Object.assign({ id: uid(), url: '', kind: 'long', title: '', thumb: '', mine: false, date: null, taskId: null, createdAt: Date.now() }, link || {}, prefill);
  const tasks = s.tasks.filter(t => !t.done || t.id === l.taskId).slice(-80);
  openDialog({
    wide: true,
    body: html`<h2>${isNew ? '링크 추가' : '링크 편집'}</h2>
      <label class="field"><span>주소</span><input id="u" type="url" value="${l.url}" placeholder="https://" ${isNew ? 'autofocus' : ''}></label>
      <div class="pv ${l.kind === 'short' ? 'short' : ''}" id="pv"></div>
      <div class="frow">
        <label class="field" style="flex:2"><span>제목</span><input id="t" type="text" value="${l.title}"></label>
        <label class="field"><span>종류</span><select id="k">
          ${[['long', 'YouTube 롱폼'], ['short', 'YouTube 숏폼'], ['doc', '문서'], ['web', '사이트']].map(([v, n]) => html`<option value="${v}" ${l.kind === v ? 'selected' : ''}>${n}</option>`)}
        </select></label>
      </div>
      <div class="frow">
        <label class="field"><span>캘린더 날짜</span><input id="d" type="date" value="${l.date || ''}"></label>
        <label class="field" style="flex:2"><span>연결할 할 일</span><select id="task"><option value="">— 없음 —</option>
          ${tasks.map(t => html`<option value="${t.id}" ${t.id === l.taskId ? 'selected' : ''}>${t.date ? t.date.slice(5).replace('-', '.') + ' · ' : ''}${t.title}</option>`)}
        </select></label>
      </div>
      <div id="ytx" style="display:flex;flex-direction:column;gap:12px">
        <label class="row" style="gap:8px;font-size:13px"><input id="mine" type="checkbox" ${l.mine ? 'checked' : ''}> 내 채널 영상 (유튜브 대시보드에 표시)</label>
        <div class="frow">
          <label class="field"><span>공개 · 예약 일시</span><input id="pub" type="datetime-local" value="${toLocalInput(l.publishAt)}"></label>
          <label class="field"><span>조회수</span><input id="views" type="number" min="0" value="${l.views ?? ''}"></label>
          <label class="field"><span>좋아요</span><input id="likes" type="number" min="0" value="${l.likes ?? ''}"></label>
        </div>
      </div>
      <div class="actions">
        ${isNew ? '' : html`<button class="btn danger" id="del" style="margin-right:auto">삭제</button>`}
        <button class="btn lite" data-close>취소</button><button class="btn dark" id="save">저장</button>
      </div>`.toString(),
    onMount: (d, close) => {
      const $ = (id) => d.querySelector('#' + id);
      const syncYT = () => { $('ytx').style.display = ($('k').value === 'long' || $('k').value === 'short') ? 'flex' : 'none'; };
      const preview = () => {
        const yt = $('k').value === 'long' || $('k').value === 'short';
        $('pv').className = 'pv ' + ($('k').value === 'short' ? 'short' : '');
        $('pv').innerHTML = yt && (l.thumb || l.color) ? `<div class="thumb" style="${thumbStyle(l)}"></div><div class="info"><b>${esc(l.title || '')}</b><span class="muted">${esc(l.channel || '')}${l.duration ? ' · ' + fmtDur(l.duration) : ''}</span></div>` : '';
      };
      syncYT(); preview();
      $('k').addEventListener('change', () => { syncYT(); preview(); });
      let lastUrl = l.url;
      const lookup = async () => {
        const url = $('u').value.trim();
        if (!url || url === lastUrl && l.title) return;
        lastUrl = url;
        const k = detectKind(url);
        if (!k) return;
        $('k').value = k; syncYT();
        if (k === 'long' || k === 'short') {
          $('pv').innerHTML = '<span class="muted">정보 가져오는 중…</span>';
          const r = await window.harukan.ytLookup(url);
          if (r.ok) {
            l.url = url;
            const keepTitle = $('t').value && $('t').value !== l.title;
            applyYT(l, r.data);
            if (!keepTitle) $('t').value = l.title;
            $('k').value = l.kind;
            if (l.publishAt) $('pub').value = toLocalInput(l.publishAt);
            if (l.views != null) $('views').value = l.views;
            if (l.likes != null) $('likes').value = l.likes;
            $('mine').checked = !!l.mine || $('mine').checked;
            syncYT();
            if (r.data.privateGuess) toast('비공개 · 예약 영상은 제목을 직접 적어 주세요');
          }
          preview();
        } else if (!$('t').value) {
          $('t').value = hostTitle(url);
        }
      };
      $('u').addEventListener('change', lookup);
      $('u').addEventListener('paste', () => setTimeout(lookup, 10));
      $('save').onclick = () => {
        const url = $('u').value.trim();
        if (!detectKind(url)) { $('u').focus(); toast('올바른 주소를 넣어 주세요'); return; }
        const pub = $('pub').value;
        const next = Object.assign({}, l, {
          url, title: $('t').value.trim() || hostTitle(url), kind: $('k').value,
          date: $('d').value || null, taskId: $('task').value || null,
          mine: $('mine').checked,
          publishAt: pub ? new Date(pub).toISOString() : null,
          views: $('views').value === '' ? null : +$('views').value,
          likes: $('likes').value === '' ? null : +$('likes').value
        });
        if (next.title !== l.title) next.titleEdited = true;
        if (pub && pub !== toLocalInput(link && link.publishAt)) next.publishAtEdited = true;
        store.update(st => {
          const i = st.links.findIndex(x => x.id === next.id);
          if (i >= 0) st.links[i] = next; else st.links.push(next);
          // 할 일 연결 갱신
          st.tasks.forEach(t => { t.links = (t.links || []).filter(id => id !== next.id); });
          if (next.taskId) { const t = st.tasks.find(t => t.id === next.taskId); if (t) t.links.push(next.id); }
        });
        close();
        toast(isNew ? '링크를 저장했어요' : '링크를 고쳤어요');
      };
      if ($('del')) $('del').onclick = () => { close(); deleteLink(l.id); };
    }
  });
}

export function deleteLink(id) {
  const s = store.state;
  const idx = s.links.findIndex(l => l.id === id);
  if (idx < 0) return;
  const backup = s.links[idx];
  store.update(st => {
    st.links.splice(idx, 1);
    st.tasks.forEach(t => { t.links = (t.links || []).filter(x => x !== id); });
  });
  toast('링크를 지웠어요', { label: '되돌리기', fn: () => store.update(st => { st.links.splice(idx, 0, backup); if (backup.taskId) { const t = st.tasks.find(t => t.id === backup.taskId); if (t) t.links.push(id); } }) });
}

// ---------- 아이디어 편집 ----------
export function ideaDialog(idea, defaults = {}) {
  const s = store.state;
  const isNew = !idea;
  const it = Object.assign({ id: uid(), col: 'idea', title: '', body: '', tags: [], folder: s.folders[0] && s.folders[0].id, createdAt: Date.now() }, idea || {}, defaults);
  const vids = s.links.filter(isYT);
  openDialog({
    wide: true,
    body: html`<h2>${isNew ? '아이디어 적기' : '아이디어 편집'}</h2>
      <label class="field"><span>제목</span><input id="t" type="text" value="${it.title}" autofocus></label>
      <label class="field"><span>내용 (줄거리 · 기승전결 · 메모)</span><textarea id="b" rows="5">${it.body}</textarea></label>
      <div class="frow">
        <label class="field"><span>단계</span><select id="col">${IDEA_COLS.map(c => html`<option value="${c.id}" ${c.id === it.col ? 'selected' : ''}>${c.t}</option>`)}</select></label>
        <label class="field"><span>폴더</span><select id="f">${s.folders.map(f => html`<option value="${f.id}" ${f.id === it.folder ? 'selected' : ''}>${f.name}</option>`)}</select></label>
        <label class="field"><span>태그 (띄어쓰기로 구분)</span><input id="tg" type="text" value="${(it.tags || []).map(t => '#' + t).join(' ')}"></label>
      </div>
      <div class="frow">
        <label class="field"><span>콘티 컷 수</span><input id="p" type="number" min="0" max="40" value="${it.panels || ''}"></label>
        <label class="field"><span>완료한 컷</span><input id="pd" type="number" min="0" max="40" value="${it.panelsDone || ''}"></label>
        <label class="field"><span>마감일</span><input id="due" type="date" value="${it.due || ''}"></label>
      </div>
      <label class="field"><span>연결된 유튜브 영상</span><select id="v"><option value="">— 없음 —</option>${vids.map(v => html`<option value="${v.id}" ${v.id === it.linkId ? 'selected' : ''}>${v.title || v.url}</option>`)}</select></label>
      <div class="actions">
        ${isNew ? '' : html`<button class="btn danger" id="del" style="margin-right:auto">삭제</button><button class="btn lite" id="totask">할 일로 만들기</button>`}
        <button class="btn lite" data-close>취소</button><button class="btn dark" id="save">저장</button>
      </div>`.toString(),
    onMount: (d, close) => {
      const $ = (id) => d.querySelector('#' + id);
      const collect = () => Object.assign({}, it, {
        title: $('t').value.trim(), body: $('b').value, col: $('col').value, folder: $('f').value,
        tags: $('tg').value.split(/[\s,]+/).map(x => x.replace(/^#/, '')).filter(Boolean),
        panels: +$('p').value || 0, panelsDone: Math.min(+$('pd').value || 0, +$('p').value || 0), due: $('due').value || null, linkId: $('v').value || null
      });
      $('save').onclick = () => {
        const next = collect();
        if (!next.title) { $('t').focus(); return; }
        store.update(st => { const i = st.ideas.findIndex(x => x.id === next.id); if (i >= 0) st.ideas[i] = next; else st.ideas.push(next); });
        close();
      };
      if ($('del')) $('del').onclick = () => {
        const idx = s.ideas.findIndex(x => x.id === it.id);
        const backup = s.ideas[idx];
        store.update(st => st.ideas.splice(idx, 1));
        close();
        toast('아이디어를 지웠어요', { label: '되돌리기', fn: () => store.update(st => st.ideas.splice(idx, 0, backup)) });
      };
      if ($('totask')) $('totask').onclick = () => {
        const next = collect();
        store.update(st => st.tasks.push(newTask({ title: next.title, date: next.due || today(), cat: 'work', memo: next.body })));
        close();
        toast(`‘${next.title}’ 할 일로 추가했어요`);
      };
    }
  });
}

export function photoViewer(url) {
  const v = document.createElement('div');
  v.className = 'viewer';
  v.innerHTML = `<img src="${esc(url)}" alt="">`;
  v.onclick = () => v.remove();
  document.addEventListener('keydown', function k(e) { if (e.key === 'Escape') { v.remove(); document.removeEventListener('keydown', k); } });
  document.body.appendChild(v);
}
