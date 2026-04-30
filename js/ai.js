// ============================================================
// Google AI Studio API 封裝（Gemma 系列）— BYOK
// 文件：https://ai.google.dev/api/rest/v1beta/models/generateContent
// ============================================================
import { STORAGE_KEYS } from './config.js';
import { waitForSlot, recordCall, uncountCall, getUsage } from './rateLimit.js';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const ALLOWED_MODELS = ['gemma-4-26b-a4b-it', 'gemma-4-31b-it'];
const DEFAULT_MODEL  = 'gemma-4-26b-a4b-it';

const MODEL_DEFAULTS = { temperature: 1, topP: 0.95, topK: 64 };

function getKey() {
  return localStorage.getItem(STORAGE_KEYS.geminiKey) || '';
}
export function getModel() {
  const stored = localStorage.getItem(STORAGE_KEYS.geminiModel) || '';
  if (ALLOWED_MODELS.includes(stored)) return stored;
  return DEFAULT_MODEL;
}
export function getAllowedModels() {
  return [...ALLOWED_MODELS];
}
export function isConfigured() {
  return !!getKey();
}

// 監聽器：rate limit 等待中、用量更新時通知 UI
const listeners = { wait: [], usage: [] };
export function onRateWait(fn)  { listeners.wait.push(fn); }
export function onUsageChange(fn) { listeners.usage.push(fn); }
function emitWait(ms, model)    { listeners.wait.forEach(f => f(ms, model)); }
function emitUsage()             { listeners.usage.forEach(f => f()); }

/**
 * 通用 generateContent 呼叫
 * @param {string} prompt
 * @param {Object} opts
 *   - temperature, maxOutputTokens, topP, topK
 *   - json         (bool) 要求 JSON 輸出（自動關 thinking + tools）
 *   - thinking     (bool) 啟用 Thinking HIGH，預設 true（除 json）
 *   - googleSearch (bool) 啟用 Google Search，預設 true（除 json）
 *   - retry        (number) 429 時自動重試次數，預設 2
 */
export async function generate(prompt, opts = {}) {
  const key = getKey();
  if (!key) throw new Error('尚未設定 Google AI API Key，請先在右上角「設定」中填入。');

  const model = getModel();

  // 等待 RPM slot（必要時延遲）
  await waitForSlot(model, ms => emitWait(ms, model));

  const useJson     = !!opts.json;
  const useThinking = !useJson && (opts.thinking !== false);
  const useSearch   = !useJson && (opts.googleSearch !== false);

  const generationConfig = {
    temperature:     opts.temperature     ?? (useJson ? 0.2 : 0.4),
    topP:            opts.topP            ?? MODEL_DEFAULTS.topP,
    topK:            opts.topK            ?? MODEL_DEFAULTS.topK,
    maxOutputTokens: opts.maxOutputTokens ?? 8192,
  };
  // 註：Gemma 不支援 responseMimeType: 'application/json'，
  // 改用 prompt 強制要求 JSON + parseJsonLoose 寬鬆解析
  if (useThinking) generationConfig.thinkingConfig = { thinkingLevel: 'HIGH' };

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig,
  };
  if (useSearch) body.tools = [{ googleSearch: {} }];

  const url = `${API_BASE}/${model}:generateContent?key=${encodeURIComponent(key)}`;

  // 先扣，失敗會 uncount
  recordCall(model);
  emitUsage();

  // ── 超時保護（避免網路斷掉時無限掛著），預設 10 分鐘 ──
  // Gemma + thinking HIGH + Google Search + 大量輸出可能超過 5 分鐘
  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs ?? 600_000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  console.log(`[AI] 發送請求：model=${model}, json=${useJson}, thinking=${useThinking}, search=${useSearch}, prompt 長度=${prompt.length}`);
  const t0 = Date.now();

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    console.log(`[AI] 收到回應：${res.status} ${res.statusText}（耗時 ${Date.now() - t0}ms）`);
  } catch (e) {
    clearTimeout(timeoutId);
    uncountCall(model);
    emitUsage();
    if (e.name === 'AbortError') {
      console.error(`[AI] 超時（${timeoutMs}ms 未回應）`);
      throw new Error(`AI 超時（${timeoutMs/1000} 秒未回應），請重試或縮短輸入內容`);
    }
    console.error('[AI] 網路錯誤：', e);
    throw new Error('網路錯誤：' + e.message);
  }

  if (!res.ok) {
    const errText = await res.text();
    console.error('[AI] API 錯誤回應：', errText);
    let msg = `Google AI API 失敗 (${res.status})`;
    try {
      const j = JSON.parse(errText);
      msg = j.error?.message || msg;
    } catch {}

    // 429 自動退避重試
    if (res.status === 429 && (opts.retry ?? 2) > 0) {
      uncountCall(model);
      emitUsage();
      const waitMs = parseRetryDelay(errText) || 30_000; // 預設等 30 秒
      emitWait(waitMs, model);
      await new Promise(r => setTimeout(r, waitMs));
      return await generate(prompt, { ...opts, retry: (opts.retry ?? 2) - 1 });
    }

    uncountCall(model);
    emitUsage();

    if (res.status === 429) msg += '（達到頻率/額度限制）';
    if (res.status === 403) msg += '（API Key 無效或未啟用 Generative Language API）';
    throw new Error(msg);
  }

  const json = await res.json();
  // 過濾 thinking parts
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  const text = parts.filter(p => !p.thought).map(p => p.text || '').join('').trim();

  if (!text) {
    const finishReason = json.candidates?.[0]?.finishReason;
    if (finishReason === 'SAFETY')     throw new Error('AI 回應被安全過濾擋下，請改寫提問');
    if (finishReason === 'MAX_TOKENS') throw new Error('AI 輸出超過上限被截斷，請縮短輸入或換較大模型');
    throw new Error(`AI 沒有回傳內容（finishReason: ${finishReason || 'unknown'}）`);
  }
  return text;
}

// 從 429 錯誤訊息解析 retry-after 秒數
function parseRetryDelay(errText) {
  try {
    const j = JSON.parse(errText);
    const details = j.error?.details || [];
    for (const d of details) {
      if (d['@type']?.includes('RetryInfo') && d.retryDelay) {
        const m = String(d.retryDelay).match(/^(\d+(?:\.\d+)?)s$/);
        if (m) return Math.ceil(Number(m[1]) * 1000);
      }
    }
  } catch {}
  return 0;
}

/**
 * 請 AI 回 JSON
 * @param {string} prompt
 * @param {Object} opts  覆蓋預設（如 maxOutputTokens）
 */
export async function generateJSON(prompt, opts = {}) {
  const raw = await generate(prompt, {
    json: true,
    temperature: 0.2,
    maxOutputTokens: 32768,   // 容納題目 + 詳解（每題可達 800-1200 tokens）
    ...opts,
  });
  return parseJsonLoose(raw);
}

function parseJsonLoose(text) {
  try { return JSON.parse(text); } catch {}
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); }
    catch (e) { throw new Error('AI 回傳的 JSON 格式異常：' + e.message); }
  }
  throw new Error('AI 沒有回傳有效的 JSON');
}

/**
 * 測試金鑰：發極輕量請求，不啟用 thinking/search
 */
export async function testKey() {
  return await generate('回答「ok」兩個字即可。', {
    maxOutputTokens: 16,
    temperature: 0,
    thinking: false,
    googleSearch: false,
    retry: 0,
  });
}

// 給 UI 用
export function snapshotUsage() {
  return ALLOWED_MODELS.map(getUsage);
}
