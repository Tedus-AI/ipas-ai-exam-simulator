// ============================================================
// Gemini API（AI Studio）封裝 — BYOK
// 文件：https://ai.google.dev/api/rest/v1beta/models/generateContent
// ============================================================
import { STORAGE_KEYS } from './config.js';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

function getKey() {
  return localStorage.getItem(STORAGE_KEYS.geminiKey) || '';
}
function getModel() {
  return localStorage.getItem(STORAGE_KEYS.geminiModel) || 'gemini-2.5-flash';
}

export function isConfigured() {
  return !!getKey();
}

/**
 * 通用 generateContent 呼叫
 * @param {string} prompt
 * @param {Object} opts { temperature, maxOutputTokens, json }
 */
export async function generate(prompt, opts = {}) {
  const key = getKey();
  if (!key) throw new Error('尚未設定 Gemini API Key，請先在右上角「設定」中填入。');

  const model = getModel();
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0.4,
      maxOutputTokens: opts.maxOutputTokens ?? 8192,
      ...(opts.json ? { responseMimeType: 'application/json' } : {}),
    },
  };

  const url = `${API_BASE}/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    let msg = `Gemini API 失敗 (${res.status})`;
    try {
      const j = JSON.parse(errText);
      msg = j.error?.message || msg;
    } catch {}
    throw new Error(msg);
  }

  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n') ?? '';
  if (!text) throw new Error('AI 沒有回傳內容（可能被安全過濾或 token 不足）');
  return text;
}

/**
 * 請 AI 回 JSON，若失敗會嘗試從文字中擷取 JSON
 */
export async function generateJSON(prompt) {
  const raw = await generate(prompt, { json: true, temperature: 0.2, maxOutputTokens: 16384 });
  return parseJsonLoose(raw);
}

function parseJsonLoose(text) {
  // 1. 直接試
  try { return JSON.parse(text); } catch {}
  // 2. 去除 ```json / ``` 包裝
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
  try { return JSON.parse(cleaned); } catch {}
  // 3. 抓第一個 { … } 區塊
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch (e) {
      throw new Error('AI 回傳的 JSON 格式異常：' + e.message);
    }
  }
  throw new Error('AI 沒有回傳有效的 JSON');
}

/**
 * 測試金鑰
 */
export async function testKey() {
  return await generate('回答「ok」兩個字即可。', { maxOutputTokens: 16, temperature: 0 });
}
