// ============================================================
// UI 共用工具：toast、drawer、tabs、theme、markdown
// ============================================================
import { STORAGE_KEYS } from './config.js';

/* ─── Toast ─── */
export function toast(message, type = 'ok', duration = 3000) {
  const wrap = document.getElementById('toastWrap');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.textContent = message;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    el.style.transition = 'all .25s ease';
    setTimeout(() => el.remove(), 280);
  }, duration);
}

/* ─── Tab 切換 ─── */
export function initTabs(onChange) {
  document.querySelectorAll('.tabs .tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      document.querySelectorAll('.tabs .tab').forEach(b => {
        b.classList.toggle('is-active', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      document.querySelectorAll('.panel').forEach(p => {
        p.hidden = p.id !== `panel-${target}`;
      });
      onChange?.(target);
    });
  });
}

/* ─── Segmented control ─── */
export function bindSegmented(container, selector, onChange) {
  const root = typeof container === 'string' ? document.querySelector(container) : container;
  if (!root) return;
  root.querySelectorAll(selector).forEach(btn => {
    btn.addEventListener('click', () => {
      const siblings = btn.parentElement.querySelectorAll(selector);
      siblings.forEach(b => b.classList.toggle('is-active', b === btn));
      onChange?.(btn);
    });
  });
}

/* ─── 文字朗讀（Web Speech API） ─── */
const _synth = (typeof window !== 'undefined') ? window.speechSynthesis : null;
const _ttsListeners = [];

export function ttsSupported() {
  return !!_synth;
}
export function onTtsChange(fn) { _ttsListeners.push(fn); }
function emitTts() {
  if (!_synth) return;
  const state = { speaking: _synth.speaking, paused: _synth.paused };
  _ttsListeners.forEach(f => f(state));
}

export function ttsState() {
  if (!_synth) return { speaking: false, paused: false };
  return { speaking: _synth.speaking, paused: _synth.paused };
}

/**
 * 朗讀 markdown 內容（自動 strip 標記 + 切句）
 */
export function ttsSpeak(markdown, opts = {}) {
  if (!_synth) {
    toast('此瀏覽器不支援朗讀功能', 'err');
    return;
  }
  ttsStop(); // 先取消所有

  const text = stripMarkdownForSpeech(markdown);
  const sentences = splitForSpeech(text);
  if (!sentences.length) return;

  // 嘗試挑中文女聲（如果有的話）
  const voices = _synth.getVoices();
  const preferred = voices.find(v => /zh.*TW|cmn.*Hant/i.test(v.lang)) ||
                    voices.find(v => /zh|chinese|cmn/i.test(v.lang)) ||
                    null;

  sentences.forEach((s, i) => {
    const u = new SpeechSynthesisUtterance(s);
    u.lang  = 'zh-TW';
    u.rate  = opts.rate  ?? 1.0;
    u.pitch = opts.pitch ?? 1.0;
    u.volume = opts.volume ?? 1.0;
    if (preferred) u.voice = preferred;
    // 每段結束時通知 UI（特別是最後一段，整體結束）
    u.onend = () => emitTts();
    u.onerror = (e) => { console.warn('[TTS] error:', e); emitTts(); };
    _synth.speak(u);
  });

  emitTts();

  // 開始 polling — 因為 paused/resumed 沒有可靠事件，輪詢保持 UI 同步
  startTtsPolling();
}

export function ttsPause() {
  if (_synth?.speaking && !_synth.paused) {
    _synth.pause();
    emitTts();
  }
}
export function ttsResume() {
  if (_synth?.paused) {
    _synth.resume();
    emitTts();
  }
}
export function ttsStop() {
  if (!_synth) return;
  _synth.cancel();
  stopTtsPolling();
  emitTts();
}

let _ttsPollTimer = null;
function startTtsPolling() {
  stopTtsPolling();
  let lastState = '';
  _ttsPollTimer = setInterval(() => {
    if (!_synth) return stopTtsPolling();
    const cur = `${_synth.speaking}-${_synth.paused}`;
    if (cur !== lastState) {
      lastState = cur;
      emitTts();
    }
    if (!_synth.speaking && !_synth.paused) stopTtsPolling();
  }, 250);
}
function stopTtsPolling() {
  if (_ttsPollTimer) { clearInterval(_ttsPollTimer); _ttsPollTimer = null; }
}

