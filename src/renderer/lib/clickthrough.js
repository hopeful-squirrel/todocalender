// 투명 창에서 내용이 없는 곳은 마우스를 바탕화면으로 통과시킨다
export function clickThrough(isSolid) {
  let ignoring = false;
  const set = (v) => { if (v !== ignoring) { ignoring = v; window.harukan.ignoreMouse(v); } };
  document.addEventListener('mousemove', (e) => {
    if (e.buttons) return; // 끌기 중에는 바꾸지 않는다
    const el = document.elementFromPoint(e.clientX, e.clientY);
    set(!(el && el !== document.body && el !== document.documentElement && isSolid(el)));
  });
  document.addEventListener('mouseleave', () => set(false));
}
