// 대한민국 공휴일 (양력 고정 + 음력 명절 2025–2032)
const FIXED = { '01-01': '신정', '03-01': '삼일절', '05-05': '어린이날', '06-06': '현충일', '08-15': '광복절', '10-03': '개천절', '10-09': '한글날', '12-25': '성탄절' };
const SEOL = { 2025: '01-29', 2026: '02-17', 2027: '02-07', 2028: '01-27', 2029: '02-13', 2030: '02-03', 2031: '01-23', 2032: '02-11' };
const CHUSEOK = { 2025: '10-06', 2026: '09-25', 2027: '09-15', 2028: '10-03', 2029: '09-22', 2030: '09-12', 2031: '10-01', 2032: '09-19' };
const BUDDHA = { 2025: '05-05', 2026: '05-24', 2027: '05-13', 2028: '05-02', 2029: '05-20', 2030: '05-09', 2031: '05-28', 2032: '05-16' };

const cache = {};
function around(y, mmdd, name, out) {
  const d = new Date(y, +mmdd.slice(0, 2) - 1, +mmdd.slice(3));
  [-1, 0, 1].forEach(k => {
    const x = new Date(d); x.setDate(d.getDate() + k);
    const key = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    if (!out[key]) out[key] = name;
  });
}
function forYear(y) {
  if (cache[y]) return cache[y];
  const out = {};
  for (const k in FIXED) out[`${y}-${k}`] = FIXED[k];
  if (SEOL[y]) around(y, SEOL[y], '설날', out);
  if (CHUSEOK[y]) around(y, CHUSEOK[y], '추석', out);
  if (BUDDHA[y] && !out[`${y}-${BUDDHA[y]}`]) out[`${y}-${BUDDHA[y]}`] = '부처님오신날';
  return (cache[y] = out);
}
export const holiday = (s) => forYear(+s.slice(0, 4))[s] || '';
