// 7 · 유튜브 대시보드
import { html, uid, today, addDays, mondayOf, ymd, md, WD, dow, fmtNum, fmtDur, fmtWhen, pad } from '../lib/util.js';
import { isYT } from '../lib/data.js';
import { holiday } from '../lib/holidays.js';
import { I, thumbStyle, goButton, statusText, toast, bgImg } from '../lib/ui.js';
import { linkDialog } from '../lib/modal.js';

const LONG = '#2B2420', SHORT = '#C0533A';
let syncing = false;

export default {
  id: 'youtube',
  title: '유튜브',
  initUi: () => ({ period: 28 }),

  render(s, ui) {
    const t0 = today();
    const now = new Date();
    const mine = s.links.filter(l => isYT(l) && l.mine);
    const long = mine.filter(l => l.kind === 'long').sort(byPub), shorts = mine.filter(l => l.kind === 'short').sort(byPub);
    const ch = s.yt.channel;
    const periodDays = ui.period === 'year' ? Math.round((now - new Date(now.getFullYear(), 0, 1)) / 86400000) + 1 : ui.period;
    const fromDay = addDays(t0, -periodDays + 1);
    const snaps = (s.yt.snapshots || []).slice().sort((a, b) => a.date.localeCompare(b.date));
    const snapAt = (d) => snaps.filter(x => x.date <= d).pop() || snaps.find(x => x.date >= d);
    const lastSnap = snaps[snaps.length - 1], firstSnap = snapAt(fromDay);
    const subDelta = lastSnap && firstSnap && lastSnap !== firstSnap && lastSnap.subs != null ? lastSnap.subs - firstSnap.subs : null;
    const sumViews = (arr) => arr.reduce((a, l) => a + (l.views || 0), 0);
    const totalLikes = sumViews(mine.map(l => ({ views: l.likes })));
    const publicCount = mine.filter(l => l.likes != null).length;
    const mk = t0.slice(0, 7);
    const thisMonth = mine.filter(l => l.publishAt && ymd(new Date(l.publishAt)).startsWith(mk));
    const next = mine.filter(l => l.publishAt && new Date(l.publishAt) > now).sort(byPubAsc)[0];
    const sched = (arr) => arr.filter(l => l.publishAt && new Date(l.publishAt) > now).length;

    // 2주 일정
    const mon = mondayOf(t0);
    const days = Array.from({ length: 14 }, (_, i) => addDays(mon, i));
    const ups = (d) => mine.filter(l => l.publishAt && ymd(new Date(l.publishAt)) === d).sort(byPubAsc);

    // 일별 조회수 (스냅샷 차이) — 없으면 영상별 조회수
    const chartDays = Math.min(periodDays, 60);
    let chart = null;
    if (snaps.length >= 2) {
      chart = Array.from({ length: chartDays }, (_, i) => {
        const d = addDays(t0, -chartDays + 1 + i);
        const a = snaps.find(x => x.date === d), b = snaps.find(x => x.date === addDays(d, -1));
        return { d, l: a && b ? Math.max(0, (a.longViews ?? 0) - (b.longViews ?? 0)) : 0, s: a && b ? Math.max(0, (a.shortViews ?? 0) - (b.shortViews ?? 0)) : 0, has: !!(a && b) };
      });
    }
    const perVideo = mine.filter(l => l.views != null).sort(byPubAsc).slice(-28);
    const maxBar = chart ? Math.max(1, ...chart.map(c => c.l + c.s)) : Math.max(1, ...perVideo.map(v => v.views));

    return html`<div class="pad">
      <div class="head" style="gap:12px">
        <div><div class="eyebrow">YOUTUBE STUDIO</div><h1 class="h1">유튜브 대시보드</h1></div>
        <span class="chan" style="margin-bottom:3px"><span class="av" style="${ch && ch.thumb ? bgImg(ch.thumb, '#C4A88C') : ''}"></span>${ch ? ch.title : '[채널 연결 안 됨]'}</span>
        <span style="font-size:12px;margin-bottom:8px;${s.yt.lastSync ? 'color:var(--ok)' : 'color:var(--muted)'}">● ${s.yt.lastSync ? '동기화 · ' + ago(s.yt.lastSync) : (s.settings.ytApiKey ? '아직 동기화 전' : '설정에서 API 키를 넣으면 통계를 가져와요')}</span>
        <span class="grow"></span>
        ${s.settings.ytApiKey ? html`<button class="btn lite" data-act="sync" ${syncing ? 'disabled' : ''}>${I.sync()} ${syncing ? '동기화 중…' : '동기화'}</button>` : html`<button class="btn lite" data-act="go" data-view="settings">채널 연결</button>`}
        <button class="btn dark" data-act="add-video">+ 영상 일정</button>
        <div class="seg" role="group" aria-label="기간">
          ${[[7, '7일'], [28, '28일'], ['year', '올해']].map(([k, n]) => html`<button class="${ui.period === k ? 'on' : ''}" data-act="period" data-p="${k}">${n}</button>`)}
        </div>
      </div>

      <div class="kpis">
        ${kpi('구독자', ch && ch.subscribers != null ? ch.subscribers.toLocaleString('ko-KR') : '—', subDelta != null ? `${subDelta >= 0 ? '+' : ''}${subDelta} · ${ui.period === 'year' ? '올해' : ui.period + '일'}` : '동기화 기록이 쌓이면 변화가 보여요', subDelta > 0 ? 'color:var(--ok)' : '')}
        ${kpi('조회수 (내 영상 합계)', fmtNum(sumViews(mine)), `롱폼 ${fmtNum(sumViews(long))} · 숏폼 ${fmtNum(sumViews(shorts))}`)}
        ${kpi('좋아요', fmtNum(totalLikes), publicCount ? `영상당 평균 ${fmtNum(Math.round(totalLikes / publicCount))}` : '—')}
        ${kpi('이번 달 업로드', thisMonth.length + '개', `롱폼 ${thisMonth.filter(l => l.kind === 'long').length} · 숏폼 ${thisMonth.filter(l => l.kind === 'short').length}`)}
        <div class="kpi dark" ${next ? raw_attr(next.id) : ''} style="${next ? 'cursor:pointer' : ''}">
          <span class="l">다음 공개</span>
          <span class="v ell">${next ? fmtWhen(next.publishAt).replace(/^\d+\.\d+ /, '') : '—'}</span>
          <span class="n ell">${next ? (next.kind === 'short' ? '숏폼' : '롱폼') + ' · ' + next.title : '예약된 영상이 없어요'}</span>
        </div>
      </div>

      <div class="yt-mid">
        <div class="card">
          <div class="row" style="gap:12px;font-size:12px"><span class="h2" style="font-size:13.5px">업로드 일정 · 2주</span><span class="grow"></span><span class="row" style="gap:4px"><span class="sw" style="background:${LONG}"></span>롱폼</span><span class="row" style="gap:4px"><span class="sw" style="background:${SHORT}"></span>숏폼</span></div>
          <div class="sched14">
            ${days.map(d => html`<div class="${d === t0 ? 'tdy' : d < t0 ? 'past' : ''}" data-dbl="add-on" data-date="${d}" title="더블클릭해서 이 날 영상 일정 추가">
              <span style="font-size:10px;${dow(d) === 0 || holiday(d) ? 'color:var(--red)' : 'color:var(--muted)'}">${WD[dow(d)]}</span>
              <span class="serif b" style="font-size:14.5px">${+d.slice(8)}</span>
              ${ups(d).map(l => { const dt = new Date(l.publishAt); return html`<span class="up" data-act="edit-link" data-id="${l.id}" title="${l.kind === 'short' ? '숏폼' : '롱폼'} · ${l.title}" style="background:${l.kind === 'short' ? SHORT : LONG}">${pad(dt.getHours())}:${pad(dt.getMinutes())}</span>`; })}
            </div>`)}
          </div>
        </div>
        <div class="card">
          <div class="row" style="font-size:12px"><span class="h2" style="font-size:13.5px">${chart ? '일별 조회수' : '영상별 조회수'}</span><span class="grow"></span><span class="muted">${chart ? `롱폼 / 숏폼 · 최근 ${chartDays}일` : '최근 영상 ' + perVideo.length + '개'}</span></div>
          ${chart ? html`<div class="vbars" style="grid-template-columns:repeat(${chart.length}, minmax(0, 1fr))">
              ${chart.map(c => html`<div title="${md(c.d)} · 롱폼 ${c.l.toLocaleString()} · 숏폼 ${c.s.toLocaleString()}" style="display:flex;flex-direction:column;gap:1px">
                <div style="height:${c.s / maxBar * 90}px;background:${SHORT};border-radius:2px 2px 0 0"></div><div style="height:${Math.max(c.has ? 1 : 0, c.l / maxBar * 90)}px;background:${LONG}"></div></div>`)}
            </div>
            <div class="row muted" style="justify-content:space-between;font-size:10px"><span>${md(chart[0].d)}</span><span>${md(chart[Math.floor(chart.length / 2)].d)}</span><span>${md(t0)}</span></div>`
          : perVideo.length ? html`<div class="vbars" style="grid-template-columns:repeat(${Math.max(perVideo.length, 18)}, minmax(0, 1fr))">
              ${perVideo.map(v => html`<div title="${v.title} · 조회 ${v.views.toLocaleString()}" data-act="edit-link" data-id="${v.id}" style="cursor:pointer;height:${Math.max(2, v.views / maxBar * 92)}px;background:${v.kind === 'short' ? SHORT : LONG};border-radius:2px 2px 0 0"></div>`)}
            </div><div class="muted" style="font-size:10.5px">동기화를 매일 하면 일별 조회수 그래프로 바뀌어요.</div>`
          : html`<div class="empty">조회수 정보가 아직 없어요. 설정에서 채널을 연결하거나, 영상 편집에서 직접 넣을 수 있어요.</div>`}
        </div>
      </div>

      <div class="yt-tables">
        <div>
          <div class="sec-h" style="margin-bottom:0"><span class="h2" style="font-size:15.5px">롱폼</span><span class="muted" style="font-size:12px">이번 달 ${thisMonth.filter(l => l.kind === 'long').length}개 · 예약 ${sched(long)}</span><span class="grow"></span><span class="muted" style="font-size:11px;width:54px;text-align:right">조회</span><span class="muted" style="font-size:11px;width:54px;text-align:right">좋아요</span></div>
          <div class="scroll" data-keep="ytl">
            ${long.length ? long.map(v => { const st = statusText(v); return html`<div class="lrow lk" data-act="edit-link" data-id="${v.id}" data-ctx="link">
              <div class="thumb" style="${thumbStyle(v)}">${v.duration ? html`<span class="len">${fmtDur(v.duration)}</span>` : ''}<div class="go go-over" style="border-radius:3px"><button class="go-btn" style="height:24px;font-size:11px;padding:0 8px" data-act="open-url" data-url="${v.url}">유튜브로 ↗</button></div></div>
              <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px"><span class="ell b" style="font-size:13px">${v.title}</span><span class="${st.cls}" style="font-size:11px">${st.text.replace(/ · 조회.*/, '')}</span></div>
              <span class="c">${v.views != null ? fmtNum(v.views) : '—'}</span><span class="c">${v.likes != null ? fmtNum(v.likes) : '—'}</span>
            </div>`; }) : html`<div class="empty">롱폼 영상이 없어요. [+ 영상 일정]으로 업로드 계획을 적어 보세요.</div>`}
          </div>
        </div>
        <div>
          <div class="sec-h" style="margin-bottom:0"><span class="h2" style="font-size:15.5px">숏폼</span><span class="badge b-short">Shorts</span><span class="muted" style="font-size:12px">이번 달 ${thisMonth.filter(l => l.kind === 'short').length}개 · 예약 ${sched(shorts)}</span></div>
          <div class="scroll" data-keep="yts">
            ${shorts.length ? html`<div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:0 14px">${shorts.map(v => { const st = statusText(v); return html`<div class="srow lk" data-act="edit-link" data-id="${v.id}" data-ctx="link">
              <div class="thumb" style="${thumbStyle(v)}"><div class="go go-over" style="border-radius:4px"><button class="go-btn" style="height:22px;padding:0 6px;font-size:12px" data-act="open-url" data-url="${v.url}" aria-label="유튜브로 열기">↗</button></div></div>
              <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px"><span class="ell b" style="font-size:13px">${v.title}</span><span class="${st.cls}" style="font-size:11px">${st.text.replace(/ · 조회.*/, '')}</span><span class="muted" style="font-size:11px">${v.views != null ? fmtNum(v.views) : '—'} · ♥ ${v.likes != null ? fmtNum(v.likes) : '—'}</span></div>
            </div>`; })}</div>` : html`<div class="empty">숏폼 영상이 없어요.</div>`}
          </div>
        </div>
      </div>
    </div>`;
  },

  actions: {
    period(el, e, ctx) { const p = el.dataset.p; ctx.ui('youtube').period = p === 'year' ? 'year' : +p; ctx.render(); },
    'add-video'(el, e, ctx) { linkDialog(null, { kind: 'long', mine: true, url: '' }); },
    'add-on'(el, e, ctx) {
      const d = el.dataset.date;
      linkDialog(null, { kind: 'long', mine: true, url: '', publishAt: new Date(`${d}T19:00:00`).toISOString(), date: d, publishAtEdited: true });
    },
    'next-open'(el, e, ctx) { const l = ctx.s.links.find(x => x.id === el.dataset.id); if (l) linkDialog(l); },
    async sync(el, e, ctx) { await syncNow(ctx); }
  }
};

export async function syncNow(ctx) {
  if (syncing) return;
  syncing = true; ctx.render();
  const r = await window.harukan.ytSync();
  syncing = false;
  if (!r.ok) { ctx.render(); toast('동기화 실패: ' + r.error); return; }
  const { channel, videos } = r.data;
  ctx.update(s => {
    s.yt.channel = channel;
    s.yt.lastSync = Date.now();
    for (const v of videos) {
      let l = s.links.find(x => x.ytId === v.ytId);
      if (!l) {
        l = { id: uid(), url: v.short ? `https://www.youtube.com/shorts/${v.ytId}` : `https://www.youtube.com/watch?v=${v.ytId}`, createdAt: Date.now(), date: null, taskId: null };
        s.links.push(l);
      }
      Object.assign(l, {
        ytId: v.ytId, mine: true, kind: v.short ? 'short' : 'long',
        title: l.titleEdited ? l.title : v.title, thumb: v.thumb, duration: v.duration || l.duration,
        views: v.views, likes: v.likes, channel: v.channel,
        publishAt: l.publishAtEdited && l.publishAt ? l.publishAt : (v.publishAt || l.publishAt)
      });
    }
    const mineL = s.links.filter(l => l.mine && l.kind === 'long'), mineS = s.links.filter(l => l.mine && l.kind === 'short');
    const snap = { date: today(), subs: channel.subscribers, views: channel.views, longViews: mineL.reduce((a, l) => a + (l.views || 0), 0), shortViews: mineS.reduce((a, l) => a + (l.views || 0), 0) };
    s.yt.snapshots = (s.yt.snapshots || []).filter(x => x.date !== snap.date).concat(snap).slice(-400);
  });
  toast(`동기화 완료 · 영상 ${videos.length}개`);
}

const byPub = (a, b) => (b.publishAt || '9').localeCompare(a.publishAt || '9');
const byPubAsc = (a, b) => (a.publishAt || '').localeCompare(b.publishAt || '');
const kpi = (l, v, n, nc) => html`<div class="kpi"><span class="l">${l}</span><span class="v ell">${v}</span><span class="n ell" style="${nc || ''}">${n}</span></div>`;
const raw_attr = (id) => html`data-act="next-open" data-id="${id}"`;
function ago(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return '방금';
  if (m < 60) return m + '분 전';
  if (m < 1440) return Math.round(m / 60) + '시간 전';
  return Math.round(m / 1440) + '일 전';
}
