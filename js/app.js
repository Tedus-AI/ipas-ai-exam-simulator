// ============================================================
// 主入口：初始化、設定、Tab 切換
// ============================================================
import { STORAGE_KEYS } from './config.js';
import {
  toast, initTabs, initDrawer, initTheme,
  setConnStatus,
} from './ui.js';
import { initFirebase, firebaseStatus } from './store.js';
import * as ai from './ai.js';
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

  // 嘗試初始化 Firebase
  await initFirebase();
  updateConnStatus();

  // 第一次使用時提示設定 API Key
  if (!ai.isConfigured()) {
    setTimeout(() => {
      toast('請先到右上角「設定」填入 Gemini API Key', 'warn', 5000);
      document.getElementById('btnSettings').click();
    }, 400);
  }
}

function updateConnStatus() {
  const hasAI = ai.isConfigured();
  const fb    = firebaseStatus();   // 'disabled' | 'connected' | 'error'

  if (!hasAI) {
    setConnStatus('off', '請設定 API Key');
    return;
  }
  if (fb === 'connected') {
    setConnStatus('on', 'AI + Firebase');
  } else if (fb === 'error') {
    setConnStatus('warn', 'AI 已連線（Firebase 失敗，本機儲存）');
  } else {
    setConnStatus('warn', 'AI 已連線（本機儲存）');
  }
}

// ── 設定表單 ──
function initSettingsForm() {
  const keyInput   = document.getElementById('geminiKey');
  const modelSel   = document.getElementById('geminiModel');
  const fbInput    = document.getElementById('fbConfig');
  const saveBtn    = document.getElementById('settingsSave');
  const fbTestBtn  = document.getElementById('fbTest');
  const fbResetBtn = document.getElementById('fbReset');

  // 載入既有設定
  keyInput.value = localStorage.getItem(STORAGE_KEYS.geminiKey) || '';
  modelSel.value = localStorage.getItem(STORAGE_KEYS.geminiModel) || 'gemini-2.5-flash';
  fbInput.value  = localStorage.getItem(STORAGE_KEYS.fbConfig) || '';

  saveBtn.addEventListener('click', async () => {
    localStorage.setItem(STORAGE_KEYS.geminiKey,   keyInput.value.trim());
    localStorage.setItem(STORAGE_KEYS.geminiModel, modelSel.value);

    const fbVal = fbInput.value.trim();
    if (fbVal) {
      try {
        JSON.parse(fbVal);
        localStorage.setItem(STORAGE_KEYS.fbConfig, fbVal);
      } catch {
        toast('Firebase 設定不是合法 JSON，已略過儲存', 'err');
        return;
      }
    } else {
      localStorage.removeItem(STORAGE_KEYS.fbConfig);
    }

    saveBtn.textContent = '儲存中…';
    saveBtn.disabled = true;
    try {
      // 重新初始化 Firebase
      await initFirebase();

      // 測 AI Key（背景，不阻塞）
      if (keyInput.value.trim()) {
        try { await ai.testKey(); toast('Gemini Key 驗證成功', 'ok'); }
        catch (e) { toast('Gemini Key 驗證失敗：' + e.message, 'err', 5000); }
      }

      updateConnStatus();
      toast('設定已儲存', 'ok');
      document.querySelector('#settingsDrawer [data-close]').click();
    } finally {
      saveBtn.textContent = '儲存設定';
      saveBtn.disabled = false;
    }
  });

  fbTestBtn.addEventListener('click', async () => {
    const val = fbInput.value.trim();
    if (!val) { toast('請先貼上 Firebase Config', 'warn'); return; }
    try {
      JSON.parse(val);
      localStorage.setItem(STORAGE_KEYS.fbConfig, val);
      const r = await initFirebase();
      if (r.ok) { toast('Firebase 連線成功 ✓', 'ok'); }
      else      { toast('連線失敗：' + r.reason, 'err', 5000); }
      updateConnStatus();
    } catch (e) {
      toast('Firebase Config 不是合法 JSON', 'err');
    }
  });

  fbResetBtn.addEventListener('click', () => {
    fbInput.value = '';
    localStorage.removeItem(STORAGE_KEYS.fbConfig);
    toast('已清除 Firebase 設定（重新整理頁面後生效）', 'ok');
  });
}

// ── 啟動 ──
window.addEventListener('DOMContentLoaded', boot);
