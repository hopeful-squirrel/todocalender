// 설정
import { html, uid } from '../lib/util.js';
import { sampleState, emptyState } from '../lib/data.js';
import { confirmDialog } from '../lib/modal.js';
import { toast } from '../lib/ui.js';
import { syncNow } from './youtube.js';

let info = null;

export default {
  id: 'settings',
  title: '설정',

  render(s) {
    const st = s.settings || {};
    if (!info) window.harukan.appInfo().then(i => { info = i; document.getElementById('appver') && (document.getElementById('appver').textContent = `하루칸 ${i.version}`); });
    const w = st.widgets || { cal: true, todo: true, week: true };
    const scale = st.uiScale || 0;
    return html`<div class="set-wrap" data-keep="set">
      <div class="head" style="margin-bottom:16px"><div><div class="eyebrow">SETTINGS</div><h1 class="h1">설정</h1></div><span class="grow"></span><span class="muted" id="appver" style="font-size:12px">${info ? '하루칸 ' + info.version : ''}</span></div>
      <div class="set-grid">
        <div class="card">
          <div class="h2">화면</div>
          <label class="field"><span>글자 · 화면 크기</span>
            <div class="seg" style="align-self:flex-start">
              ${[[0, '자동'], [0.8, '80%'], [0.9, '90%'], [1, '100%'], [1.1, '110%'], [1.2, '120%']].map(([v, n]) => html`<button class="${scale === v ? 'on' : ''}" data-act="scale" data-v="${v}">${n}</button>`)}
            </div>
          </label>
          <div class="muted" style="font-size:12px">자동: Windows 배율이 125% 이상이면 조금 작게 보여 줘요 (1920×1080 기준).</div>
        </div>

        <div class="card">
          <div class="h2">바탕화면 위젯</div>
          <div class="chips">
            ${[['cal', '달력'], ['todo', '오늘 할 일'], ['week', '이번 주 작업량']].map(([k, n]) => html`<button class="chip ${w[k] ? 'on' : ''}" data-act="widget" data-k="${k}">${w[k] ? '✓ ' : ''}${n}</button>`)}
          </div>
          <label class="row" style="gap:8px"><input type="checkbox" data-change="set-bool" data-k="widgetLocked" ${st.widgetLocked ? 'checked' : ''}>위젯 위치 고정</label>
          <label class="row" style="gap:8px"><input type="checkbox" data-change="set-bool" data-k="widgetOnTop" ${st.widgetOnTop ? 'checked' : ''}>위젯을 항상 위에 표시</label>
          <label class="row" style="gap:8px">투명도 <input type="range" min="0.4" max="1" step="0.05" value="${st.widgetOpacity || 1}" data-change="opacity" style="flex:1;accent-color:var(--accent)"></label>
          <div class="muted" style="font-size:12px">트레이 아이콘을 우클릭해도 같은 메뉴가 나와요. 위젯 빈 곳을 끌어서 옮길 수 있어요.</div>
        </div>

        <div class="card">
          <div class="h2">시작 · 단축키</div>
          <label class="row" style="gap:8px"><input type="checkbox" data-change="set-bool" data-k="autoStart" ${st.autoStart !== false ? 'checked' : ''}>Windows 시작 시 실행 (위젯 · 트레이만 띄움)</label>
          <div style="font-size:13px;line-height:1.9">
            <b>Ctrl+Alt+N</b> 어디서든 빠른 할 일 추가<br>
            <b>Ctrl+N</b> 할 일 추가 · <b>Ctrl+F</b> 검색 · <b>Ctrl+1~7</b> 탭 이동<br>
            <b>← →</b> 주간 · 월간에서 이전/다음 · <b>T</b> 오늘로
          </div>
        </div>

        <div class="card">
          <div class="h2">카테고리</div>
          ${s.categories.map(c => html`<div class="catedit"><input type="color" value="${c.color}" data-change="cat-color" data-id="${c.id}" aria-label="${c.name} 색"><input type="text" value="${c.name}" data-change="cat-name" data-id="${c.id}" aria-label="카테고리 이름">
            ${s.categories.length > 1 ? html`<button class="btn ghost" data-act="cat-del" data-id="${c.id}" aria-label="삭제">✕</button>` : ''}</div>`)}
          <button class="btn lite" style="align-self:flex-start;height:28px" data-act="cat-add">+ 카테고리 추가</button>
        </div>

        <div class="card">
          <div class="h2">유튜브 채널 연결</div>
          <label class="field"><span>YouTube Data API 키</span><input type="password" value="${st.ytApiKey || ''}" data-change="set-str" data-k="ytApiKey" placeholder="AIza…" style="height:32px;border-width:1px"></label>
          <label class="field"><span>채널 ID (UC…) 또는 @핸들</span><input type="text" value="${st.ytChannel || ''}" data-change="set-str" data-k="ytChannel" placeholder="@내채널" style="height:32px;border-width:1px"></label>
          <div class="row" style="gap:8px"><button class="btn dark" data-act="yt-sync" ${st.ytApiKey && st.ytChannel ? '' : 'disabled'}>지금 동기화</button><span class="muted" style="font-size:12px">${s.yt.channel ? '연결됨: ' + s.yt.channel.title : ''}</span></div>
          <div class="muted" style="font-size:12px;line-height:1.6">구독자 · 공개 영상 · 조회수 · 좋아요를 가져와요. 키는 Google Cloud Console에서 ‘YouTube Data API v3’를 켜고 만든 API 키를 쓰면 돼요. 키 없이도 링크의 제목 · 썸네일은 자동으로 채워져요. 예약(비공개) 영상은 직접 일정을 넣어 주세요.</div>
        </div>

        <div class="card">
          <div class="h2">데이터</div>
          <div class="row" style="gap:8px;flex-wrap:wrap">
            <button class="btn lite" data-act="export">내보내기 (백업)</button>
            <button class="btn lite" data-act="import">가져오기</button>
            <button class="btn lite" data-act="folder">데이터 폴더 열기</button>
          </div>
          <div class="muted" style="font-size:12px">모든 데이터는 이 PC에만 저장돼요. 하루 한 번 자동 백업(최근 14일)도 남겨요.</div>
          <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:4px">
            ${s.sample ? html`<button class="btn danger" data-act="clear-sample">예시 데이터 지우고 새로 시작</button>` : html`<button class="btn lite" data-act="load-sample">예시 데이터 보기</button>`}
          </div>
        </div>
      </div>
    </div>`;
  },

  actions: {
    scale(el, e, ctx) { const v = +el.dataset.v; ctx.update(s => { s.settings.uiScale = v || null; }); },
    widget(el, e, ctx) { const k = el.dataset.k; ctx.update(s => { const w = Object.assign({ cal: true, todo: true, week: true }, s.settings.widgets); w[k] = !w[k]; s.settings.widgets = w; }); },
    'set-bool'(el, e, ctx) { const k = el.dataset.k; ctx.update(s => { s.settings[k] = el.checked; }); },
    'set-str'(el, e, ctx) { const k = el.dataset.k; ctx.update(s => { s.settings[k] = el.value.trim(); }); },
    opacity(el, e, ctx) { ctx.update(s => { s.settings.widgetOpacity = +el.value; }); },
    'cat-color'(el, e, ctx) { ctx.update(s => { s.categories.find(c => c.id === el.dataset.id).color = el.value; }); },
    'cat-name'(el, e, ctx) { const v = el.value.trim(); if (v) ctx.update(s => { s.categories.find(c => c.id === el.dataset.id).name = v; }); },
    'cat-add'(el, e, ctx) { ctx.update(s => s.categories.push({ id: uid(), name: '새 카테고리', color: '#7A6A9A' })); },
    async 'cat-del'(el, e, ctx) {
      const id = el.dataset.id;
      const c = ctx.s.categories.find(x => x.id === id);
      const n = ctx.s.tasks.filter(t => t.cat === id).length;
      if (!(await confirmDialog(`‘${c.name}’ 카테고리를 지울까요?${n ? ` 할 일 ${n}개는 첫 번째 카테고리로 옮겨져요.` : ''}`))) return;
      ctx.update(s => { s.categories = s.categories.filter(x => x.id !== id); s.tasks.forEach(t => { if (t.cat === id) t.cat = s.categories[0].id; }); });
    },
    async 'yt-sync'(el, e, ctx) { await syncNow(ctx); ctx.render(); },
    async export() { if (await window.harukan.exportData()) toast('백업 파일을 저장했어요'); },
    async import(el, e, ctx) { const d = await window.harukan.importData(); if (d) { const { store } = await import('../lib/data.js'); store.replace(d); toast('데이터를 가져왔어요'); } },
    folder() { window.harukan.openDataFolder(); },
    async 'clear-sample'(el, e, ctx) {
      if (!(await confirmDialog('예시 데이터를 모두 지우고 빈 상태로 시작할까요? (설정과 카테고리는 유지돼요)', '지우기'))) return;
      const { store } = await import('../lib/data.js');
      const next = emptyState();
      next.settings = ctx.s.settings; next.categories = ctx.s.categories;
      store.replace(next);
      toast('새로 시작해요!');
    },
    async 'load-sample'(el, e, ctx) {
      if (!(await confirmDialog('지금 데이터를 예시 데이터로 바꿀까요? 먼저 [내보내기]로 백업해 두는 걸 권해요.', '바꾸기'))) return;
      const { store } = await import('../lib/data.js');
      const next = sampleState(); next.settings = ctx.s.settings;
      store.replace(next);
    }
  }
};
