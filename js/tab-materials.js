// ============================================================
// Tab 1：AI 教材助手
// ============================================================
import { extractText, chunkText } from './parser.js';
import { generate } from './ai.js';
import { saveMaterial, listMaterials, deleteMaterial } from './store.js';
import { PROMPTS } from './config.js';
import {
  bindDropzone, setProgress, toast, bindSegmented,
  renderMarkdown, copyToClipboard, esc, confirmAction,
  openReader,
} from './ui.js';
import { LEVELS } from './config.js';
import { requireUnlock } from './security.js';

let state = {
  level: 'junior',
  file: null,
  result: '',
};

export function init() {
  // 級別切換
  bindSegmented(
    '#panel-materials .panel__head .seg',
    '.seg__btn',
    btn => { state.level = btn.dataset.level; refreshList(); }
  );

  // 拖放
  bindDropzone('materialDrop', 'materialFile', 'materialPick', file => {
    state.file = file;
    document.getElementById('materialFileName').textContent = file.name;
    document.getElementById('materialAnalyze').disabled = false;
  });

  // 分析按鈕
  document.getElementById('materialAnalyze').addEventListener('click', analyze);

  // 閱讀模式
  document.getElementById('materialReader').addEventListener('click', () => {
    if (!state.result) return;
    const title = state.file?.name?.replace(/\.[^.]+$/, '') || '教材整理結果';
    openReader({
      title,
      level: LEVELS[state.level]?.label || '',
      markdown: state.result,
    });
  });

  // 複製 / 存檔
  document.getElementById('materialCopy').addEventListener('click', async () => {
    if (!state.result) return;
    const ok = await copyToClipboard(state.result);
    toast(ok ? '已複製到剪貼簿' : '複製失敗', ok ? 'ok' : 'err');
  });
  document.getElementById('materialSave').addEventListener('click', async () => {
    if (!state.result) return;
    if (!await requireUnlock('儲存教材到資料庫需要解鎖')) return;
    try {
      const title = state.file?.name?.replace(/\.[^.]+$/, '') || '未命名教材';
      await saveMaterial({ level: state.level, title, content: state.result });
      toast('已存入教材庫', 'ok');
      refreshList();
    } catch (e) { toast('儲存失敗：' + e.message, 'err'); }
  });

  // 重新載入
  document.getElementById('materialRefresh').addEventListener('click', refreshList);

  refreshList();
}

async function analyze() {
  if (!state.file) return;
  const btn = document.getElementById('materialAnalyze');
  btn.disabled = true;

  try {
    setProgress('materialProgress', 5, '解析檔案內容…');
    const text = await extractText(state.file, (p, msg) =>
      setProgress('materialProgress', p * 0.4, msg)
    );

    if (!text || text.length < 100) {
      throw new Error('檔案內容太少，無法整理（請確認 PDF 不是純圖片掃描）');
    }

    const chunks = chunkText(text, 70000);
    const partials = [];

    for (let i = 0; i < chunks.length; i++) {
      const t0 = Date.now();
      const basePct = 40 + (i / chunks.length) * 55;

      const tick = setInterval(() => {
        const sec = Math.floor((Date.now() - t0) / 1000);
        setProgress('materialProgress', basePct,
          `AI 整理中 ${i+1}/${chunks.length}（已等待 ${sec} 秒，thinking + 搜尋通常需 1-3 分鐘）`);
      }, 1000);

      try {
        const out = await generate(PROMPTS.material(chunks[i], state.level), {
          temperature: 0.3,
          maxOutputTokens: 8192,
          // 預設 10 分鐘 timeout 已足夠
        });
        partials.push(out);
      } finally {
        clearInterval(tick);
      }
    }

    state.result = partials.join('\n\n---\n\n');
    setProgress('materialProgress', 100, '完成');

    document.getElementById('materialResult').innerHTML =
      `<div class="md">${renderMarkdown(state.result)}</div>`;
    document.getElementById('materialCopy').disabled = false;
    document.getElementById('materialSave').disabled = false;
    document.getElementById('materialReader').disabled = false;
    toast('整理完成！按「閱讀模式」可全螢幕檢視', 'ok');

  } catch (e) {
    setProgress('materialProgress', null);
    toast('整理失敗：' + e.message, 'err', 5000);
  } finally {
    btn.disabled = false;
    setTimeout(() => setProgress('materialProgress', null), 1200);
  }
}

export async function refreshList() {
  const wrap = document.getElementById('materialList');
  try {
    const items = await listMaterials(state.level);
    if (!items.length) {
      wrap.innerHTML = `<div class="empty"><p>尚未有任何教材紀錄。</p></div>`;
      return;
    }
    wrap.innerHTML = items.map(m => `
      <div class="list-item" data-id="${esc(m.id)}">
        <div>
          <div class="list-item__title">${esc(m.title)}</div>
          <div class="list-item__meta">${formatDate(m.createdAt)} · ${m.content.length} 字</div>
        </div>
        <div class="row" style="gap:6px">
          <button class="btn btn--ghost btn--sm" data-act="view">檢視</button>
          <button class="btn btn--ghost btn--sm btn--danger" data-act="del">刪除</button>
        </div>
      </div>
    `).join('');

    wrap.querySelectorAll('.list-item').forEach(el => {
      const id = el.dataset.id;
      const item = items.find(x => x.id === id);
      el.querySelector('[data-act="view"]').addEventListener('click', () => {
        // 開全螢幕 A4 閱讀視窗
        openReader({
          title: item.title,
          level: LEVELS[item.level]?.label || '',
          markdown: item.content,
        });
      });
      el.querySelector('[data-act="del"]').addEventListener('click', async () => {
        if (!confirmAction(`確定刪除「${item.title}」？`)) return;
        if (!await requireUnlock('刪除教材需要解鎖')) return;
        await deleteMaterial(id);
        toast('已刪除', 'ok');
        refreshList();
      });
    });
  } catch (e) {
    wrap.innerHTML = `<div class="empty"><p>載入失敗：${esc(e.message)}</p></div>`;
  }
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleString('zh-TW', { hour12: false });
}
