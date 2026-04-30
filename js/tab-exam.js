// ============================================================
// Tab 3：模擬出題與測驗
// ============================================================
import { listQuestions } from './store.js';
import { LEVELS, SUBJECTS, AI_PORTALS, PASS_RULE } from './config.js';
import { toast, esc, copyToClipboard, confirmAction, showQuestionDetail } from './ui.js';

let state = {
  level: 'junior',
  perSubject: 50,
  mode: 'exam',
  // running:
  questions: [],         // 抽到的題目（含 subject）
  answers:   [],         // index 對應 user 選項，未答為 null
  cursor:    0,
};

export function init() {
  // 級別與模式：直接綁在 button 上
  bindSegByAttr('#examSetup', 'data-e-level', val => { state.level = val; });
  bindSegByAttr('#examSetup', 'data-mode',     val => { state.mode  = val; });
  document.getElementById('examPerSubject').addEventListener('change', e => {
    state.perSubject = Math.max(1, Math.min(100, Number(e.target.value) || 50));
  });
  document.getElementById('examStart').addEventListener('click', startExam);

  // 進行中
  document.getElementById('examPrev').addEventListener('click', () => goto(state.cursor - 1));
  document.getElementById('examNext').addEventListener('click', () => goto(state.cursor + 1));
  document.getElementById('examSubmit').addEventListener('click', submitExam);
  document.getElementById('examReview').addEventListener('click', showQuestionGrid);

  // 回到設定（中途放棄）
  document.getElementById('examBackToSetup').addEventListener('click', () => {
    const answered = state.answers.filter(x => x != null).length;
    if (answered > 0 && !confirmAction(`已作答 ${answered} 題，確定放棄並回到設定頁？此次作答不會儲存。`)) {
      return;
    }
    backToSetup();
  });
}

function backToSetup() {
  document.getElementById('examRun').hidden = true;
  document.getElementById('examResult').hidden = true;
  document.getElementById('examSetup').hidden = false;
  // 清空題目導覽（如果還顯示著）
  document.getElementById('examGridWrap')?.remove();
  state.questions = [];
  state.answers = [];
  state.cursor = 0;
}

async function startExam() {
  try {
    // 抽題：每科 perSubject 題（不夠就全選）
    const subj1 = await listQuestions({ level: state.level, subject: 1 });
    const subj2 = await listQuestions({ level: state.level, subject: 2 });

    if (subj1.length === 0 && subj2.length === 0) {
      toast('題庫是空的，請先到「題庫建置」匯入題目', 'warn', 4500);
      return;
    }

    const pick = (arr, n) => shuffle(arr).slice(0, Math.min(n, arr.length));
    const q1 = pick(subj1, state.perSubject);
    const q2 = pick(subj2, state.perSubject);

    state.questions = [...q1, ...q2];
    state.answers   = state.questions.map(() => null);
    state.cursor    = 0;

    document.getElementById('examSetup').hidden = true;
    document.getElementById('examRun').hidden = false;
    document.getElementById('examResult').hidden = true;

    document.getElementById('examLevelChip').textContent = LEVELS[state.level].label;
    renderQuestion();
  } catch (e) {
    toast('開始失敗：' + e.message, 'err');
  }
}