/** 移除 markdown 語法，避免朗讀時念出 *、#、- 等符號 */
function stripMarkdownForSpeech(md) {
  return String(md || '')
    .replace(/```[\s\S]*?```/g, '')              // code blocks
    .replace(/`([^`]+)`/g, '$1')                 // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')        // images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')     // links
    .replace(/^#+\s*/gm, '')                     // # headers
    .replace(/\*\*([^*]+)\*\*/g, '$1')           // **bold**
    .replace(/__([^_]+)__/g, '$1')               // __bold__
    .replace(/\*([^*]+)\*/g, '$1')               // *italic*
    .replace(/_([^_]+)_/g, '$1')                 // _italic_
    .replace(/^[-*+]\s+/gm, '')                  // bullets
    .replace(/^\d+\.\s+/gm, '')                  // numbered list
    .replace(/^>\s+/gm, '')                      // blockquote >
    .replace(/^---+$/gm, '')                     // hr
    .replace(/\|/g, ' ')                         // table pipes
    .replace(/[🎯📊🏆📝🔍💡⭐⚠️✓✗✅❌]/g, '')   // emoji 不念
    .replace(/\s+\n/g, '\n')
    .replace(/\n{2,}/g, '。\n')                   // 段落變句號停頓
    .trim();
}

/** 切成適合朗讀的句子（每段 < 180 字） */
function splitForSpeech(text) {
  const out = [];
  // 先依段落
  const paras = text.split(/\n+/).filter(p => p.trim());
  for (const p of paras) {
    // 段落內依句號類符號切
    const parts = p.split(/(?<=[。！？.!?；;])/);
    for (const raw of parts) {
      const s = raw.trim();
      if (!s) continue;
      if (s.length > 180) {
        // 太長還是要再切
        const subs = s.match(/.{1,150}[，、,]?/g) || [s];
        out.push(...subs.map(x => x.trim()).filter(Boolean));
      } else {
        out.push(s);
      }
    }
  }
  return out;
}

/* ─── A4 閱讀模態 ─── */
let _readerInited = false;
export function initReader() {
  if (_readerInited) return;
  _readerInited = true;
  const modal = document.getElementById('readerModal');
  if (!modal) return;

  // 關閉按鈕
  modal.querySelectorAll('[data-close]').forEach(el =>
    el.addEventListener('click', closeReader)
  );

  // ESC 關閉
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modal.hidden) closeReader();
  });

  // 列印（先停掉朗讀）
  document.getElementById('readerPrint')?.addEventListener('click', () => {
    ttsStop();
    window.print();
  });

  // 複製全文
  document.getElementById('readerCopy')?.addEventListener('click', async () => {
    const md = modal.dataset.markdown || '';
    const ok = await copyToClipboard(md);
    toast(ok ? '已複製全文' : '複製失敗', ok ? 'ok' : 'err');
  });

  // ── 朗讀控制 ──
  const ttsBtn  = document.getElementById('readerTts');
  const rateSel = document.getElementById('readerTtsRate');

  if (!ttsSupported()) {
    if (ttsBtn) ttsBtn.style.display = 'none';
    if (rateSel) rateSel.style.display = 'none';
  } else {
    // 持久化語速設定
    const savedRate = localStorage.getItem('ipas.ttsRate');
    if (savedRate && rateSel) rateSel.value = savedRate;
    rateSel?.addEventListener('change', () => {
      localStorage.setItem('ipas.ttsRate', rateSel.value);
      // 若正在播，重新從頭以新語速播放
      if (_synth?.speaking) {
        const md = modal.dataset.markdown || '';
        ttsSpeak(md, { rate: parseFloat(rateSel.value) });
      }
    });

    // 三態按鈕：未開始 → 朗讀；播放中 → 暫停；暫停中 → 繼續
    ttsBtn?.addEventListener('click', () => {
      const s = ttsState();
      if (!s.speaking && !s.paused) {
        const md = modal.dataset.markdown || '';
        ttsSpeak(md, { rate: parseFloat(rateSel?.value || '1') });
      } else if (s.speaking && !s.paused) {
        ttsPause();
      } else if (s.paused) {
        ttsResume();
      }
    });

    // 狀態同步：根據 TTS state 改變按鈕外觀
    onTtsChange(s => {
      if (!ttsBtn) return;
      ttsBtn.classList.toggle('is-speaking', s.speaking && !s.paused);
      if (!s.speaking && !s.paused) {
        ttsBtn.textContent = '🔊 朗讀';
      } else if (s.speaking && !s.paused) {
        ttsBtn.textContent = '⏸ 暫停';
      } else if (s.paused) {
        ttsBtn.textContent = '▶ 繼續';
      }
    });
  }

  // 視窗關閉前停止朗讀（避免遺留）
  window.addEventListener('beforeunload', () => ttsStop());
}

export function openReader({ title, level, markdown }) {
  initReader();
  ttsStop();   // 開新內容前先停掉舊的朗讀
  const modal = document.getElementById('readerModal');
  document.getElementById('readerTitle').textContent = title || '教材';
  document.getElementById('readerLevel').textContent = level || '';
  document.getElementById('readerContent').innerHTML = renderMarkdown(markdown || '');
  modal.dataset.markdown = markdown || '';
  modal.hidden = false;
  document.body.style.overflow = 'hidden';

  // 重置朗讀按鈕狀態
  const ttsBtn = document.getElementById('readerTts');
  if (ttsBtn) {
    ttsBtn.textContent = '🔊 朗讀';
    ttsBtn.classList.remove('is-speaking');
  }

  // 捲到最上面
  modal.querySelector('.reader__scroll')?.scrollTo({ top: 0, behavior: 'auto' });
}

export function closeReader() {
  const modal = document.getElementById('readerModal');
  if (!modal) return;
  ttsStop();   // 關閉時自動停止朗讀
  modal.hidden = true;
  document.body.style.overflow = '';
}

/* ─── 題目詳解 modal ─── */
let _qDetailInited = false;
let _qDetailState = { list: [], cursor: 0 };

export function initQDetailModal() {
  if (_qDetailInited) return;
  _qDetailInited = true;
  const modal = document.getElementById('qDetailModal');
  if (!modal) return;
  modal.querySelectorAll('[data-close]').forEach(el =>
    el.addEventListener('click', closeQDetail)
  );
  document.addEventListener('keydown', e => {
    if (modal.hidden) return;
    if (e.key === 'Escape')      closeQDetail();
    if (e.key === 'ArrowLeft')   gotoQ(-1);
    if (e.key === 'ArrowRight')  gotoQ(+1);
  });
  document.getElementById('qmPrev')?.addEventListener('click', () => gotoQ(-1));
  document.getElementById('qmNext')?.addEventListener('click', () => gotoQ(+1));
}

/**
 * 開啟題目詳解 modal
 * @param {Array} list      題目陣列（顯示同批次中可前後翻頁）
 * @param {number} cursor   起始顯示哪一題
 */
export function showQuestionDetail(list, cursor = 0) {
  initQDetailModal();
  _qDetailState.list = list;
  _qDetailState.cursor = Math.max(0, Math.min(cursor, list.length - 1));
  renderQDetail();
  const modal = document.getElementById('qDetailModal');
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeQDetail() {
  const modal = document.getElementById('qDetailModal');
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = '';
}

function gotoQ(delta) {
  const next = _qDetailState.cursor + delta;
  if (next < 0 || next >= _qDetailState.list.length) return;
  _qDetailState.cursor = next;
  renderQDetail();
}

function renderQDetail() {
  const q = _qDetailState.list[_qDetailState.cursor];
  if (!q) return;
  const letters = ['A','B','C','D'];
  const total = _qDetailState.list.length;

  const levelLabel = q.level === 'intermediate' ? '中級' : '初級';
  const subjLabel  = q.subject === 2 ? '科目二 · 生成式 AI 應用與規劃' : '科目一 · 人工智慧基礎概論';
  document.getElementById('qmLevel').textContent = levelLabel;
  document.getElementById('qmSubject').textContent = subjLabel;
  document.getElementById('qmIndex').textContent = total > 1 ? `第 ${_qDetailState.cursor + 1} 題` : '';
  document.getElementById('qmCounter').textContent = `${_qDetailState.cursor + 1} / ${total}`;

  document.getElementById('qmPrev').disabled = _qDetailState.cursor === 0;
  document.getElementById('qmNext').disabled = _qDetailState.cursor === total - 1;

  const body = document.getElementById('qmBody');
  body.innerHTML = `
    <div class="q-stem" style="margin-bottom:14px">${esc(q.question || '')}</div>
    <div class="options" style="margin-bottom:6px">
      ${q.options.map((o, i) => {
        let cls = 'option';
        if (q.answer === i) cls += ' is-correct';
        return `
          <div class="${cls}">
            <span class="option__letter">${letters[i]}</span>
            <span>${esc(o)}</span>
          </div>`;
      }).join('')}
    </div>

    ${q.explanation ? `
      <div class="qm-section">
        <h3 class="qm-section__title">📝 解析</h3>
        <p>${esc(q.explanation)}</p>
      </div>` : ''}

    ${q.optionsAnalysis?.length ? `
      <div class="qm-section">
        <h3 class="qm-section__title">🔍 選項分析</h3>
        <ul>
          ${q.optionsAnalysis.map((a, i) => `
            <li class="${q.answer === i ? 'is-correct' : ''}">
              <strong>${letters[i]}.</strong> ${esc(a)}
            </li>`).join('')}
        </ul>
      </div>` : ''}

    ${q.example ? `
      <div class="qm-section qm-section--ex">
        <h3 class="qm-section__title">💡 舉例</h3>
        <p>${esc(q.example)}</p>
      </div>` : ''}

    ${(!q.explanation && !q.optionsAnalysis?.length) ? `
      <div class="muted small" style="text-align:center;padding:24px 0">
        這題沒有存解析（可能是舊版本匯入或 AI 沒抽出）。<br>
        建議重新從原始 PDF 解析以取得詳解。
      </div>` : ''}
  `;
  // 捲到頂部
  body.scrollTo({ top: 0, behavior: 'auto' });
}

/* ─── Drawer (settings) ─── */
export function initDrawer() {
  const drawer = document.getElementById('settingsDrawer');
  const open  = () => { drawer.hidden = false; document.body.style.overflow = 'hidden'; };
  const close = () => { drawer.hidden = true;  document.body.style.overflow = ''; };
  document.getElementById('btnSettings').addEventListener('click', open);
  drawer.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', close));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !drawer.hidden) close();
  });
  return { open, close };
}

/* ─── Theme ─── */
export function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEYS.theme) || 'light';
  applyTheme(saved);
  bindSegmented('.settings-section .seg', '[data-theme]', btn => {
    applyTheme(btn.dataset.theme);
  });
  // mark active in drawer
  document.querySelectorAll('[data-theme]').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.theme === saved);
  });
}
export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEYS.theme, theme);
}

/* ─── Connection status pill ─── */
export function setConnStatus(state, txt) {
  const el = document.getElementById('connStatus');
  if (!el) return;
  el.classList.remove('conn--on', 'conn--off', 'conn--warn');
  el.classList.add(`conn--${state}`);
  el.querySelector('.conn__txt').textContent = txt;
}

/* ─── Dropzone helper ─── */
export function bindDropzone(zoneId, inputId, pickBtnId, onFile) {
  const zone  = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  const pick  = pickBtnId ? document.getElementById(pickBtnId) : null;

  zone.addEventListener('click', e => {
    // 不要把選取按鈕被擋住
    if (e.target.closest('button.link')) return;
    input.click();
  });
  pick?.addEventListener('click', e => { e.stopPropagation(); input.click(); });

  ['dragenter', 'dragover'].forEach(evt =>
    zone.addEventListener(evt, e => { e.preventDefault(); zone.classList.add('is-drag'); })
  );
  ['dragleave', 'drop'].forEach(evt =>
    zone.addEventListener(evt, e => { e.preventDefault(); zone.classList.remove('is-drag'); })
  );
  zone.addEventListener('drop', e => {
    const f = e.dataTransfer?.files?.[0];
    if (f) onFile(f);
  });
  input.addEventListener('change', e => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
    input.value = '';
  });
}

/* ─── Progress bar ─── */
export function setProgress(elId, percent, text) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.hidden = percent === null;
  if (percent === null) return;
  el.querySelector('.progress__bar > span').style.width = `${Math.max(0, Math.min(100, percent))}%`;
  if (text != null) el.querySelector('.progress__txt').textContent = text;
}

/* ─── Markdown 安全渲染 ─── */
export function renderMarkdown(md) {
  if (!window.marked || !window.DOMPurify) return md;
  const html = window.marked.parse(md, { gfm: true, breaks: true });
  return window.DOMPurify.sanitize(html);
}

/* ─── 工具：複製到剪貼簿 ─── */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.warn('Clipboard write failed', err);
    return false;
  }
}

/* ─── 工具：下載檔案 ─── */
export function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 200);
}

/* ─── 工具：簡易確認對話 ─── */
export function confirmAction(message) {
  return window.confirm(message);
}

/* ─── HTML escape ─── */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[c]));
}
