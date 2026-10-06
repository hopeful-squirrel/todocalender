const { contextBridge, ipcRenderer, webUtils } = require('electron');

const listeners = new Set();
ipcRenderer.on('state', (_e, state) => listeners.forEach(fn => fn(state)));

contextBridge.exposeInMainWorld('harukan', {
  // 데이터
  getState: () => ipcRenderer.invoke('state:get'),
  setState: (state) => ipcRenderer.send('state:set', state),
  onState: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },

  // 창
  win: (cmd, arg) => ipcRenderer.send('win', cmd, arg),
  ignoreMouse: (v) => ipcRenderer.send('win:ignore', v),
  resizeStart: (edge) => ipcRenderer.send('win:resize-start', edge),
  resizeEnd: () => ipcRenderer.send('win:resize-end'),
  openPlanner: (view, arg) => ipcRenderer.send('planner:open', view, arg),
  onNavigate: (fn) => ipcRenderer.on('navigate', (_e, view, arg) => fn(view, arg)),
  onMaximized: (fn) => ipcRenderer.on('maximized', (_e, v) => fn(v)),
  widgetResize: (w, h) => ipcRenderer.send('widget:resize', w, h),
  widgetMenu: () => ipcRenderer.send('widget:menu'),
  setBadge: (count, trayDataUrl, overlayDataUrl) => ipcRenderer.send('badge', count, trayDataUrl, overlayDataUrl),

  // 기능
  openExternal: (url) => ipcRenderer.send('open-external', url),
  contextMenu: (items) => ipcRenderer.invoke('context-menu', items),
  pickPhotos: () => ipcRenderer.invoke('photos:pick'),
  savePhotoPaths: (paths) => ipcRenderer.invoke('photos:save', paths),
  deletePhoto: (name) => ipcRenderer.send('photos:delete', name),
  pathForFile: (file) => webUtils.getPathForFile(file),
  ytLookup: (url) => ipcRenderer.invoke('yt:lookup', url),
  ytSync: () => ipcRenderer.invoke('yt:sync'),
  exportData: () => ipcRenderer.invoke('data:export'),
  importData: () => ipcRenderer.invoke('data:import'),
  openDataFolder: () => ipcRenderer.send('data:folder'),
  appInfo: () => ipcRenderer.invoke('app:info')
});