// 通用 segmented helper：把 [data-attr] 的兄弟按鈕綁成 seg
function bindSegByAttr(scopeSel, attr, onChange) {
  const buttons = document.querySelectorAll(`${scopeSel} [${attr}]`);
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      btn.parentElement.querySelectorAll(`[${attr}]`).forEach(b => {
        b.classList.toggle('is-active', b === btn);
      });
      const key = attr.replace(/^data-/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      onChange(btn.dataset[key]);
    });
  });
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function renderQuestion() {
  const q = state.questions[state.cursor];
  if (!q) return;
  const total = state.questions.length;

  document.getElementById('examSubjChip').textContent = SUBJECTS[q.subject]?.label || `科目 ${q.subject}`;
  document.getElementById('examProgressTxt').textContent = `第 ${state.cursor + 1} / ${total} 題`;
  updateAnsweredCount();

  const letters = ['A','B','C','D'];
  const userAns = state.answers[state.cursor];
  const showAns = state.mode === 'practice' && userAns != null;

  const card = document.getElementById('examQuestionCard');
  card.innerHTML = `
    <div class="q-stem">
      <span class="q-num">${state.cursor + 1}</span>${esc(q.question)}
    </div>
    <div class="options">
      ${q.options.map((opt, idx) => {
        let cls = 'option';
        if (userAns === idx && !showAns) cls += ' is-selected';
        if (showAns) {
          if (idx === q.answer) cls += ' is-correct';
          else if (idx === userAns) cls += ' is-wrong';
        }
        return `
          <button class="${cls}" data-idx="${idx}" ${showAns ? 'disabled' : ''}>
            <span class="option__letter">${letters[idx]}</span>
            <span>${esc(opt)}</span>
          </button>`;
      }).join('')}
    </div>
    ${showAns ? `
      <div class="muted small" style="margin-top:14px;padding-top:12px;border-top:1px dashed var(--line)">
        ${userAns === q.answer
          ? '<span style="color:var(--success);font-weight:500">✓ 答對！</span>'
          : `<span style="color:var(--danger);font-weight:500">✗ 答錯。</span> 正解：${letters[q.answer]}`}
      </div>
      ${q.explanation ? `
        <div class="qm-section" style="margin-top:14px">
          <h3 class="qm-section__title">📝 解析</h3>
          <p>${esc(q.explanation)}</p>
        </div>` : ''}
      ${q.optionsAnalysis?.length ? `
        <div class="qm-section">
          <h3 class="qm-section__title">🔍 選項分析</h3>
          <ul>
            ${q.optionsAnalysis.map((a, idx) => `
              <li class="${q.answer === idx ? 'is-correct' : ''}">
                <strong>${letters[idx]}.</strong> ${esc(a)}
              </li>`).join('')}
          </ul>
        </div>` : ''}
      ${q.example ? `
        <div class="qm-section qm-section--ex">
          <h3 class="qm-section__title">💡 舉例</h3>
          <p>${esc(q.example)}</p>
        </div>` : ''}
      ${(!q.explanation && !q.optionsAnalysis?.length) ? `
        <div class="muted small" style="margin-top:10px;text-align:center">
          （這題沒有存解析，可到 Tab 2 重新解析該題或按「📋 複製題目」去問 AI）
        </div>` : ''}
    ` : ''}
  `;

  card.querySelectorAll('.option').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.idx);
      state.answers[state.cursor] = idx;
      renderQuestion();
    });
  });

  // 上下題按鈕狀態
  document.getElementById('examPrev').disabled = state.cursor === 0;
  document.getElementById('examNext').disabled = state.cursor === total - 1;
}

function goto(idx) {
  if (idx < 0 || idx >= state.questions.length) return;
  state.cursor = idx;
  renderQuestion();
}

function updateAnsweredCount() {
  const ans = state.answers.filter(x => x != null).length;
  document.getElementById('examAnswered').textContent = ans;
  document.getElementById('examUnans').textContent = state.answers.length - ans;
}

function showQuestionGrid() {
  // 在 result panel 上方暫時顯示一個 grid
  const total = state.questions.length;
  const cells = state.questions.map((_, i) => {
    let cls = 'qgrid__cell';
    if (state.answers[i] != null) cls += ' is-answered';
    if (i === state.cursor)        cls += ' is-current';
    return `<button class="${cls}" data-i="${i}">${i+1}</button>`;
  }).join('');

  const html = `
    <div class="card" style="margin-bottom:16px">
      <div class="card__head"><h2 class="h2">題目導覽</h2>
        <button class="btn btn--ghost btn--sm" id="gridClose">關閉</button>
      </div>
      <p class="muted small">點擊題號可以快速跳轉。已作答 <strong>${state.answers.filter(x=>x!=null).length}</strong> / ${total}</p>
      <div class="qgrid">${cells}</div>
    </div>`;
  const grid = document.createElement('div');
  grid.id = 'examGridWrap';
  grid.innerHTML = html;

  // 移除舊的
  document.getElementById('examGridWrap')?.remove();
  document.getElementById('examQuestionCard').before(grid);

  grid.querySelectorAll('.qgrid__cell').forEach(cell => {
    cell.addEventListener('click', () => {
      goto(Number(cell.dataset.i));
      grid.remove();
    });
  });
  grid.querySelector('#gridClose').addEventListener('click', () => grid.remove());
}

