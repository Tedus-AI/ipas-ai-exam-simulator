// ============================================================
// Tab 2：題庫建置系統
// ============================================================
import { extractText, chunkText } from './parser.js';
import { generateJSON } from './ai.js';
import {
  addQuestions, countQuestions, clearAllQuestions,
  exportAll, importAll
} from './store.js';
import { PROMPTS } from './config.js';
import {
  bindDropzone, setProgress, toast, bindSegmented,
  esc, downloadJSON, confirmAction
} from './ui.js';

let state = {
  level: 'junior',
  subject: 1,
  file: null,
  parsed: [],
};

export function init() {
  bindSegmented(
    '#panel-questions .panel__head .seg',
    '.seg__btn',
    btn => { state.level = btn.dataset.qLevel; }
  );
  bindSegmented(
    '#panel-questions .seg--mini',
    '.seg__btn',
    btn => { state.subject = Number(btn.dataset.subject); }
  );

  bindDropzone('questionDrop', 'questionFile', 'questionPick', file => {
    state.file = file;
    document.getElementById('questionFileName').textContent = file.name;
    document.getElementById('questionAnalyze').disabled = false;
  });

  document.getElementById('questionAnalyze').addEventListener('click', analyze);

  // 題庫管理
  document.getElementById('qbExport').addEventListener('click', async () => {
    try {
      const data = await exportAll();
      downloadJSON(data, `ipas-backup-${Date.now()}.json`);
      toast('已匯出 JSON', 'ok');
    } catch (e) { toast('匯出失敗：' + e.message, 'err'); }
  });

  document.getElementById('qbImport').addEventListener('click', () => {
    document.getElementById('qbImportFile').click();
  });
  document.getElementById('qbImportFile').addEventListener('change', async e => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      const data = JSON.parse(text);
      const result = await importAll(data);
      toast(`匯入完成：題目 ${result.questions} 筆，教材 ${result.materials} 份`, 'ok');
      refreshStats();
    } catch (err) { toast('匯入失敗：' + err.message, 'err'); }
    finally { e.target.value = ''; }
  });

  document.getElementById('qbClear').addEventListener('click', async () => {
    if (!confirmAction('確定清空所有題庫？此動作無法復原。')) return;
    await clearAllQuestions();
    toast('題庫已清空', 'ok');
    refreshStats();
  });

  refreshStats();
}

async function analyze() {
  if (!state.file) return;
  const btn = document.getElementById('questionAnalyze');
  btn.disabled = true;

  try {
    setProgress('questionProgress', 5, '解析檔案內容…');
    const text = await extractText(state.file, (p, msg) =>
      setProgress('questionProgress', p * 0.3, msg)
    );

    const chunks = chunkText(text, 60000);
    const all = [];

    for (let i = 0; i < chunks.length; i++) {
      setProgress('questionProgress', 30 + (i / chunks.length) * 60,
        `AI 抽取題目（${i+1} / ${chunks.length}）…`);
      try {
        const j = await generateJSON(PROMPTS.questions(chunks[i], state.subject));
        if (Array.isArray(j.questions)) all.push(...j.questions);
      } catch (e) {
        console.warn('chunk', i, 'failed', e);
        toast(`第 ${i+1} 段解析失敗，已跳過：${e.message}`, 'warn', 4000);
      }
    }

    if (!all.length) throw new Error('AI 沒有抽出任何題目，請確認檔案內容');

    // 規範化 + 顯示
    state.parsed = all.map(q => ({
      level: state.level,
      subject: state.subject,
      question: String(q.q || '').trim(),
      options: Array.isArray(q.o) ? q.o.slice(0, 4).map(x => String(x).trim()) : [],
      answer: typeof q.a === 'number' ? q.a : null,
    })).filter(q => q.question && q.options.length === 4);

    setProgress('questionProgress', 92, `寫入題庫（${state.parsed.length} 題）…`);
    const n = await addQuestions(state.parsed);
    setProgress('questionProgress', 100, '完成');

    renderPreview();
    document.getElementById('questionCount').textContent = `${n} 題`;
    toast(`成功新增 ${n} 題到題庫`, 'ok');
    refreshStats();
  } catch (e) {
    toast('解析失敗：' + e.message, 'err', 5000);
  } finally {
    btn.disabled = false;
    setTimeout(() => setProgress('questionProgress', null), 1500);
  }
}

function renderPreview() {
  const wrap = document.getElementById('questionPreview');
  if (!state.parsed.length) {
    wrap.innerHTML = `<div class="empty"><p>尚無解析結果，請先上傳檔案。</p></div>`;
    return;
  }
  const letters = ['A','B','C','D'];
  wrap.innerHTML = state.parsed.slice(0, 10).map((q, i) => `
    <div style="padding:14px 0;border-bottom:1px solid var(--line)">
      <div style="font-weight:500;margin-bottom:8px">${i+1}. ${esc(q.question)}</div>
      <div style="display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--ink-2)">
        ${q.options.map((o, idx) => `
          <div style="${q.answer === idx ? 'color:var(--success);font-weight:500' : ''}">
            ${letters[idx]}. ${esc(o)} ${q.answer === idx ? ' ✓' : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `).join('') + (state.parsed.length > 10
    ? `<div class="muted small" style="padding:12px 0;text-align:center">… 另 ${state.parsed.length - 10} 題已寫入題庫</div>` : '');
}

export async function refreshStats() {
  try {
    const c = await countQuestions();
    document.getElementById('statJunior1').textContent = c['junior:1'] || 0;
    document.getElementById('statJunior2').textContent = c['junior:2'] || 0;
    document.getElementById('statInter1').textContent  = c['intermediate:1'] || 0;
    document.getElementById('statInter2').textContent  = c['intermediate:2'] || 0;
  } catch (e) { console.warn(e); }
}
