// ============================================================
// 全站常數設定
// ============================================================
export const STORAGE_KEYS = {
  geminiKey:   'ipas.geminiKey',
  geminiModel: 'ipas.geminiModel',
  fbConfig:    'ipas.fbConfig',
  theme:       'ipas.theme',
  azureKey:    'ipas.azureKey',
  azureRegion: 'ipas.azureRegion',
  azureVoice:  'ipas.azureVoice',
};

// ── 內建 Firebase 設定 ──
export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyArw6eEWZD5cS4g4p5q0pSIte0GECeRHGo",
  authDomain: "ipas-ai-exam-simulator.firebaseapp.com",
  projectId: "ipas-ai-exam-simulator",
  storageBucket: "ipas-ai-exam-simulator.firebasestorage.app",
  messagingSenderId: "37375272595",
  appId: "1:37375272595:web:029d2d32028657dadb0f66"
};

// Azure Speech 中文神經語音清單
export const AZURE_VOICES = [
  { id: 'zh-TW-HsiaoChenNeural', label: '曉臻（女・年輕清亮）',     locale: 'zh-TW' },
  { id: 'zh-TW-HsiaoYuNeural',   label: '曉雨（女・溫柔親切）',     locale: 'zh-TW' },
  { id: 'zh-TW-YunJheNeural',    label: '雲哲（男・沉穩標準）',     locale: 'zh-TW' },
  { id: 'zh-CN-XiaoxiaoNeural',  label: '曉曉（女・最受歡迎）',     locale: 'zh-CN' },
  { id: 'zh-CN-YunxiNeural',     label: '雲希（男・溫暖陽光）',     locale: 'zh-CN' },
  { id: 'zh-CN-YunjianNeural',   label: '雲健（男・新聞播報）',     locale: 'zh-CN' },
  { id: 'zh-CN-XiaoyiNeural',    label: '曉伊（女・活潑可愛）',     locale: 'zh-CN' },
];

export const LEVELS = {
  junior:       { id: 'junior',       label: '初級' },
  intermediate: { id: 'intermediate', label: '中級' },
};

export const SUBJECTS = {
  1: { id: 1, label: '科目一 · 人工智慧基礎概論' },
  2: { id: 2, label: '科目二 · 生成式 AI 應用與規劃' },
};

export const AI_PORTALS = [
  { id: 'gpt',    label: 'ChatGPT', url: 'https://chatgpt.com/',           cls: 'ai-btn__icon--gpt',    icon: 'G' },
  { id: 'gemini', label: 'Gemini',  url: 'https://gemini.google.com/',     cls: 'ai-btn__icon--gemini', icon: 'G' },
  { id: 'claude', label: 'Claude',  url: 'https://claude.ai/',             cls: 'ai-btn__icon--claude', icon: 'C' },
  { id: 'grok',   label: 'Grok',    url: 'https://x.com/i/grok',           cls: 'ai-btn__icon--grok',   icon: 'X' },
];

export const PASS_RULE = {
  averageMin:   70,
  perSubjectMin: 60,
};

