// 하루칸 — 메인 프로세스: 트레이 · 바탕화면 위젯 · 플래너 창 · 빠른 추가 창
const { app, BrowserWindow, Tray, Menu, ipcMain, globalShortcut, nativeImage, shell, dialog, protocol, net, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const Store = require('./store');
const youtube = require('./youtube');

const ROOT = path.join(__dirname, '..', '..');
const ASSETS = path.join(ROOT, 'assets');
const QUICK_KEY = 'Control+Alt+N';
const START_HIDDEN = process.argv.includes('--hidden');

app.setAppUserModelId('com.harukan.app');
if (process.env.HARUKAN_DATA) app.setPath('userData', process.env.HARUKAN_DATA);
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
]);

let store, state;
let tray = null, mainWin = null, widgetWin = null, quickWin = null;
let leftCount = 0;
let quitting = false;

const DEFAULT_SETTINGS = {
  widgets: { cal: true, todo: true, week: true },
  widgetLocked: false,
  widgetOpacity: 1,
  widgetOnTop: false,
  widgetPos: null,
  autoStart: true,
  uiScale: null,
  mainBounds: null,
  ytApiKey: '',
  ytChannel: ''
};

function settings() {
  if (!state) return DEFAULT_SETTINGS;
  state.settings = Object.assign({}, DEFAULT_SETTINGS, state.settings || {});
  state.settings.widgets = Object.assign({}, DEFAULT_SETTINGS.widgets, state.settings.widgets || {});
  return state.settings;
}

function defaultScale() {
  // 125% 이상 배율 노트북에서는 글자가 크게 보이지 않도록 조금 줄인다
  const sf = screen.getPrimaryDisplay().scaleFactor || 1;
  return sf >= 1.5 ? 0.85 : sf >= 1.25 ? 0.9 : 1;
}
const uiScale = () => settings().uiScale || defaultScale();

function saveState(next, from) {
  state = next;
  store.set(state);
  for (const w of [mainWin, widgetWin, quickWin]) {
    if (w && !w.isDestroyed() && w.webContents !== from) w.webContents.send('state', state);
  }
  applySettings();
}

function patchSettings(patch) {
  const s = settings();
  state = state || {};
  state.settings = Object.assign({}, s, patch);
  saveState(state, null);
}

// ---------- 프로토콜: app://ui/… → 앱 파일, app://photos/… → 사진 폴더 ----------
function registerProtocol() {
  const allowed = [path.join(ROOT, 'src', 'renderer'), path.join(ROOT, 'node_modules', '@fontsource'), ASSETS];
  protocol.handle('app', (req) => {
    const u = new URL(req.url);
    let file;
    if (u.host === 'photos') {
      file = path.join(store.photoDir, path.basename(decodeURIComponent(u.pathname)));
    } else {
      file = path.normalize(path.join(ROOT, decodeURIComponent(u.pathname)));
      if (!allowed.some(a => file.startsWith(a + path.sep))) return new Response('forbidden', { status: 403 });
    }
    return net.fetch(pathToFileURL(file).toString());
  });
}
const ui = (file, query) => `app://ui/src/renderer/${file}${query ? '?' + query : ''}`;

const webPrefs = () => ({
  preload: path.join(__dirname, 'preload.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: false,
  spellcheck: false,
  zoomFactor: uiScale()
});

function guardNavigation(win) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('app://')) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); }
  });
}

