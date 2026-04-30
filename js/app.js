// ============================================================
// 主入口：初始化、設定、Tab 切換
// ============================================================
import { STORAGE_KEYS } from './config.js';
import {
  toast, initTabs, initDrawer, initTheme,
  setConnStatus,
} from './ui.js';
import { initFirebase, firebaseStatus, getFirebaseProjectId } from './store.js';
import * as ai from './ai.js';
import { RATE_LIMITS } from './rateLimit.js';
import * as tabMaterials from './tab-materials.js';
import * as tabQuestions from './tab-questions.js';
import * as tabExam     from './tab-exam.js';

// ── 初始化全部 ──
async function boot() {
  initTheme();
  initDrawer();
  initSettingsForm();

  initTabs(tab => {
    if (tab === 'questions') tabQuestions.refreshStats();
  });

  tabMaterials.init();
  tabQuestions.init();
  tabExam.init();

  // 顯示專案 ID
  const projectIdEl = document.getElementById('fbProjectId');
  if (projectIdEl) projectIdEl.textContent = getFirebaseProjectId() || '—';

  // Rate limit 監聽：等待時通知、用量變化時刷新 UI
  ai.onRateWait((ms, model) => {
    const sec = Math.ceil(ms / 1000);
    toast(`${model} 已達速率上限，等待 ${sec} 秒後自動重試…`, 'warn', Math.min(ms + 500, 8000));
  });
  ai.onUsageChange(() => {
    renderUsagePanel();
    checkUsageWarning();
  });
  renderUsagePanel();

  // 初始連線狀態：檢查中
  setConnStatus('warn', 'Firebase 連線中…');

  // 嘗試初始化 Firebase
  await initFirebase();
  updateConnStatus();

  // ★ Firebase 連線成功後重新載入清單（修 race condition）
  // 因為 tab init 時 Firebase 還沒就緒，那次 refresh 只看到本機 IndexedDB（通常是空的）
  try {
    await tabMaterials.refreshList();
    await tabQuestions.renderBrowser();
    await tabQuestions.refreshStats();
  } catch (e) {
    console.warn('[boot] 重新載入清單失敗：', e);
  }

  // 第一次使用時提示設定 API Key
  if (!ai.isConfigured()) {
    setTimeout(() => {
      toast('請先到右上角「設定」填入 Google AI API Key', 'warn', 5000);
      document.getElementById('btnSettings').click();
    }, 400);
  }
}

/**
 * 更新右上角連線指示燈
 *  綠 = Firebase 已連線
 *  紅 = Firebase 未連線
 */
function updateConnStatus() {
  const fb = firebaseStatus();   // 'disabled' | 'connected' | 'error'

  if (fb === 'connected') {
    setConnStatus('on', 'Firebase 已連線');
  } else {
    setConnStatus('err', 'Firebase 未連線');
  }

  // 同時更新設定抽屜內的狀態框
  updateFbStatusBox(fb);
}

function updateFbStatusBox(fb) {
  const box = document.getElementById('fbStatusBox');
  if (!box) return;

  box.classList.remove('status-box--checking', 'status-box--ok', 'status-box--err');
  const txt = box.querySelector('.status-box__txt');

  if (fb === 'connected') {
    box.classList.add('status-box--ok');
    txt.textContent = '已連線到 Firestore';
  } else if (fb === 'error') {
    box.classList.add('status-box--err');
    txt.textContent = '連線失敗（已 fallback 到本機 IndexedDB）';
  } else {
    box.classList.add('status-box--err');
    txt.textContent = '未連線（檢查 Firebase 設定）';
  }
}

