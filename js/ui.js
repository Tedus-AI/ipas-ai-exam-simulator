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

  // 列印
  document.getElementById('readerPrint')?.addEventListener('click', () => window.print());

  // 複製全文
  document.getElementById('readerCopy')?.addEventListener('click', async () => {
    const md = modal.dataset.markdown || '';
    const ok = await copyToClipboard(md);
    toast(ok ? '已複製全文' : '複製失敗', ok ? 'ok' : 'err');
  });
}

export function openReader({ title, level, markdown }) {
  initReader();
  const modal = document.getElementById('readerModal');
  document.getElementById('readerTitle').textContent = title || '教材';
  document.getElementById('readerLevel').textContent = level || '';
  document.getElementById('readerContent').innerHTML = renderMarkdown(markdown || '');
  modal.dataset.markdown = markdown || '';
  modal.hidden = false;
  document.body.style.overflow = 'hidden';

  // 捲到最上面
  modal.querySelector('.reader__scroll')?.scrollTo({ top: 0, behavior: 'auto' });
}

export function closeReader() {
  const modal = document.getElementById('readerModal');
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = '';
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
