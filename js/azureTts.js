// ============================================================
// Azure Speech TTS（神經語音）
// 文件：https://learn.microsoft.com/azure/ai-services/speech-service/rest-text-to-speech
// 免費版 F0：50 萬字元/月
// ============================================================
import { STORAGE_KEYS } from './config.js';

/* ───── BYOK 設定讀取 ───── */
function getKey()    { return localStorage.getItem(STORAGE_KEYS.azureKey)    || ''; }
function getRegion() { return localStorage.getItem(STORAGE_KEYS.azureRegion) || 'eastasia'; }
function getVoice()  { return localStorage.getItem(STORAGE_KEYS.azureVoice)  || 'zh-TW-HsiaoChenNeural'; }

export function isConfigured() {
  return !!getKey();
}

/* ───── 對外狀態 ───── */
const listeners = [];
export function onAzureTtsChange(fn) { listeners.push(fn); }

let _state = 'idle';   // 'idle' | 'loading' | 'playing' | 'paused'
let _audio = null;
let _queue = [];       // [{ url, ready }]
let _index = 0;
let _abortController = null;

function setState(s) {
  if (_state === s) return;
  _state = s;
  listeners.forEach(f => f({ state: _state }));
}
export function azureState() { return { state: _state }; }

/* ───── 主要 API ───── */

/** 朗讀 markdown 內容（自動 strip + 切段 + 預先合成） */
export async function azureSpeak(markdown, opts = {}) {
  azureStop();

  const key    = getKey();
  const region = getRegion();
  const voice  = opts.voice ?? getVoice();
  const rate   = opts.rate  ?? 1.0;
  if (!key) throw new Error('未設定 Azure 金鑰');

  const text = stripMarkdown(markdown);
  const segments = splitForAzure(text);
  if (!segments.length) return;

  setState('loading');
  _abortController = new AbortController();

  // 先合成第一段，邊播邊預載後面
  try {
    _queue = segments.map(() => ({ url: null, error: null, ready: false }));
    _index = 0;

    // 第一段同步等
    const firstBlob = await synthesize(segments[0], { voice, rate, key, region, signal: _abortController.signal });
    _queue[0] = { url: URL.createObjectURL(firstBlob), error: null, ready: true };

    // 第 2 段以後背景並行（最多同時 3 個避免 burst）
    prefetchRest(segments, { voice, rate, key, region }, 3);

    playFromQueue();
  } catch (e) {
    azureStop();
    if (e.name !== 'AbortError') throw e;
  }
}

async function prefetchRest(segments, params, concurrency) {
  let next = 1;
  const workers = Array.from({ length: concurrency }, async () => {
    while (next < segments.length && _abortController && !_abortController.signal.aborted) {
      const i = next++;
      try {
        const blob = await synthesize(segments[i], { ...params, signal: _abortController.signal });
        _queue[i] = { url: URL.createObjectURL(blob), error: null, ready: true };
      } catch (e) {
        if (e.name === 'AbortError') return;
        console.warn('Azure TTS chunk', i, 'failed:', e);
        _queue[i] = { url: null, error: e.message, ready: true };
      }
    }
  });
  Promise.all(workers).catch(() => {});
}

function playFromQueue() {
  if (_index >= _queue.length) {
    setState('idle');
    return;
  }
  const item = _queue[_index];
  if (!item) {
    setTimeout(playFromQueue, 200);
    return;
  }
  if (!item.ready) {
    // 還沒合成好，等等再來
    setState('loading');
    setTimeout(playFromQueue, 250);
    return;
  }
  if (item.error || !item.url) {
    // 這段失敗 → 跳過
    _index++;
    return playFromQueue();
  }

  _audio = new Audio(item.url);
  _audio.onended = () => {
    URL.revokeObjectURL(item.url);
    item.url = null;
    _index++;
    playFromQueue();
  };
  _audio.onerror = () => {
    console.warn('Audio playback error');
    _index++;
    playFromQueue();
  };
  _audio.onplay = () => setState('playing');
  _audio.play().catch(e => {
    console.warn('audio.play 失敗', e);
    setState('idle');
  });
}

export function azurePause() {
  if (_state === 'playing' && _audio) {
    _audio.pause();
    setState('paused');
  }
}

export function azureResume() {
  if (_state === 'paused' && _audio) {
    _audio.play().then(() => setState('playing')).catch(() => {});
  }
}

export function azureStop() {
  if (_abortController) { _abortController.abort(); _abortController = null; }
  if (_audio) {
    _audio.pause();
    _audio.onended = null;
    _audio.onerror = null;
    _audio.src = '';
    _audio = null;
  }
  // 清掉所有 blob URL
  _queue.forEach(it => { if (it?.url) URL.revokeObjectURL(it.url); });
  _queue = [];
  _index = 0;
  setState('idle');
}

/* ───── 測試金鑰 ───── */
export async function testAzureKey() {
  const key = getKey();
  const region = getRegion();
  if (!key) throw new Error('未填金鑰');
  const blob = await synthesize('連線測試成功', {
    voice: getVoice(), rate: 1, key, region,
  });
  return blob.size > 0;
}

/* ───── REST API 呼叫 ───── */
async function synthesize(text, { voice, rate = 1, key, region, signal }) {
  const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const ratePct = Math.round((rate - 1) * 100);
  const ratePart = ratePct === 0 ? '' : ` rate="${ratePct >= 0 ? '+' : ''}${ratePct}%"`;
  const ssml = `<speak version='1.0' xml:lang='zh-TW' xmlns:mstts='https://www.w3.org/2001/mstts'>
<voice name='${voice}'>${ratePart ? `<prosody${ratePart}>` : ''}${escapeXml(text)}${ratePart ? '</prosody>' : ''}</voice>
</speak>`;

  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'ipas-exam-sim',
    },
    body: ssml,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Azure TTS ${res.status}：${err.slice(0, 200)}`);
  }
  return await res.blob();
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/* ───── 文字處理 ───── */
function stripMarkdown(md) {
  return String(md || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/^---+$/gm, '')
    .replace(/\|/g, ' ')
    .replace(/[🎯📊🏆📝🔍💡⭐⚠️✓✗✅❌]/g, '')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{2,}/g, '。\n')
    .trim();
}

// Azure 單請求音訊上限 10 分鐘 ≈ 約 3000 字
function splitForAzure(text) {
  const out = [];
  const max = 2500;
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + max, text.length);
    if (end < text.length) {
      // 切在句號類符號
      const back = Math.max(
        text.lastIndexOf('。', end),
        text.lastIndexOf('！', end),
        text.lastIndexOf('？', end),
        text.lastIndexOf('.', end),
        text.lastIndexOf('\n', end),
      );
      if (back > i + max * 0.4) end = back + 1;
    }
    const seg = text.slice(i, end).trim();
    if (seg) out.push(seg);
    i = end;
  }
  return out;
}
