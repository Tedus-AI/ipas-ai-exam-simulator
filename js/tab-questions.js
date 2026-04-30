// ============================================================
// Tab 2：題庫建置系統
// ============================================================
import { extractText, chunkText } from './parser.js';
import { generateJSON } from './ai.js';
import {
  addQuestions, countQuestions,
  exportAll, importAll, listQuestions, deleteQuestion,
} from './store.js';
import { requireUnlock } from './security.js';
import { PROMPTS } from './config.js';
import {
  bindDropzone, setProgress, toast, bindSegmented,
  esc, downloadJSON, confirmAction,
  showQuestionDetail,
} from './ui.js';

let state = {
  level: 'junior',
  subject: 1,
  file: null,
  parsed: [],
  // 瀏覽題庫狀態
  browseLevel: 'junior',
  browseSubject: 1,
  browseQuery: '',
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

  document.getElementById('questionAnalyze').addEventListener('click', async () => {
    if (!await requireUnlock('解析考題並寫入題庫需要解鎖')) return;
    analyze();
  });

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
    if (!await requireUnlock('匯入 JSON 到資料庫需要解鎖')) {
      e.target.value = '';
      return;
    }
    try {
      const text = await f.text();
      const data = JSON.parse(text);
      const result = await importAll(data);
      toast(`匯入完成：題目 ${result.questions} 筆，教材 ${result.materials} 份`, 'ok');
      refreshStats();
      renderBrowser();
    } catch (err) { toast('匯入失敗：' + err.message, 'err'); }
    finally { e.target.value = ''; }
  });

  // 題庫瀏覽器：級別 / 科目切換
  document.querySelectorAll('[data-browse-level]').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.parentElement.querySelectorAll('[data-browse-level]').forEach(b =>
        b.classList.toggle('is-active', b === btn));
      state.browseLevel = btn.dataset.browseLevel;
      renderBrowser();
    });
  });
  document.querySelectorAll('[data-browse-subject]').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.parentElement.querySelectorAll('[data-browse-subject]').forEach(b =>
        b.classList.toggle('is-active', b === btn));
      state.browseSubject = Number(btn.dataset.browseSubject);
      renderBrowser();
    });
  });

  // 搜尋（debounced）
  let searchTimer;
  document.getElementById('qbSearch')?.addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.browseQuery = e.target.value.trim().toLowerCase();
      renderBrowser();
    }, 200);
  });

  refreshStats();
  renderBrowser();
}

