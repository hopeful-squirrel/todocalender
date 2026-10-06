// 하루칸 아이콘 생성 — assets/icon.png(256), icon.ico(16~256), tray.png(32)
// 외부 의존성 없이 SDF로 그린다.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'assets');
fs.mkdirSync(OUT, { recursive: true });

const YEL = [245, 227, 154], INK = [43, 36, 32];

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
function rrDist(px, py, x, y, w, h, r) {
  const cx = x + w / 2, cy = y + h / 2;
  const qx = Math.abs(px - cx) - w / 2 + r, qy = Math.abs(py - cy) - h / 2 + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

// 24x24 좌표계의 노트 아이콘 (디자인의 트레이 아이콘과 같은 모양)
const STROKES = [
  [[4, 4], [20, 4], [20, 16], [16, 20], [4, 20], [4, 4]],
  [[16, 20], [16, 16], [20, 16]],
  [[8, 9], [16, 9]],
  [[8, 13], [13, 13]]
];

function render(size) {
  const px = Buffer.alloc(size * size * 4);
  const SS = 4;
  const s = size / 32; // 32 단위 캔버스
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const u = (x + (sx + 0.5) / SS) / s, v = (y + (sy + 0.5) / SS) / s; // 0..32
        let col = null;
        if (rrDist(u, v, 1, 1, 30, 30, 7) <= 0) col = YEL;
        // 아이콘을 32 캔버스 가운데 (24 → 22 크기)
        const iu = (u - 5) * (24 / 22), iv = (v - 5) * (24 / 22);
        const sw = size <= 20 ? 1.6 : size <= 32 ? 1.35 : 1.15;
        let d = Infinity;
        for (const st of STROKES) for (let i = 0; i < st.length - 1; i++) d = Math.min(d, segDist(iu, iv, st[i][0], st[i][1], st[i + 1][0], st[i + 1][1]));
        if (col && d <= sw) col = INK;
        if (col) { r += col[0]; g += col[1]; b += col[2]; a += 255; }
      }
      const n = SS * SS, i = (y * size + x) * 4;
      const al = a / n;
      px[i] = al ? Math.round(r / (a / 255)) : 0;
      px[i + 1] = al ? Math.round(g / (a / 255)) : 0;
      px[i + 2] = al ? Math.round(b / (a / 255)) : 0;
      px[i + 3] = Math.round(al);
    }
  }
  return px;
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size) {
  const px = render(size);
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
function ico(sizes) {
  const imgs = sizes.map(png);
  const head = Buffer.alloc(6); head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
  let off = 6 + 16 * sizes.length;
  const dir = sizes.map((s, i) => {
    const e = Buffer.alloc(16);
    e[0] = s >= 256 ? 0 : s; e[1] = s >= 256 ? 0 : s; e[2] = 0; e[3] = 0;
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(imgs[i].length, 8); e.writeUInt32LE(off, 12);
    off += imgs[i].length;
    return e;
  });
  return Buffer.concat([head, ...dir, ...imgs]);
}

fs.writeFileSync(path.join(OUT, 'icon.png'), png(256));
fs.writeFileSync(path.join(OUT, 'tray.png'), png(32));
fs.writeFileSync(path.join(OUT, 'tray@2x.png'), png(64));
fs.writeFileSync(path.join(OUT, 'icon.ico'), ico([16, 24, 32, 48, 64, 128, 256]));
console.log('아이콘 생성 완료:', OUT);
