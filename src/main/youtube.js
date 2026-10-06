// 유튜브 정보 가져오기 — oEmbed(키 없이 제목·썸네일), YouTube Data API v3(키가 있으면 길이·통계·채널 동기화)
const { net } = require('electron');

const API = 'https://www.googleapis.com/youtube/v3/';

function videoId(url) {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (host.endsWith('youtube.com')) {
      if (u.searchParams.get('v')) return u.searchParams.get('v');
      const m = u.pathname.match(/^\/(shorts|live|embed|v)\/([^/?#]+)/);
      if (m) return m[2];
    }
  } catch (e) { /* 잘못된 주소 */ }
  return null;
}

function isoDuration(s) {
  const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(s || '');
  if (!m) return 0;
  return (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0);
}

async function getJSON(url) {
  const res = await net.fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) {
    let msg = res.status + ' ' + res.statusText;
    try { const j = await res.json(); if (j.error && j.error.message) msg = j.error.message; } catch (e) { /* 무시 */ }
    throw new Error(msg);
  }
  return res.json();
}

function mapVideo(v) {
  const sn = v.snippet || {}, st = v.statistics || {}, cd = v.contentDetails || {}, ss = v.status || {};
  const thumbs = sn.thumbnails || {};
  const th = thumbs.maxres || thumbs.high || thumbs.medium || thumbs.default || {};
  const publishAt = ss.publishAt || sn.publishedAt || null;
  const scheduled = ss.privacyStatus === 'private' && !!ss.publishAt;
  return {
    ytId: v.id,
    title: sn.title || '',
    channel: sn.channelTitle || '',
    channelId: sn.channelId || '',
    thumb: th.url || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
    duration: isoDuration(cd.duration),
    views: st.viewCount != null ? +st.viewCount : null,
    likes: st.likeCount != null ? +st.likeCount : null,
    comments: st.commentCount != null ? +st.commentCount : null,
    publishAt,
    status: scheduled ? 'scheduled' : (publishAt && new Date(publishAt) > new Date() ? 'scheduled' : 'public')
  };
}

// 링크 하나의 정보 — 키가 있으면 Data API, 없으면 oEmbed
async function lookup(url, apiKey) {
  const id = videoId(url);
  if (!id) throw new Error('유튜브 주소가 아니에요');
  const isShortUrl = /\/shorts\//.test(url);
  if (apiKey) {
    try {
      const j = await getJSON(`${API}videos?part=snippet,contentDetails,statistics,status&id=${encodeURIComponent(id)}&key=${encodeURIComponent(apiKey)}`);
      if (j.items && j.items[0]) {
        const v = mapVideo(j.items[0]);
        v.short = isShortUrl || (v.duration > 0 && v.duration <= 180);
        return v;
      }
    } catch (e) {
      console.warn('Data API 실패, oEmbed로 대체', e.message);
    }
  }
  const watch = isShortUrl ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`;
  try {
    const o = await getJSON(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watch)}`);
    // 세로 영상(oEmbed 높이 > 너비)이면 숏폼으로 본다
    const vertical = o.height && o.width && o.height > o.width;
    return {
      ytId: id, title: o.title || '', channel: o.author_name || '',
      thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      duration: 0, views: null, likes: null, publishAt: null, status: null,
      short: isShortUrl || !!vertical
    };
  } catch (e) {
    // 비공개·예약 영상은 oEmbed가 막힌다 — 썸네일 주소만 채운다
    return { ytId: id, title: '', channel: '', thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, duration: 0, views: null, likes: null, publishAt: null, status: null, short: isShortUrl, privateGuess: true };
  }
}

// 채널 동기화 — 채널 ID(UC…) 또는 @핸들
async function syncChannel(apiKey, channel) {
  if (!apiKey) throw new Error('YouTube API 키가 필요해요');
  if (!channel) throw new Error('채널 ID 또는 @핸들을 입력해 주세요');
  const c = channel.trim();
  const q = c.startsWith('UC') ? `id=${encodeURIComponent(c)}` : `forHandle=${encodeURIComponent(c.startsWith('@') ? c : '@' + c)}`;
  const cj = await getJSON(`${API}channels?part=snippet,statistics,contentDetails&${q}&key=${encodeURIComponent(apiKey)}`);
  if (!cj.items || !cj.items[0]) throw new Error('채널을 찾을 수 없어요');
  const ch = cj.items[0];
  const uploads = ch.contentDetails && ch.contentDetails.relatedPlaylists && ch.contentDetails.relatedPlaylists.uploads;
  const ids = [];
  let pageToken = '';
  for (let page = 0; page < 4 && uploads; page++) {
    const pj = await getJSON(`${API}playlistItems?part=contentDetails&maxResults=50&playlistId=${uploads}&key=${encodeURIComponent(apiKey)}${pageToken ? '&pageToken=' + pageToken : ''}`);
    (pj.items || []).forEach(it => ids.push(it.contentDetails.videoId));
    if (!pj.nextPageToken) break;
    pageToken = pj.nextPageToken;
  }
  const videos = [];
  for (let i = 0; i < ids.length; i += 50) {
    const vj = await getJSON(`${API}videos?part=snippet,contentDetails,statistics,status&id=${ids.slice(i, i + 50).join(',')}&key=${encodeURIComponent(apiKey)}`);
    (vj.items || []).forEach(v => {
      const m = mapVideo(v);
      m.short = m.duration > 0 && m.duration <= 180;
      videos.push(m);
    });
  }
  const sn = ch.snippet || {}, st = ch.statistics || {};
  const th = (sn.thumbnails && (sn.thumbnails.default || sn.thumbnails.medium)) || {};
  return {
    channel: {
      id: ch.id, title: sn.title || '', thumb: th.url || '',
      subscribers: st.hiddenSubscriberCount ? null : +st.subscriberCount,
      views: +st.viewCount || 0, videoCount: +st.videoCount || 0
    },
    videos
  };
}

module.exports = { lookup, syncChannel, videoId };