export async function renderBrowser() {
  const wrap = document.getElementById('qbBrowserList');
  if (!wrap) return;
  wrap.innerHTML = `<div class="empty"><p>載入中…</p></div>`;
  try {
    const all = await listQuestions({
      level: state.browseLevel,
      subject: state.browseSubject,
    });
    let filtered = all;
    if (state.browseQuery) {
      filtered = all.filter(q =>
        q.question?.toLowerCase().includes(state.browseQuery) ||
        q.options?.some(o => o.toLowerCase().includes(state.browseQuery))
      );
    }
    if (!filtered.length) {
      wrap.innerHTML = `<div class="empty"><p>${
        state.browseQuery ? '沒有符合的題目' : '此級別/科目尚無題目，請先到上方上傳考題 PDF'
      }</p></div>`;
      return;
    }
    const letters = ['A','B','C','D'];
    wrap.innerHTML = filtered.map((q, i) => `
      <div class="qbrow-item" data-i="${i}" data-id="${esc(q.id)}">
        <div class="qbrow-item__num">${i + 1}</div>
        <div class="qbrow-item__body">
          <div class="qbrow-item__q">${esc(q.question)}</div>
          <div class="qbrow-item__meta">
            ${q.answer != null ? `<span>正解：${letters[q.answer]}</span>` : '<span>無答案</span>'}
            ${q.explanation ? '<span class="has-exp">📝 含解析</span>' : '<span class="muted">無解析</span>'}
            ${q.example ? '<span class="has-exp">💡 含舉例</span>' : ''}
          </div>
        </div>
        <button class="iconbtn iconbtn--del" data-act="del" title="刪除這題" aria-label="刪除這題">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
        <div class="qbrow-item__chev">›</div>
      </div>
    `).join('');

    wrap.querySelectorAll('.qbrow-item').forEach(el => {
      // 主體（顯示詳情）— 排除刪除按鈕的點擊
      el.addEventListener('click', e => {
        if (e.target.closest('[data-act="del"]')) return;
        const idx = Number(el.dataset.i);
        showQuestionDetail(filtered, idx);
      });
      // 刪除按鈕
      el.querySelector('[data-act="del"]').addEventListener('click', async e => {
        e.stopPropagation();
        const id = el.dataset.id;
        const q = filtered.find(x => x.id === id);
        if (!q) return;
        const preview = q.question.slice(0, 40) + (q.question.length > 40 ? '…' : '');
        if (!confirmAction(`確定刪除這題？\n\n「${preview}」`)) return;
        if (!await requireUnlock('刪除題目需要解鎖')) return;
        try {
          await deleteQuestion(id);
          toast('已刪除', 'ok');
          renderBrowser();
          refreshStats();
        } catch (err) {
          toast('刪除失敗：' + err.message, 'err');
        }
      });
    });
  } catch (e) {
    wrap.innerHTML = `<div class="empty"><p>載入失敗：${esc(e.message)}</p></div>`;
  }
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

    // 切小塊（20K 字 ≈ 5-8 題），每次呼叫快、即使失敗也只丟一小段
    const chunks = chunkText(text, 20000);
    state.parsed = [];   // 清空累積（每塊存完都會更新）
    let totalSaved = 0;

    for (let i = 0; i < chunks.length; i++) {
      const t0 = Date.now();
      const tick = setInterval(() => {
        const sec = Math.floor((Date.now() - t0) / 1000);
        setProgress('questionProgress',
          30 + (i / chunks.length) * 60,
          `AI 抽取題目 ${i+1}/${chunks.length}（已等待 ${sec} 秒…已存 ${totalSaved} 題）`);
      }, 1000);

      try {
        const j = await generateJSON(PROMPTS.questions(chunks[i], state.subject));
        clearInterval(tick);

        if (Array.isArray(j.questions) && j.questions.length) {
          // 規範化這一塊的題目
          const chunkParsed = j.questions.map(q => ({
            level: state.level,
            subject: state.subject,
            question: String(q.q || '').trim(),
            options: Array.isArray(q.o) ? q.o.slice(0, 4).map(x => String(x).trim()) : [],
            answer: typeof q.a === 'number' ? q.a : null,
            explanation: String(q.exp || '').trim(),
            optionsAnalysis: Array.isArray(q.opts)
              ? q.opts.slice(0, 4).map(x => String(x).trim())
              : [],
            example: String(q.ex || '').trim(),
          })).filter(q => q.question && q.options.length === 4);

          if (chunkParsed.length) {
            // 立即寫入題庫（這塊就先保住）
            await addQuestions(chunkParsed);
            state.parsed.push(...chunkParsed);
            totalSaved += chunkParsed.length;

            // 更新預覽 + 統計
            renderPreview();
            document.getElementById('questionCount').textContent = `${totalSaved} 題`;
            await refreshStats();
            toast(`第 ${i+1}/${chunks.length} 段已存 ${chunkParsed.length} 題`, 'ok', 2000);
          }
        }
      } catch (e) {
        clearInterval(tick);
        console.warn('chunk', i, 'failed', e);
        toast(`第 ${i+1} 段解析失敗，已跳過：${e.message}`, 'warn', 4500);
      }
    }

    if (!totalSaved) throw new Error('AI 沒有抽出任何題目，請確認檔案內容');

    setProgress('questionProgress', 100, `完成 — 共 ${totalSaved} 題`);
    toast(`全部完成！共新增 ${totalSaved} 題到題庫`, 'ok');

    // 重新整理瀏覽器
    renderBrowser();
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
  wrap.innerHTML = state.parsed.slice(0, 5).map((q, i) => `
    <div class="preview-q">
      <div class="preview-q__title">${i+1}. ${esc(q.question)}</div>
      <div class="preview-q__opts">
        ${q.options.map((o, idx) => `
          <div class="${q.answer === idx ? 'is-correct' : ''}">
            ${letters[idx]}. ${esc(o)}${q.answer === idx ? ' ✓' : ''}
          </div>
        `).join('')}
      </div>
      ${q.explanation ? `
        <details class="preview-q__exp">
          <summary>📝 解析（點開）</summary>
          <p>${esc(q.explanation)}</p>
          ${q.optionsAnalysis?.length ? `
            <ul>${q.optionsAnalysis.map((a, idx) =>
              `<li><strong>${letters[idx]}.</strong> ${esc(a)}</li>`
            ).join('')}</ul>` : ''}
          ${q.example ? `<p class="muted small">💡 ${esc(q.example)}</p>` : ''}
        </details>
      ` : ''}
    </div>
  `).join('') + (state.parsed.length > 5
    ? `<div class="muted small" style="padding:12px 0;text-align:center">… 另 ${state.parsed.length - 5} 題已寫入題庫，可到「瀏覽題庫」查看完整解析</div>` : '');
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
