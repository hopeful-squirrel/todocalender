// 하루칸 데이터 저장소 — userData 폴더의 JSON 파일 하나에 모든 데이터를 보관한다.
const fs = require('fs');
const path = require('path');

class Store {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, 'harukan-data.json');
    this.backupDir = path.join(dir, 'backups');
    this.photoDir = path.join(dir, 'photos');
    fs.mkdirSync(this.photoDir, { recursive: true });
    fs.mkdirSync(this.backupDir, { recursive: true });
    this.data = this._load();
    this._timer = null;
  }

  _load() {
    for (const f of [this.file, this.file + '.bak']) {
      try {
        if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
      } catch (e) {
        console.error('데이터 읽기 실패', f, e);
      }
    }
    return null; // 첫 실행
  }

  get() { return this.data; }

  set(data) {
    this.data = data;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.flush(), 300);
  }

  flush() {
    clearTimeout(this._timer);
    if (!this.data) return;
    const json = JSON.stringify(this.data, null, 1);
    const tmp = this.file + '.tmp';
    try {
      if (fs.existsSync(this.file)) fs.copyFileSync(this.file, this.file + '.bak');
      fs.writeFileSync(tmp, json, 'utf8');
      fs.renameSync(tmp, this.file);
      this._dailyBackup(json);
    } catch (e) {
      console.error('데이터 저장 실패', e);
    }
  }

  _dailyBackup(json) {
    const d = new Date();
    const name = `harukan-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
    const p = path.join(this.backupDir, name);
    if (fs.existsSync(p)) return;
    fs.writeFileSync(p, json, 'utf8');
    // 최근 14개만 유지
    const all = fs.readdirSync(this.backupDir).filter(f => f.startsWith('harukan-')).sort();
    while (all.length > 14) fs.unlinkSync(path.join(this.backupDir, all.shift()));
  }

  savePhoto(srcPath) {
    const ext = (path.extname(srcPath) || '.jpg').toLowerCase();
    const name = Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + ext;
    fs.copyFileSync(srcPath, path.join(this.photoDir, name));
    return name;
  }

  deletePhoto(name) {
    const p = path.join(this.photoDir, path.basename(name));
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (e) { /* 무시 */ }
  }
}

module.exports = Store;
