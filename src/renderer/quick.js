// 빠른 할 일 추가 창 (Ctrl+Alt+N)
import { esc, today, relDay } from './lib/util.js';
import { store, newTask } from './lib/data.js';
import { parseTask } from './lib/parse.js';

const $q = document.getElementById('q');
const $chips = document.getElementById('chips');
const $cats = document.getElementById('cats');
let picked = null;

function cats() {
  const s = store.state;
  if (!s) return;
  const p = parseTask($q.value, s.categories);
  const sel = p.cat || picked || s.categories[0].id;
  $cats.innerHTML = s.categories.map(c => `<button data-id="${esc(c.id)}" class="${c.id === sel ? 'on' : ''}" style="${c.id === sel ? `background:${c.color};border-color:${c.color}` : `color:${c.color}`}">${esc(c.name)}</button>`).join('');
}
function preview() {
  const s = store.state;
  if (!s) return;
  const p = parseTask($q.value, s.categories);
  const chips = [];
  chips.push(relDay(p.date || today()));
  if (p.time) chips.push(p.time);
  $chips.innerHTML = $q.value.trim() ? chips.map(c => `<span>${esc(c)}</span>`).join('') : '<span class="muted">날짜 · 시간 · #카테고리를 알아서 인식해요</span>';
  cats();
}
$cats.addEventListener('mousedown', (e) => { const b = e.target.closest('button'); if (b) { e.preventDefault(); picked = b.dataset.id; cats(); } });
$q.addEventListener('input', preview);
$q.addEventListener('keydown', (e) => {
  if (e.isComposing) return;
  if (e.key === 'Escape') { $q.value = ''; window.harukan.win('hide'); }
  if (e.key === 'Enter') {
    const v = $q.value.trim();
    if (!v || !store.state) return;
    const p = parseTask(v, store.state.categories);
    store.update(s => s.tasks.push(newTask({ title: p.title || v, date: p.date || today(), time: p.time, cat: p.cat || picked || s.categories[0].id })));
    $q.value = ''; picked = null; preview();
    window.harukan.win('hide');
  }
});
window.harukan.onNavigate(() => { $q.value = ''; picked = null; preview(); setTimeout(() => $q.focus(), 30); });
store.subscribe(cats);
store.init().then(preview);