// ---------- 플래너 창 ----------
function createMain(show) {
  const b = settings().mainBounds;
  const wa = screen.getPrimaryDisplay().workAreaSize;
  const sc = uiScale();
  const w = Math.min(Math.round(1310 * sc), wa.width - 40), h = Math.min(Math.round(840 * sc), wa.height - 40);
  mainWin = new BrowserWindow({
    width: b ? b.width : w, height: b ? b.height : h,
    x: b ? b.x : undefined, y: b ? b.y : undefined,
    minWidth: 980, minHeight: 640,
    frame: false, show: false,
    transparent: true, backgroundColor: '#00000000', hasShadow: false,
    title: '하루칸',
    icon: path.join(ASSETS, 'icon.png'),
    webPreferences: webPrefs()
  });
  guardNavigation(mainWin);
  mainWin.loadURL(ui('app.html'));
  mainWin.once('ready-to-show', () => { if (show) { mainWin.show(); mainWin.focus(); } });
  const saveBounds = () => {
    if (!mainWin || mainWin.isDestroyed() || mainWin.isMaximized() || mainWin.isMinimized()) return;
    settings().mainBounds = mainWin.getBounds();
    store.set(state);
  };
  mainWin.on('resized', saveBounds);
  mainWin.on('moved', saveBounds);
  mainWin.on('maximize', () => mainWin.webContents.send('maximized', true));
  mainWin.on('unmaximize', () => mainWin.webContents.send('maximized', false));
  mainWin.on('close', (e) => {
    if (!quitting) { e.preventDefault(); mainWin.hide(); }
  });
  mainWin.on('closed', () => { mainWin = null; });
}

function openPlanner(view, arg) {
  if (!mainWin) createMain(false);
  const go = () => {
    if (view) mainWin.webContents.send('navigate', view, arg);
    if (mainWin.isMinimized()) mainWin.restore();
    mainWin.show();
    mainWin.focus();
  };
  if (mainWin.webContents.isLoading()) mainWin.webContents.once('did-finish-load', go); else go();
}

// ---------- 바탕화면 위젯 ----------
function createWidget() {
  const s = settings();
  const wa = screen.getPrimaryDisplay().workArea;
  const pos = s.widgetPos && screen.getAllDisplays().some(d => {
    const r = d.workArea;
    return s.widgetPos.x >= r.x - 100 && s.widgetPos.x < r.x + r.width && s.widgetPos.y >= r.y - 50 && s.widgetPos.y < r.y + r.height;
  }) ? s.widgetPos : { x: wa.x + 36, y: wa.y + 28 };
  widgetWin = new BrowserWindow({
    x: pos.x, y: pos.y, width: Math.round(430 * uiScale()), height: 600,
    frame: false, transparent: true, resizable: false, maximizable: false, minimizable: false, fullscreenable: false,
    skipTaskbar: true, hasShadow: false, show: false,
    alwaysOnTop: !!s.widgetOnTop,
    title: '하루칸 위젯',
    webPreferences: webPrefs()
  });
  guardNavigation(widgetWin);
  widgetWin.loadURL(ui('widget.html'));
  widgetWin.once('ready-to-show', () => { widgetWin.showInactive(); applySettings(); });
  widgetWin.on('moved', () => {
    const [x, y] = widgetWin.getPosition();
    settings().widgetPos = { x, y };
    store.set(state);
  });
  widgetWin.on('close', (e) => { if (!quitting) e.preventDefault(); });
  widgetWin.on('closed', () => { widgetWin = null; });
}

// ---------- 빠른 할 일 추가 ----------
function showQuick() {
  if (!quickWin) {
    quickWin = new BrowserWindow({
      width: Math.round(560 * uiScale()), height: Math.round(210 * uiScale()),
      frame: false, transparent: true, resizable: false, skipTaskbar: true, alwaysOnTop: true,
      show: false, fullscreenable: false, maximizable: false, minimizable: false, hasShadow: false,
      title: '빠른 할 일 추가',
      webPreferences: webPrefs()
    });
    guardNavigation(quickWin);
    quickWin.loadURL(ui('quick.html'));
    quickWin.on('blur', () => quickWin && quickWin.hide());
    quickWin.on('close', (e) => { if (!quitting) { e.preventDefault(); quickWin.hide(); } });
    quickWin.on('closed', () => { quickWin = null; });
  }
  const d = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const [w, h] = quickWin.getSize();
  quickWin.setPosition(Math.round(d.x + (d.width - w) / 2), Math.round(d.y + d.height * 0.28));
  const show = () => { quickWin.show(); quickWin.focus(); quickWin.webContents.send('navigate', 'quick'); };
  if (quickWin.webContents.isLoading()) quickWin.webContents.once('did-finish-load', show); else show();
}