// AI Prompt 模板
export const PROMPTS = {

  // 教材整理：詳細、保留原文舉例、結合命題分析
  material(text, level) {
    const levelLabel = LEVELS[level]?.label ?? '初級';
    return `你是 iPAS AI 應用規劃師（${levelLabel}）的資深備考助教。
這份教材是 iPAS 官方學習指引，每個小節結尾通常附有練習題。
請整理為一份**忠於原文、含命題分析、適合自學閱讀**的學習筆記。

# ⚠️ 嚴格輸出規則

## 不要使用 LaTeX 數學語法
- ❌ 禁止：\`$\\rightarrow$\`、\`$\\neq$\`、\`$\\geq$\`、\`$x^2$\`、\`$\\sqrt{x}$\`
- ✅ 改用：\`→\`、\`≠\`、\`≥\`、\`x^2\`、\`sqrt(x)\`、\`pi\`
- 一律用 Unicode 符號或純文字，不要任何 \`$\` 包裝

## 結構
- 使用 Markdown，依教材章節層級組織（\`##\` 大章節、\`###\` 小節）
- 每個重點以 bullet 列出

# 📋 內容要求（**最重要：詳細、不要過度濃縮**）

## 1. 名詞解釋必須完整
- 凡是出現的專有名詞、英文縮寫、技術用語：
  - 保留原文 + **附中文解釋**（如 \`Fine-tuning（微調）：用少量領域資料二次訓練既有模型\`）
  - **若原文有舉例 → 必須保留並寫進筆記**（不要省略）
  - **若原文有對比/類比 → 也要保留**

## 2. 保留原文的具體案例與情境
- 教材中提到的「實務案例」「範例情境」「業界應用」**全部保留**
- 不要因為想壓縮字數而略過例子 — 例子比定義更重要
- 若原文用一個故事/流程說明概念，整段保留改寫，不要只留結論

## 3. 條列細節
- 不要只寫「方法：A、B、C」，要寫「方法 A：定義 + 用法 + 例子；方法 B：...」
- 每個 bullet **可以兩三句話完整說明**，不要單句空泛

## 4. 識別練習題並逆推出題邏輯
- 識別每個小節結尾的「練習題 / 自我評量」段落
- 練習題出現的核心概念，在筆記中對應 bullet 後標註 \`🎯 考點\`
- 該 bullet 之後另起一行加註「（**出題角度**：說明這個觀念如何被考、可能用什麼題型）」

## 5. 每個大章節結尾必加：### 📊 出題邏輯分析
- **題型分布**：定義題 / 應用題 / 比較題 / 計算題 / 情境判斷題等
- **命題重點**：哪些觀念最常被考、哪些細節容易設計成選項陷阱
- **易混淆點**：相近概念對照（例如 監督式 vs 非監督式）
- **預測命題方向**：依練習題傾向推測延伸考法

## 6. 結尾必加：## 🏆 考前重點摘要
- 8–12 個最容易考的觀念
- 每項標註對應章節（如 \`(§1.2)\`）+ 一句話點出考點精髓

# 🚫 不要做這些
- 不要包含圖片描述、頁碼、版權聲明、目錄等無意義內容
- 不要使用 LaTeX 語法（看上方規則）
- 不要用斜線符號 \`/\` 取代「或」「與」（朗讀會被讀出來）
- **不要省略原文舉例** — 寧可詳細也不要簡略

# 教材內容
"""
${text}
"""`;
  },

  // 考題抽取 + 詳解（嚴格 JSON）
  questions(text, subject) {
    const subjLabel = SUBJECTS[subject]?.label ?? '科目一';
    return `你是 iPAS AI 應用規劃師（${subjLabel}）的資深備考助教。
以下是歷屆試題原文，包含題目、四個選項、與答案。

請把每一題抽取為結構化資料，**並為每題生成完整解析**。

⚠️ **重要：你的整個回應必須是、且只能是一個合法的 JSON 物件**。
- 不要包含任何前後說明文字
- 不要使用 markdown code fence（不要 \`\`\`json 或 \`\`\`）
- 不要在 JSON 之外加任何字
- 第一個字元必須是 \`{\`，最後一個字元必須是 \`}\`
- **不要使用 LaTeX 語法**（不要 \`$\\rightarrow$\`、\`$\\neq$\`），改用 Unicode（→ ≠）

JSON 格式：
{
  "subject": ${subject},
  "questions": [
    {
      "q": "題目敘述（去除題號）",
      "o": ["選項A內容", "選項B內容", "選項C內容", "選項D內容"],
      "a": 0,
      "exp": "整體解析：說明這題在考什麼觀念、為何正解是 X（至少 2-3 句）",
      "opts": [
        "為何 A 是對/錯，搭配原因",
        "為何 B 是對/錯，搭配原因",
        "為何 C 是對/錯，搭配原因",
        "為何 D 是對/錯，搭配原因"
      ],
      "ex": "（選填）舉一個實務情境或具體例子，幫助記憶"
    }
  ]
}

# 解析撰寫要求

## exp（整體解析）
- 至少 2-3 句完整說明
- 點出題目核心考點與對應章節觀念
- 說明為何正解是 X（從觀念推導，不只說「答案是 X」）

## opts（每選項分析）
- 4 個字串陣列，**每個選項都要分析**（包含正解）
- 正解：說明為何符合題意、為何是最佳答案
- 錯誤選項：點出錯在哪（事實錯誤？範圍偏差？常見誤解？陷阱字眼？）

## ex（舉例 / 情境）
- 選填，但若能舉例請務必加上
- 用實務情境、業界案例、或具體數字例子加深印象

# 細節要求
- "a" 為正解索引（A=0, B=1, C=2, D=3），原文沒答案時設 null
- 數學符號用純文字（x^2, sqrt(x), pi）
- 跳過範例題、附錄、目錄、頁碼、版權聲明
- 移除原始的 (A)(B)(C)(D) 標記
- 完全找不到題目時輸出 {"subject": ${subject}, "questions": []}

# 原始文字
"""
${text}
"""`;
  },
};
