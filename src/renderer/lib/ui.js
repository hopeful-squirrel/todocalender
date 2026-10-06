// 공용 UI 조각 — 아이콘, 할 일 줄, 링크 카드, 썸네일
import { html, raw, esc, fmtDur, fmtWhen, fmtNum } from './util.js';
import { cat, linkBadge, isYT, linkStatus } from './data.js';

const S = (d, size = 16, sw = 2) => raw(`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`);
export const I = {
  logo: (s = 16) => S('<path d="M4 4h16v12l-4 4H4z"/><path d="M16 20v-4h4"/>', s),
  logoLines: (s = 16) => S('<path d="M4 4h16v12l-4 4H4z"/><path d="M16 20v-4h4"/><path d="M8 9h8M8 13h5"/>', s),
  plus: (s = 16) => S('<path d="M12 5v14M5 12h14"/>', s),
  photo: (s = 15) => S('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 16 5-5 4 4 3-3 6 6"/>', s),
  link: (s = 15) => S('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7L12 5M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12 19"/>', s),
  out: (s = 12) => S('<path d="M7 17 17 7M8 7h9v9"/>', s, 2.4),
  open: (s = 18) => S('<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>', s),
  clock: (s = 11) => S('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', s, 2.4),
  check: (s = 11) => S('<path d="M5 12l5 5 9-10"/>', s, 3),
  bulb: (s = 18) => S('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>', s),
  gear: (s = 14) => S('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>', s),
  search: (s = 13) => S('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', s),
  sync: (s = 13) => S('<path d="M21 12a9 9 0 0 1-15.4 6.4L3 16M3 12a9 9 0 0 1 15.4-6.4L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/>', s),
  trash: (s = 14) => S('<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>', s),
  min: raw('<svg width="10" height="10" viewBox="0 0 10 10"><path d="M0 5h10" stroke="#2B2420"/></svg>'),
  max: raw('<svg width="10" height="10" viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="#2B2420"/></svg>'),
  restore: raw('<svg width="10" height="10" viewBox="0 0 10 10"><rect x="0.5" y="2.5" width="7" height="7" fill="none" stroke="#2B2420"/><path d="M2.5 2.5V.5h7v7h-2" fill="none" stroke="#2B2420"/></svg>'),
  close: raw('<svg width="10" height="10" viewBox="0 0 10 10"><path d="M0 0l10 10M10 0 0 10" stroke="#2B2420"/></svg>'),
  playTri: raw('<svg width="10" height="12" viewBox="0 0 10 12"><path d="M0 0l10 6-10 6z" fill="#fff"/></svg>')
};

export const photoUrl = (name) => `app://photos/${encodeURIComponent(name)}`;
export const bgImg = (url, color) => url ? `background-image:url('${esc(url).replace(/'/g, '%27')}');background-color:${color || '#C9B8A6'};` : `background-color:${color || '#C9B8A6'};`;

export function box(on) {
  return html`<span class="box ${on ? 'on' : ''}">${I.check()}</span>`;
}

// 주간 · 위젯 등에서 쓰는 작은 할 일 줄
export function taskLine(s, t, opts = {}) {
  const c = cat(s, t.cat);
  return html`<div class="task-line ${t.done ? 'done' : ''}" data-ctx="task" data-id="${t.id}" draggable="${opts.drag ? 'true' : 'false'}">
    <button class="box" data-act="toggle" data-id="${t.id}" aria-label="${t.title} 완료">${I.check()}</button>
    <span class="tt" data-act="open-task" data-id="${t.id}">${opts.time && t.time ? html`<span class="tm">${t.time}</span>` : ''}${t.title}</span>
    <span class="dot" style="margin-top:5px;background:${c.color}"></span>
  </div>`;
}

export function thumbStyle(l) {
  return bgImg(l.thumb, l.color || (l.kind === 'short' ? '#B59A8A' : '#C9B8A6'));
}

export function goButton(l, label) {
  const b = linkBadge(l);
  return html`<button class="go-btn" data-act="open-url" data-url="${l.url}">${label || b.go} ${I.out()}</button>`;
}

// 주간 열에 들어가는 링크 카드
export function weekLink(l) {
  const b = linkBadge(l);
  const st = linkStatus(l);
  return html`<div class="wlink lk" data-ctx="link" data-id="${l.id}">
    ${isYT(l) ? html`<div class="thumb" style="${thumbStyle(l)}"><span class="play">${I.playTri}</span>${l.duration ? html`<span class="len">${fmtDur(l.duration)}</span>` : ''}</div>` : ''}
    <div class="meta"><span class="badge ${b.cls}">${b.t}</span><span class="ell">${l.title || l.url}</span></div>
    ${l.publishAt ? html`<div class="when" style="${st.scheduled ? '' : 'color:var(--muted)'}">${I.clock()}${st.text} · ${fmtWhen(l.publishAt)}${st.scheduled ? ' 공개' : ''}</div>` : ''}
    <div class="go go-over">${goButton(l)}</div>
  </div>`;
}

export function statusText(l) {
  const st = linkStatus(l);
  if (!l.publishAt) return { text: l.mine ? '날짜 미정' : '', cls: 'muted' };
  if (st.scheduled) return { text: `예약 · ${fmtWhen(l.publishAt)}`, cls: 'sched' };
  return { text: `공개됨 · ${fmtWhen(l.publishAt).replace(/ \d\d:\d\d$/, '')}${l.views != null ? ' · 조회 ' + fmtNum(l.views) : ''}`, cls: 'muted' };
}

let toastTimer;
export function toast(msg, action) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = esc(msg) + (action ? `<button>${esc(action.label)}</button>` : '');
  if (action) el.querySelector('button').onclick = () => { action.fn(); el.remove(); };
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), action ? 5000 : 2400);
}