// ---------- 트레이 ----------
function trayMenu() {
  const s = settings();
  const w = (key, label) => ({
    label, type: 'checkbox', checked: !!s.widgets[key],
    click: () => patchSettings({ widgets: Object.assign({}, s.widgets, { [key]: !s.widgets[key] }) })
  });
  return Menu.buildFromTemplate([
    { label: `하루칸 · 오늘 ${leftCount}개 남음`, enabled: false },
    { label: '플래너 열기', click: () => openPlanner() },
    { label: '빠른 할 일 추가', accelerator: 'Ctrl+Alt+N', registerAccelerator: false, click: showQuick },
    { type: 'separator' },
    { label: '위젯 선택', enabled: false },
    w('cal', '달력 보기'),
    w('todo', '할 일 보기'),
    w('week', '이번 주 작업량 보기'),
    { type: 'separator' },
    { label: '위젯 위치 고정', type: 'checkbox', checked: !!s.widgetLocked, click: () => patchSettings({ widgetLocked: !s.widgetLocked }) },
    {
      label: '위젯 투명도', submenu: [1, 0.9, 0.8, 0.7, 0.6].map(v => ({
        label: Math.round(v * 100) + '%', type: 'radio', checked: Math.abs((s.widgetOpacity || 1) - v) < 0.01,
        click: () => patchSettings({ widgetOpacity: v })
      }))
    },
    { label: '위젯 항상 위에 표시', type: 'checkbox', checked: !!s.widgetOnTop, click: () => patchSettings({ widgetOnTop: !s.widgetOnTop }) },
    { label: 'Windows 시작 시 실행', type: 'checkbox', checked: !!s.autoStart, click: () => patchSettings({ autoStart: !s.autoStart }) },
    { type: 'separator' },
    { label: '종료', click: () => { quitting = true; app.quit(); } }
  ]);
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(path.join(ASSETS, 'tray.png')));
  tray.setToolTip('하루칸');
  tray.on('click', () => openPlanner());
  tray.on('right-click', () => tray.popUpContextMenu(trayMenu()));
}

function applySettings() {
  const s = settings();
  if (widgetWin && !widgetWin.isDestroyed()) {
    widgetWin.setOpacity(s.widgetOpacity || 1);
    widgetWin.setMovable(!s.widgetLocked);
    widgetWin.setAlwaysOnTop(!!s.widgetOnTop);
  }
  const z = uiScale();
  for (const w of [mainWin, widgetWin, quickWin]) {
    if (w && !w.isDestroyed() && Math.abs(w.webContents.getZoomFactor() - z) > 0.001) w.webContents.setZoomFactor(z);
  }
  if (app.isPackaged) {
    const cur = app.getLoginItemSettings({ args: ['--hidden'] }).openAtLogin;
    if (cur !== !!s.autoStart) app.setLoginItemSettings({ openAtLogin: !!s.autoStart, args: ['--hidden'] });
  }
}

