# iPAS AI 應用規劃師 · 模擬考工具

一站式 iPAS AI 應用規劃師備考工具。把官方學習指引丟給 AI 自動整理為結構化筆記、把歷屆考題自動轉成可作答的題庫、並提供符合官方及格邏輯的模擬測驗。錯題還能一鍵帶到 ChatGPT / Gemini / Claude / Grok 追問。

純前端、零後端負擔，可以直接掛在 GitHub Pages 上。

## ✨ 功能

- **AI 教材助手**：上傳官方學習指引 PDF/DOCX → Gemini 整理成 Markdown 結構化重點筆記
- **題庫建置**：上傳歷屆試題 → AI 抽取為嚴格 JSON → 寫入 Firestore 或本機 IndexedDB
- **模擬測驗**：每科隨機抽題、考試/練習雙模式、即時批改、錯題詳解 + 4 大 AI 平台一鍵跳轉
- **及格邏輯**：兩科平均 ≥ 70 且單科 ≥ 60（依 iPAS 官方規則）
- **BYOK**：API Key 僅存在你瀏覽器的 `localStorage`，絕不上傳
- **離線可用**：沒設定 Firebase 也能跑，自動 fallback 到 IndexedDB

## 🎨 UI 風格

採 Claude.ai 風格設計：暖色紙感背景、Source Serif 4 襯線標題、橘色強調色、明暗主題切換。

## 🛠️ 技術棧

| 層級 | 技術 |
| --- | --- |
| 前端 | 原生 HTML5 / CSS3 / Vanilla JS（ES Modules） |
| 檔案解析 | [pdf.js](https://mozilla.github.io/pdf.js/) + [mammoth.js](https://github.com/mwilliamson/mammoth.js) |
| Markdown 渲染 | [marked](https://marked.js.org/) + [DOMPurify](https://github.com/cure53/DOMPurify) |
| AI | Google Gemini API（AI Studio）BYOK |
| 儲存 | Firebase Firestore（線上同步）/ IndexedDB（本機 fallback） |
| 部署 | GitHub Pages + GitHub Actions |

## 🚀 快速上線（GitHub Pages）

```bash
cd ipas-ai-exam-simulator
git init
git add .
git commit -m "feat: initial iPAS exam simulator"
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/ipas-ai-exam-simulator.git
git push -u origin main
```

然後到 GitHub repo 的 **Settings → Pages**：
- **Source** 選 `GitHub Actions`
- 等 1–2 分鐘，Actions 跑完後會給你網址：`https://<YOUR_USERNAME>.github.io/ipas-ai-exam-simulator/`

## 🔑 取得 Gemini API Key

1. 到 [Google AI Studio](https://aistudio.google.com/apikey) 登入 Google 帳號
2. 點 **Create API Key**，複製
3. 開啟你的網站 → 右上角設定 → 貼上 Key → 儲存
4. 預設使用 `gemini-2.5-flash`，免費額度足夠日常備考

## 🔥 Firebase（選用，跨裝置同步）

如果想在電腦/手機之間同步題庫，可以建立 Firebase 專案：

1. [Firebase Console](https://console.firebase.google.com/) → 建立專案
2. **Build → Firestore Database** → 建立資料庫（測試模式即可）
3. **專案設定 → 一般 → 你的應用程式 → Web** → 複製 `firebaseConfig` 物件中的 JSON
4. 貼進設定抽屜的 **Firebase Config** 欄位 → 儲存

### Firestore 安全規則建議

如果只是個人使用，建議設為僅自己可讀寫，或使用 Firebase Auth。最簡略的測試模式（30 天到期）：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.time < timestamp.date(2026, 6, 1);
    }
  }
}
```

要長期使用請改採身份驗證或固定來源限制。

## 📁 專案結構

```
ipas-ai-exam-simulator/
├── index.html              # 主頁面
├── css/styles.css          # Claude 風格 CSS
├── js/
│   ├── app.js              # 主入口
│   ├── config.js           # 常數 + AI Prompts
│   ├── ui.js               # Toast/Drawer/Markdown 等 UI 工具
│   ├── parser.js           # PDF/DOCX 解析
│   ├── ai.js               # Gemini API wrapper
│   ├── store.js            # Firestore + IndexedDB 雙層儲存
│   ├── tab-materials.js    # Tab 1：教材助手
│   ├── tab-questions.js    # Tab 2：題庫建置
│   └── tab-exam.js         # Tab 3：模擬測驗
├── .github/workflows/pages.yml
├── README.md / LICENSE / .gitignore
```

## 💻 本機測試

由於使用了 ES Modules，無法直接 `file://` 開啟。請用任一靜態伺服器：

```bash
# Python
python -m http.server 8000

# Node
npx serve .
```

然後到 `http://localhost:8000`。

## 📋 與規劃書的差異說明

原規劃書指定 Google Vertex AI (Gemma)，但純前端直接呼叫 Vertex AI 會有 **CORS** 與 **Service Account 驗證** 的麻煩。實際採用：

- ✅ **Gemini API（AI Studio）**：純 API Key 認證、CORS 友善、有免費額度
- ✅ **IndexedDB fallback**：沒有 Firebase 也能單機完整使用
- ✅ **題庫匯出/匯入 JSON**：方便備份與遷移
- ✅ **練習模式**：每題作答後立即顯示對錯（規劃書沒提的便利功能）
- ✅ **題目導覽 grid**：考試中可快速跳題

## 🐛 已知限制

- 純圖片掃描的 PDF 無法抽出文字（需 OCR，目前未支援）
- 單次解析建議 < 20MB，太大會在解析階段卡住
- Gemini 偶爾會把答案推測錯，請以原始試題公告為準

## 📜 授權

MIT
