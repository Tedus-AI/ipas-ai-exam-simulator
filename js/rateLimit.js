// ============================================================
// 速率管理：每模型獨立追蹤 RPM (15) / RPD (1500)
// 規格依 Google AI Studio Free Tier（Gemma 4 26B / 31B 同規）
// ============================================================

export const RATE_LIMITS = {
  RPM: 15,           // 每分鐘最多請求數
  RPD: 1500,         // 每天最多請求數
  WINDOW_MS: 60_000, // RPM 滑動視窗（60 秒）
  WARN_RPD_PCT: 0.85,// 達 85% 時警告
};

const STORAGE_KEY = 'ipas.usage.v1';

/* ───── 內部狀態管理 ───── */
function todayStr() {
  // YYYY-MM-DD（本地時區，與 quota 一致 — Google 是 PT 時區重置，
  // 但本機判斷已能滿足實務避免超用）
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAll(obj) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
}

function loadModel(model) {
  const all = loadAll();
  const today = todayStr();
  let m = all[model];
  if (!m || m.date !== today) {
    m = { date: today, daily: 0, recent: [] };
  }
  // 過濾掉超過視窗的舊時間戳
  const cutoff = Date.now() - RATE_LIMITS.WINDOW_MS;
  m.recent = (m.recent || []).filter(t => t > cutoff);
  return m;
}

function saveModel(model, m) {
  const all = loadAll();
  all[model] = m;
  saveAll(all);
}

/* ───── 對外 API ───── */

/**
 * 取得單一模型的目前用量
 */
export function getUsage(model) {
  const m = loadModel(model);
  return {
    model,
    rpmUsed: m.recent.length,
    rpmLimit: RATE_LIMITS.RPM,
    rpdUsed: m.daily,
    rpdLimit: RATE_LIMITS.RPD,
    nextSlotMs: m.recent.length >= RATE_LIMITS.RPM
      ? Math.max(0, m.recent[0] + RATE_LIMITS.WINDOW_MS - Date.now())
      : 0,
  };
}

/**
 * 取得所有已知模型的用量總覽
 */
export function getAllUsage(models) {
  return models.map(getUsage);
}

/**
 * 在發起 API 呼叫之前等待可用 slot
 *  - RPD 超限 → 直接 throw（無法等）
 *  - RPM 超限 → 等待到下一個可用秒數
 * @param {string} model
 * @param {(waitMs:number)=>void} onWait  通知 UI「等待中」
 */
export async function waitForSlot(model, onWait) {
  let m = loadModel(model);

  if (m.daily >= RATE_LIMITS.RPD) {
    throw new Error(
      `今日 ${model} 已達免費額度上限（${RATE_LIMITS.RPD} 次）。請改用另一個模型，或明天再試。`
    );
  }

  if (m.recent.length >= RATE_LIMITS.RPM) {
    const waitMs = m.recent[0] + RATE_LIMITS.WINDOW_MS - Date.now() + 200; // +200ms 安全餘
    if (waitMs > 0) {
      onWait?.(waitMs);
      await new Promise(r => setTimeout(r, waitMs));
    }
    // 重新載入 + 過濾舊時間戳
    m = loadModel(model);
  }
}

/**
 * 記錄一次成功（或剛發出的）呼叫
 */
export function recordCall(model) {
  const m = loadModel(model);
  m.recent.push(Date.now());
  m.daily += 1;
  saveModel(model, m);
}

/**
 * 撤銷最後一次記錄（呼叫失敗且不該扣額時用）
 */
export function uncountCall(model) {
  const m = loadModel(model);
  m.recent.pop();
  if (m.daily > 0) m.daily -= 1;
  saveModel(model, m);
}

/**
 * 重置（debug 用）
 */
export function resetUsage() {
  localStorage.removeItem(STORAGE_KEY);
}