// ---------- IPC ----------
function setupIpc() {
  ipcMain.handle('state:get', () => state);
  ipcMain.on('state:set', (e, next) => saveState(next, e.sender));

  ipcMain.on('win', (e, cmd, arg) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    if (!w) return;
    if (cmd === 'min') w.minimize();
    else if (cmd === 'max') w.isMaximized() ? w.unmaximize() : w.maximize();
    else if (cmd === 'close') w.close();
    else if (cmd === 'hide') w.hide();
    else if (cmd === 'quick') showQuick();
    else if (cmd === 'quit') { quitting = true; app.quit(); }
  });
  // 투명한 빈 곳은 클릭이 바탕화면으로 통과하게 (Windows · macOS)
  ipcMain.on('win:ignore', (e, ignore) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    if (!w || process.platform === 'linux') return;
    w.setIgnoreMouseEvents(!!ignore, { forward: true });
  });
  // 투명 창 가장자리 크기 조절 — 마우스를 놓을 때까지 커서를 따라간다
  let resizing = null;
  ipcMain.on('win:resize-start', (e, edge) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    if (!w || w.isMaximized()) return;
    clearInterval(resizing && resizing.timer);
    const start = w.getBounds(), p0 = screen.getCursorScreenPoint();
    const [minW, minH] = w.getMinimumSize();
    resizing = {
      timer: setInterval(() => {
        if (w.isDestroyed()) return clearInterval(resizing.timer);
        const p = screen.getCursorScreenPoint();
        const dx = p.x - p0.x, dy = p.y - p0.y;
        const b = Object.assign({}, start);
        if (edge.includes('r')) b.width = Math.max(minW, start.width + dx);
        if (edge.includes('b')) b.height = Math.max(minH, start.height + dy);
        if (edge.includes('l')) { b.width = Math.max(minW, start.width - dx); b.x = start.x + start.width - b.width; }
        if (edge.includes('t')) { b.height = Math.max(minH, start.height - dy); b.y = start.y + start.height - b.height; }
        w.setBounds(b);
      }, 16)
    };
  });
  ipcMain.on('win:resize-end', () => {
    if (!resizing) return;
    clearInterval(resizing.timer);
    resizing = null;
    if (mainWin && !mainWin.isDestroyed() && !mainWin.isMaximized()) { settings().mainBounds = mainWin.getBounds(); store.set(state); }
  });
  ipcMain.on('planner:open', (_e, view, arg) => openPlanner(view, arg));
  ipcMain.on('widget:resize', (_e, w, h) => {
    if (!widgetWin || widgetWin.isDestroyed()) return;
    const z = uiScale();
    const [cw, ch] = widgetWin.getContentSize();
    const nw = Math.max(60, Math.ceil(w * z)), nh = Math.max(40, Math.ceil(h * z));
    if (cw !== nw || ch !== nh) widgetWin.setContentSize(nw, nh);
  });
  ipcMain.on('widget:menu', () => tray && tray.popUpContextMenu(trayMenu()));
  ipcMain.on('badge', (_e, count, trayUrl, overlayUrl) => {
    leftCount = count;
    if (tray) {
      tray.setToolTip(`하루칸 · 오늘 ${count}개 남음`);
      if (trayUrl) tray.setImage(nativeImage.createFromDataURL(trayUrl));
    }
    if (mainWin && !mainWin.isDestroyed() && process.platform === 'win32') {
      mainWin.setOverlayIcon(count > 0 && overlayUrl ? nativeImage.createFromDataURL(overlayUrl) : null, count > 0 ? `${count}개 남음` : '');
    }
  });

  ipcMain.on('open-external', (_e, url) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); });

  ipcMain.handle('context-menu', (e, items) => new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const build = (list) => list.map(it => it.type === 'separator' ? { type: 'separator' } : ({
      label: it.label, type: it.type || 'normal', checked: !!it.checked, enabled: it.enabled !== false,
      submenu: it.submenu ? build(it.submenu) : undefined,
      click: it.submenu ? undefined : () => finish(it.id)
    }));
    Menu.buildFromTemplate(build(items)).popup({
      window: BrowserWindow.fromWebContents(e.sender),
      callback: () => setTimeout(() => finish(null), 50)
    });
  }));

  ipcMain.handle('photos:pick', async (e) => {
    const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), {
      title: '사진 첨부', properties: ['openFile', 'multiSelections'],
      filters: [{ name: '사진', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] }]
    });
    if (r.canceled) return [];
    return r.filePaths.map(p => store.savePhoto(p));
  });
  ipcMain.handle('photos:save', (_e, paths) => (paths || [])
    .filter(p => /\.(jpe?g|png|gif|webp|bmp)$/i.test(p) && fs.existsSync(p))
    .map(p => store.savePhoto(p)));
  ipcMain.on('photos:delete', (_e, name) => store.deletePhoto(name));

  ipcMain.handle('yt:lookup', async (_e, url) => {
    try { return { ok: true, data: await youtube.lookup(url, settings().ytApiKey) }; }
    catch (err) { return { ok: false, error: err.message }; }
  });
  ipcMain.handle('yt:sync', async () => {
    try { const s = settings(); return { ok: true, data: await youtube.syncChannel(s.ytApiKey, s.ytChannel) }; }
    catch (err) { return { ok: false, error: err.message }; }
  });

  ipcMain.handle('data:export', async (e) => {
    const r = await dialog.showSaveDialog(BrowserWindow.fromWebContents(e.sender), {
      title: '데이터 내보내기', defaultPath: `하루칸-백업-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (r.canceled || !r.filePath) return false;
    fs.writeFileSync(r.filePath, JSON.stringify(state, null, 1), 'utf8');
    return true;
  });
  ipcMain.handle('data:import', async (e) => {
    const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), {
      title: '데이터 가져오기', properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (r.canceled || !r.filePaths[0]) return null;
    try {
      const data = JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8'));
      if (!data || !Array.isArray(data.tasks)) throw new Error('하루칸 백업 파일이 아니에요');
      saveState(data, null);
      return data;
    } catch (err) {
      dialog.showErrorBox('가져오기 실패', err.message);
      return null;
    }
  });
  ipcMain.on('data:folder', () => shell.openPath(store.dir));
  ipcMain.handle('app:info', () => ({ version: app.getVersion(), dataDir: store.dir, quickKey: 'Ctrl+Alt+N', packaged: app.isPackaged }));
}

// ---------- 시작 ----------
app.whenReady().then(() => {
  store = new Store(app.getPath('userData'));
  state = store.get();
  registerProtocol();
  setupIpc();
  createTray();
  createWidget();
  createMain(!START_HIDDEN);
  if (!globalShortcut.register(QUICK_KEY, showQuick)) console.warn('단축키 등록 실패:', QUICK_KEY);
  applySettings();
  screen.on('display-metrics-changed', applySettings);
});

// 개발용: HARUKAN_SHOTS=폴더 로 실행하면 모든 화면을 캡처하고 종료한다
if (process.env.HARUKAN_SHOTS) {
  app.on('web-contents-created', (_e, wc) => wc.on('console-message', (ev, level, msg, line, src) => {
    const m = ev && ev.message !== undefined ? ev : { message: msg, level, lineNumber: line, sourceId: src };
    console.log(`[renderer:${m.level}] ${m.message} (${m.sourceId}:${m.lineNumber})`);
  }));
  app.whenReady().then(async () => {
    const dir = process.env.HARUKAN_SHOTS;
    fs.mkdirSync(dir, { recursive: true });
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    await wait(2500);
    const run = (js) => mainWin.webContents.executeJavaScript(js, true);
    await run(`document.querySelector('#sample') && document.querySelector('#sample').click()`);
    mainWin.show();
    await wait(1500);
    const views = (process.env.HARUKAN_VIEWS || 'week,month,todo,work,ideas,links,youtube,settings').split(',');
    for (const v of views) {
      mainWin.webContents.send('navigate', v);
      await wait(900);
      fs.writeFileSync(path.join(dir, `${v}.png`), (await mainWin.webContents.capturePage()).toPNG());
    }
    if (process.env.HARUKAN_JS) { await run(process.env.HARUKAN_JS); await wait(900); fs.writeFileSync(path.join(dir, 'custom.png'), (await mainWin.webContents.capturePage()).toPNG()); }
    fs.writeFileSync(path.join(dir, 'widget.png'), (await widgetWin.webContents.capturePage()).toPNG());
    showQuick();
    await wait(800);
    await quickWin.webContents.executeJavaScript(`(()=>{const q=document.getElementById('q');q.value='내일 오후 3시 샘플 촬영 #작업';q.dispatchEvent(new Event('input'));})()`);
    await wait(300);
    fs.writeFileSync(path.join(dir, 'quick.png'), (await quickWin.webContents.capturePage()).toPNG());
    const logs = await mainWin.webContents.executeJavaScript('window.__errors || []');
    fs.writeFileSync(path.join(dir, 'errors.json'), JSON.stringify(logs, null, 1));
    quitting = true;
    app.quit();
  });
}

app.on('second-instance', () => openPlanner());
app.on('before-quit', () => { quitting = true; if (store) store.flush(); });
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => { /* 트레이에 상주 */ });