async function submitExam() {
  const unans = state.answers.filter(x => x == null).length;
  if (unans > 0) {
    if (!confirmAction(`還有 ${unans} 題未作答，確定交卷？`)) return;
  }

  // 計分（每科獨立）
  const bySubj = { 1: { correct: 0, total: 0 }, 2: { correct: 0, total: 0 } };
  state.questions.forEach((q, i) => {
    const s = q.subject || 1;
    if (!bySubj[s]) bySubj[s] = { correct: 0, total: 0 };
    bySubj[s].total++;
    if (q.answer != null && state.answers[i] === q.answer) bySubj[s].correct++;
  });

  const score = subj => Math.round((bySubj[subj].correct / Math.max(1, bySubj[subj].total)) * 100);
  const score1 = score(1);
  const score2 = score(2);
  const avg    = Math.round((score1 + score2) / 2);

  const passByAvg  = avg >= PASS_RULE.averageMin;
  const passBySubj = (bySubj[1].total === 0 || score1 >= PASS_RULE.perSubjectMin) &&
                     (bySubj[2].total === 0 || score2 >= PASS_RULE.perSubjectMin);
  const pass = passByAvg && passBySubj;

  // 切換到結果頁
  document.getElementById('examRun').hidden = true;
  const resultEl = document.getElementById('examResult');
  resultEl.hidden = false;

  const wrong = state.questions
    .map((q, i) => ({ q, i, user: state.answers[i] }))
    .filter(x => x.q.answer != null && x.user !== x.q.answer);

  const letters = ['A','B','C','D'];

  resultEl.innerHTML = `
    <div class="panel__head">
      <div>
        <h1 class="h1">${pass ? '🎉 恭喜通過' : '尚未達到及格標準'}</h1>
        <p class="muted">${pass
          ? '兩科平均 ≥ 70 且單科 ≥ 60，達到 iPAS 及格門檻'
          : '及格標準：兩科平均 ≥ 70 且單科 ≥ 60'}</p>
      </div>
      <button class="btn btn--ghost" id="examRestart">回到設定頁</button>
    </div>

    <div class="result-hero">
      <div class="result-tile">
        <div class="result-tile__num ${score1 >= 60 ? 'pass' : 'fail'}">${score1}</div>
        <div class="result-tile__lbl">科目一（${bySubj[1].correct} / ${bySubj[1].total}）</div>
      </div>
      <div class="result-tile">
        <div class="result-tile__num ${score2 >= 60 ? 'pass' : 'fail'}">${score2}</div>
        <div class="result-tile__lbl">科目二（${bySubj[2].correct} / ${bySubj[2].total}）</div>
      </div>
      <div class="result-tile">
        <div class="result-tile__num ${pass ? 'pass' : 'fail'}">${avg}</div>
        <div class="result-tile__lbl">平均分數</div>
      </div>
    </div>

    <div class="card">
      <div class="card__head">
        <h2 class="h2">錯題詳解 <span class="muted small">（${wrong.length} 題）</span></h2>
        <span class="chip">${wrong.length === 0 ? '滿分！' : '點擊 AI 圖示可一鍵帶題目去問 AI'}</span>
      </div>

      ${wrong.length === 0 ? `
        <div class="empty"><p>沒有錯題，太厲害了！</p></div>
      ` : wrong.map(({q, i, user}) => `
        <div class="review-q">
          <div class="review-q__head">
            <span class="chip chip--strong">${SUBJECTS[q.subject]?.label || ''}</span>
            <span class="chip chip--err">第 ${i + 1} 題</span>
            ${q.explanation || q.optionsAnalysis?.length ? '<span class="chip chip--ok">📝 含解析</span>' : ''}
          </div>
          <div class="q-stem" style="margin-bottom:12px">${esc(q.question)}</div>
          <div class="options">
            ${q.options.map((opt, idx) => {
              let cls = 'option';
              if (idx === q.answer) cls += ' is-correct';
              else if (idx === user) cls += ' is-wrong';
              return `
                <div class="${cls}">
                  <span class="option__letter">${letters[idx]}</span>
                  <span>${esc(opt)}</span>
                </div>`;
            }).join('')}
          </div>
          ${q.explanation ? `
            <div class="qm-section" style="margin-top:14px">
              <h3 class="qm-section__title">📝 解析</h3>
              <p>${esc(q.explanation)}</p>
              ${q.optionsAnalysis?.length ? `
                <div style="margin-top:8px">
                  <button class="btn btn--ghost btn--sm" data-detail-qi="${i}">查看完整選項分析 →</button>
                </div>` : ''}
            </div>` : ''}
          <div class="ai-tools">
            <span class="ai-tools__lbl">${q.explanation ? '另外問 AI：' : '問 AI：'}</span>
            <button class="ai-btn ai-btn--copy" data-copy-qi="${i}" title="複製題目到剪貼簿（自己貼到任何 AI）">
              📋 複製題目
            </button>
            ${AI_PORTALS.map(p => `
              <button class="ai-btn" data-portal="${p.id}" data-qi="${i}" title="複製題目並開啟 ${p.label}">
                <span class="ai-btn__icon ${p.cls}">${p.icon}</span>${p.label}
              </button>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // 綁定「查看完整選項分析」→ 開詳解 modal
  resultEl.querySelectorAll('[data-detail-qi]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.detailQi);
      const wrongQuestions = wrong.map(w => state.questions[w.i]);
      const cursor = wrong.findIndex(w => w.i === idx);
      showQuestionDetail(wrongQuestions, Math.max(0, cursor));
    });
  });

  // 純複製按鈕（不跳轉）
  resultEl.querySelectorAll('[data-copy-qi]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = Number(btn.dataset.copyQi);
      const q = state.questions[idx];
      const text = composePromptForAI(q);
      const ok = await copyToClipboard(text);
      toast(ok ? '✅ 題目已複製，可貼到任何 AI 對話視窗' : '❌ 複製失敗，請手動選取', ok ? 'ok' : 'err', 4000);
    });
  });

  // 綁定 AI 跳轉（複製 + 開新分頁）
  resultEl.querySelectorAll('[data-portal]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = Number(btn.dataset.qi);
      const q = state.questions[idx];
      const portal = AI_PORTALS.find(p => p.id === btn.dataset.portal);
      const text = composePromptForAI(q);
      const ok = await copyToClipboard(text);
      if (ok) {
        toast(`✅ 題目已複製，到 ${portal.label} 後按 Ctrl+V（Mac: Cmd+V）即可貼上`, 'ok', 5500);
      } else {
        toast(`❌ 自動複製失敗，請按上方「📋 複製題目」再去 ${portal.label}`, 'err', 5500);
      }
      window.open(portal.url, '_blank', 'noopener');
    });
  });

  document.getElementById('examRestart').addEventListener('click', () => {
    document.getElementById('examResult').hidden = true;
    document.getElementById('examSetup').hidden = false;
  });

  resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function composePromptForAI(q) {
  const letters = ['A', 'B', 'C', 'D'];
  const opts = q.options.map((o, i) => `${letters[i]}. ${o}`).join('\n');
  const ans = q.answer != null ? letters[q.answer] : '未提供';
  return `我正在準備 iPAS AI 應用規劃師考試，請幫我詳細解釋以下題目，包括選項分析與相關觀念：

題目：${q.question}

${opts}

正解：${ans}`;
}