// ── 設定表單 ──
function initSettingsForm() {
  const keyInput   = document.getElementById('geminiKey');
  const modelSel   = document.getElementById('geminiModel');
  const saveBtn    = document.getElementById('settingsSave');
  const fbTestBtn  = document.getElementById('fbTest');

  // 載入既有設定（舊的 gemini-* 模型值自動轉新預設）
  keyInput.value = localStorage.getItem(STORAGE_KEYS.geminiKey) || '';
  const savedModel = localStorage.getItem(STORAGE_KEYS.geminiModel) || '';
  const ALLOWED_MODELS = ['gemma-4-26b-a4b-it', 'gemma-4-31b-it'];
  modelSel.value = ALLOWED_MODELS.includes(savedModel) ? savedModel : 'gemma-4-26b-a4b-it';

  // 儲存設定（只有 Google AI Key + 模型）
  saveBtn.addEventListener('click', async () => {
    localStorage.setItem(STORAGE_KEYS.geminiKey,   keyInput.value.trim());
    localStorage.setItem(STORAGE_KEYS.geminiModel, modelSel.value);

    saveBtn.textContent = '儲存中…';
    saveBtn.disabled = true;
    try {
      // 測 AI Key
      if (keyInput.value.trim()) {
        try {
          await ai.testKey();
          toast('Google AI API Key 驗證成功', 'ok');
        } catch (e) {
          toast('Google AI API Key 驗證失敗：' + e.message, 'err', 5000);
        }
      }
      renderUsagePanel();
      toast('設定已儲存', 'ok');
      document.querySelector('#settingsDrawer [data-close]').click();
    } finally {
      saveBtn.textContent = '儲存設定';
      saveBtn.disabled = false;
    }
  });

  // 重新測試 Firebase 連線
  fbTestBtn.addEventListener('click', async () => {
    const box = document.getElementById('fbStatusBox');
    box.classList.remove('status-box--ok', 'status-box--err');
    box.classList.add('status-box--checking');
    box.querySelector('.status-box__txt').textContent = '重新檢查中…';
    setConnStatus('warn', 'Firebase 連線中…');

    try {
      const r = await initFirebase();
      updateConnStatus();
      if (r.ok) toast('Firebase 連線成功 ✓', 'ok');
      else      toast('Firebase 連線失敗：' + r.reason, 'err', 5000);
    } catch (e) {
      updateConnStatus();
      toast('連線測試失敗：' + e.message, 'err', 5000);
    }
  });

  // 移除舊版的 fbConfig localStorage（避免殘留覆蓋內建）
  if (localStorage.getItem(STORAGE_KEYS.fbConfig)) {
    localStorage.removeItem(STORAGE_KEYS.fbConfig);
  }
}

// ── 用量面板渲染 ──
function renderUsagePanel() {
  const wrap = document.getElementById('usagePanel');
  if (!wrap) return;
  const all = ai.snapshotUsage();
  const current = ai.getModel();

  wrap.innerHTML = all.map(u => {
    const rpdPct = (u.rpdUsed / u.rpdLimit) * 100;
    const rpmPct = (u.rpmUsed / u.rpmLimit) * 100;
    let cls = '';
    if (rpdPct >= 95) cls = 'is-danger';
    else if (rpdPct >= 85) cls = 'is-warn';
    const isCurr = u.model === current ? 'is-current' : '';
    return `
      <div class="usage-row ${cls}">
        <div class="usage-row__head">
          <span class="usage-row__name ${isCurr}">${u.model}</span>
          <span class="usage-row__nums">RPM ${u.rpmUsed}/${u.rpmLimit} · 今日 ${u.rpdUsed}/${u.rpdLimit}</span>
        </div>
        <div class="usage-bar">
          <div class="usage-bar__rpd" style="width:${Math.min(100, rpdPct)}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

// 接近上限時警告（每次用量變化檢查）
let warnedAt85 = false;
let warnedAt95 = false;
function checkUsageWarning() {
  const all = ai.snapshotUsage();
  const current = all.find(u => u.model === ai.getModel());
  if (!current) return;
  const pct = current.rpdUsed / current.rpdLimit;
  if (pct >= 0.95 && !warnedAt95) {
    warnedAt95 = true;
    toast(`${current.model} 今日剩餘 ${current.rpdLimit - current.rpdUsed} 次，建議切換另一個模型`, 'err', 6000);
  } else if (pct >= 0.85 && !warnedAt85) {
    warnedAt85 = true;
    toast(`${current.model} 已使用 ${Math.round(pct*100)}% 今日額度，請留意`, 'warn', 5000);
  }
}

// ── 啟動 ──
window.addEventListener('DOMContentLoaded', boot);
