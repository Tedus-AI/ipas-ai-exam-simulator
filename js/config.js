// ============================================================
// 全站常數設定
// ============================================================
export const STORAGE_KEYS = {
  geminiKey:   'ipas.geminiKey',
  geminiModel: 'ipas.geminiModel',
  fbConfig:    'ipas.fbConfig',
  theme:       'ipas.theme',
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
  // 教材整理
  material(text, level) {
    const levelLabel = LEVELS[level]?.label ?? '初級';
    return `你是 iPAS AI 應用規劃師（${levelLabel}）的學習助手。請仔細閱讀以下官方教材內容，產出一份結構化的學習筆記。

要求：
1. 使用 Markdown 格式輸出，使用標題層級 (## / ###) 組織章節。
2. 每個重點以 bullet 列出，避免冗長段落。
3. 凡是出現專有名詞、英文縮寫，請保留原文並附中文解釋。
4. 若有公式或數學符號，請一律以純文字格式（如 x^2, sqrt(x), pi）。
5. 結尾加一段「考前重點摘要」，列出 5–10 個最容易考的觀念。
6. 不要包含教材中的圖片描述、頁碼或無意義的版面內容。

教材內容：
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
