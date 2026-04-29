// ============================================================
// 儲存層：Firebase Firestore（線上）/ IndexedDB（離線 fallback）
// 介面對外一致，內部根據設定切換
// ============================================================
import { STORAGE_KEYS, DEFAULT_FIREBASE_CONFIG } from './config.js';

const DB_NAME = 'ipas-exam-sim';
const DB_VER  = 1;
const STORES  = ['QuestionBank', 'LearningMaterials'];

/* ─────────── IndexedDB 基底 ─────────── */
function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      STORES.forEach(name => {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' });
        }
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function idbAll(store, filter) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const s = tx.objectStore(store);
    const req = s.getAll();
    req.onsuccess = () => {
      let res = req.result || [];
      if (filter) res = res.filter(filter);
      resolve(res);
    };
    req.onerror = () => reject(req.error);
  });
}
async function idbPut(store, item) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(item);
    tx.oncomplete = () => resolve(item);
    tx.onerror    = () => reject(tx.error);
  });
}
async function idbDel(store, id) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}
async function idbClear(store, filter) {
  const all = await idbAll(store, filter);
  for (const item of all) await idbDel(store, item.id);
  return all.length;
}

/* ─────────── Firestore（動態載入 SDK） ─────────── */
let _fbApp = null;
let _fbDb  = null;
let _fbStatus = 'disabled';   // 'disabled' | 'connected' | 'error'

function getFbConfig() {
  // 一律使用內建設定（不再支援 localStorage 覆蓋）
  if (DEFAULT_FIREBASE_CONFIG && DEFAULT_FIREBASE_CONFIG.apiKey) {
    return DEFAULT_FIREBASE_CONFIG;
  }
  return null;
}

// 對外提供 projectId，給 UI 顯示
export function getFirebaseProjectId() {
  return DEFAULT_FIREBASE_CONFIG?.projectId || '';
}

export async function initFirebase() {
  const cfg = getFbConfig();
  if (!cfg || !cfg.apiKey || !cfg.projectId) {
    _fbStatus = 'disabled';
    return { ok: false, reason: 'no-config' };
  }
  try {
    const app = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
    const fs  = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
    _fbApp = app.initializeApp(cfg, 'ipas-' + Date.now());
    _fbDb  = fs.getFirestore(_fbApp);
    // expose 給 store 使用
    fbApi = fs;
    // 試讀一筆，驗證連線
    await fs.getDocs(fs.query(fs.collection(_fbDb, 'QuestionBank'), fs.limit(1)));
    _fbStatus = 'connected';
    return { ok: true };
  } catch (e) {
    console.warn('Firebase init failed', e);
    _fbStatus = 'error';
    return { ok: false, reason: e.message };
  }
}

let fbApi = null;
export function firebaseStatus() { return _fbStatus; }

/* ─────────── 對外 API ─────────── */

// 教材
export async function saveMaterial({ level, title, content }) {
  const item = {
    id: 'mat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    level, title, content,
    createdAt: Date.now(),
  };
  if (_fbStatus === 'connected') {
    const doc = fbApi.doc(_fbDb, 'LearningMaterials', item.id);
    await fbApi.setDoc(doc, item);
  }
  await idbPut('LearningMaterials', item);   // 永遠也寫一份本機
  return item;
}

export async function listMaterials(level) {
  if (_fbStatus === 'connected') {
    try {
      const q = fbApi.query(fbApi.collection(_fbDb, 'LearningMaterials'),
        fbApi.where('level', '==', level));
      const snap = await fbApi.getDocs(q);
      const out = [];
      snap.forEach(d => out.push(d.data()));
      out.sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
      return out;
    } catch (e) { console.warn('Firestore list failed', e); }
  }
  const all = await idbAll('LearningMaterials', m => m.level === level);
  return all.sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
}

export async function deleteMaterial(id) {
  if (_fbStatus === 'connected') {
    try { await fbApi.deleteDoc(fbApi.doc(_fbDb, 'LearningMaterials', id)); }
    catch (e) { console.warn(e); }
  }
  await idbDel('LearningMaterials', id);
}

// 題庫
export async function addQuestions(items) {
  // items: [{ level, subject, question, options, answer }]
  const stamped = items.map((q, i) => ({
    id: 'q_' + Date.now() + '_' + i + '_' + Math.random().toString(36).slice(2,5),
    createdAt: Date.now(),
    ...q,
  }));
  if (_fbStatus === 'connected') {
    try {
      // 批次寫入 (max 500/batch)
      for (let i = 0; i < stamped.length; i += 400) {
        const batch = fbApi.writeBatch(_fbDb);
        stamped.slice(i, i+400).forEach(q => {
          batch.set(fbApi.doc(_fbDb, 'QuestionBank', q.id), q);
        });
        await batch.commit();
      }
    } catch (e) { console.warn('Firestore batch add failed', e); }
  }
  for (const q of stamped) await idbPut('QuestionBank', q);
  return stamped.length;
}

export async function listQuestions(filter = {}) {
  if (_fbStatus === 'connected') {
    try {
      let q = fbApi.collection(_fbDb, 'QuestionBank');
      const conds = [];
      if (filter.level)   conds.push(fbApi.where('level',   '==', filter.level));
      if (filter.subject) conds.push(fbApi.where('subject', '==', filter.subject));
      const ref = conds.length ? fbApi.query(q, ...conds) : q;
      const snap = await fbApi.getDocs(ref);
      const out = [];
      snap.forEach(d => out.push(d.data()));
      return out;
    } catch (e) { console.warn('Firestore list questions failed', e); }
  }
  return await idbAll('QuestionBank', q => {
    if (filter.level   && q.level   !== filter.level)   return false;
    if (filter.subject && q.subject !== filter.subject) return false;
    return true;
  });
}

export async function countQuestions() {
  // 分組統計
  const all = await listQuestions();
  const out = { 'junior:1': 0, 'junior:2': 0, 'intermediate:1': 0, 'intermediate:2': 0 };
  all.forEach(q => {
    const k = `${q.level}:${q.subject}`;
    if (out[k] != null) out[k]++;
  });
  return out;
}

export async function clearAllQuestions() {
  if (_fbStatus === 'connected') {
    try {
      const snap = await fbApi.getDocs(fbApi.collection(_fbDb, 'QuestionBank'));
      const docs = []; snap.forEach(d => docs.push(d.id));
      for (let i = 0; i < docs.length; i += 400) {
        const batch = fbApi.writeBatch(_fbDb);
        docs.slice(i, i+400).forEach(id => {
          batch.delete(fbApi.doc(_fbDb, 'QuestionBank', id));
        });
        await batch.commit();
      }
    } catch (e) { console.warn(e); }
  }
  return await idbClear('QuestionBank');
}

export async function exportAll() {
  const materials = await idbAll('LearningMaterials');
  const questions = await idbAll('QuestionBank');
  return { exportedAt: new Date().toISOString(), materials, questions };
}

export async function importAll(data) {
  let m = 0, q = 0;
  if (Array.isArray(data.materials)) {
    for (const x of data.materials) { await idbPut('LearningMaterials', x); m++; }
  }
  if (Array.isArray(data.questions)) {
    for (const x of data.questions) { await idbPut('QuestionBank', x); q++; }
  }
  return { materials: m, questions: q };
}
