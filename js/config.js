// ============================================================
// 全站常數設定
// ============================================================
export const STORAGE_KEYS = {
  geminiKey:   'ipas.geminiKey',
  geminiModel: 'ipas.geminiModel',
  fbConfig:    'ipas.fbConfig',
  theme:       'ipas.theme',
};

// ── 內建 Firebase 設定 ──────────────────────────────
// Web API Key 不是密鑰（見 https://firebase.google.com/docs/projects/api-keys ），
// 安全完全靠 Firestore Rules，所以直接打包進前端是 OK 的。
// 使用者若想串自己的專案，可以在「設定」抽屜貼上 JSON 蓋掉預設。
export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyArw6eEWZD5cS4g4p5q0pSIte0GECeRHGo",
  authDomain: "ipas-ai-exam-simulator.firebaseapp.com",
  projectId: "ipas-ai-exam-simulator",
  storageBucket: "ipas-ai-exam-simulator.firebasestorage.app",
  messagingSenderId: "37375272595",
  appId: "1:37375272595:web:029d2d32028657dadb0f66"
};

export const LEVELS = {
  junior:       { id: 'junior',       label: '初級' },
  intermediate: { id: 'intermediate', label: '中級' },
};

export const SUBJECTS = {
  1: { id: 1, label: '科目一 · 人工智慧基礎概論' },
  2: { id: 2, label: '科目二 · 生成式 AI 應用與規劃' },
};

// 4 大 AI 平台跳轉設定
export const AI_PORTALS = [
  { id: 'gpt',    label: 'ChatGPT', url: 'https://chatgpt.com/',           cls: 'ai-btn__icon--gpt',    icon: 'G' },
  { id: 'gemini', label: 'Gemini',  url: 'https://gemini.google.com/',     cls: 'ai-btn__icon--gemini', icon: 'G' },
  { id: 'claude', label: 'Claude',  url: 'https://claude.ai/',             cls: 'ai-btn__icon--claude', icon: 'C' },
  { id: 'grok',   label: 'Grok',    url: 'https://x.com/i/grok',           cls: 'ai-btn__icon--grok',   icon: 'X' },
];

// 及格邏輯
export const PASS_RULE = {
  averageMin:   70,   // 兩科平均 ≥ 70
  perSubjectMin: 60,  // 任一科 ≥ 60
};

// AI Prompt 模板
export const PROMPTS = {
  // 教材整理：結合練習題反向分析出題邏輯
  material(text, level) {
    const levelLabel = LEVELS[level]?.label ?? '初級';
    return `你是 iPAS AI 應用規劃師（${levelLabel}）的資深備考助手。
這份教材是 iPAS 官方學習指引，特色是「每個小節結尾通常附有練習題或自我評量」。
這些練習題是出題委員的命題思路指標 —— 反向分析它們，能直接推測正式考試的出題邏輯。

請仔細閱讀以下教材，產出一份**整合命題分析**的結構化學習筆記。

# 整理規則

## 1. 結構
- 使用 Markdown，依教材章節層級組織（\`##\` 為大章節、\`###\` 為小節）。
- 每個重點以 bullet 列出，避免冗長段落。

## 2. 識別練習題並逆推出題邏輯
- 識別教材中每個小節結尾的「練習題 / 自我評量 / 範例題」段落。
- 練習題出現的核心概念，請在筆記中對應的 bullet 後標註 \`🎯 考點\`。
- 該 bullet 之後另起一行縮排，加註「（**出題角度**：說明這個觀念如何被考、可能用什麼題型測驗）」。

## 3. 每個大章節結尾必加：### 📊 出題邏輯分析
針對該章節的練習題，整理：
- **題型分布**：定義題 / 應用題 / 比較題 / 計算題 / 情境判斷題 / 流程順序題 等，標註比例。
- **命題重點**：哪些觀念最常被考、哪些細節容易設計成選項陷阱。
- **易混淆點**：容易混淆的相近概念對照（例如 監督式 vs 非監督式、過擬合 vs 欠擬合）。
- **預測命題方向**：依練習題的傾向，推測正式考試可能延伸的考法。

## 4. 細節要求
- 專有名詞、英文縮寫請保留原文並附中文解釋（如 \`Fine-tuning（微調）\`）。
- 公式或數學符號一律純文字格式（如 \`x^2, sqrt(x), pi\`）。
- 不要包含圖片描述、頁碼、版權聲明、目錄等無意義內容。
- 若某個小節沒有練習題，不需勉強分析，正常整理重點即可。

## 5. 結尾必加：## 🏆 考前重點摘要
列出 8–12 個最容易考的觀念，每項標註對應章節（如 \`(§1.2)\`），並用一句話點出考點精髓。

# 教材內容
"""
${text}
"""`;
  },

  // 考題抽取（嚴格 JSON）
  questions(text, subject) {
    const subjLabel = SUBJECTS[subject]?.label ?? '科目一';
    return `你是 iPAS AI 應用規劃師考試題目的解析助手。以下是「${subjLabel}」的歷屆試題原文，可能包含題目、四個選項、答案頁。

請把每一題抽取為結構化資料，輸出**嚴格**的 JSON（不要 markdown code fence、不要任何說明文字、只能是 JSON 物件）。

JSON 格式：
{
  "subject": ${subject},
  "questions": [
    { "q": "題目敘述（去除題號）", "o": ["選項A內容", "選項B內容", "選項C內容", "選項D內容"], "a": 0 }
  ]
}

說明：
- "a" 是正確答案的索引（A=0, B=1, C=2, D=3）。如果原文沒有答案，請把 "a" 設為 null。
- 數學符號用純文字（x^2, sqrt(x), pi）。
- 跳過範例題、附錄、目錄、頁碼。
- 移除原始的 (A) (B) (C) (D) 標記，"o" 陣列只放純文字內容。
- 如果完全找不到題目，輸出 {"subject": ${subject}, "questions": []}。

原始文字：
"""
${text}
"""`;
  },
};
