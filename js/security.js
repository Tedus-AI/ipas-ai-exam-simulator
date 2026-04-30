// ============================================================
// 簡易安全鎖：寫入 / 刪除前需解鎖
// ⚠️ 注意：前端密碼只能擋誤操作。任何人查看 source code 都能看到，
// 真正安全要靠 Firestore Rules + Firebase Auth。
// ============================================================

const PASSWORD = '0420';
const SESSION_KEY = 'ipas.unlocked.v1';

// 對外監聽（鎖頭 UI 用）
const listeners = [];
export function onLockChange(fn) { listeners.push(fn); }
function emit() { listeners.forEach(f => f(isUnlocked())); }

export function isUnlocked() {
  return sessionStorage.getItem(SESSION_KEY) === '1';
}

export function unlockWith(pw) {
  if (pw === PASSWORD) {
    sessionStorage.setItem(SESSION_KEY, '1');
    emit();
    return true;
  }
  return false;
}

export function lock() {
  sessionStorage.removeItem(SESSION_KEY);
  emit();
}

/**
 * 任何寫入 / 刪除操作前呼叫
 * - 已解鎖 → 直接 return true
 * - 未解鎖 → 顯示密碼 modal，使用者輸入正確密碼後 return true
 * - 取消 / 輸錯 → return false
 */
export async function requireUnlock(reason = '此動作需要解鎖') {
  if (isUnlocked()) return true;
  return await promptUnlock(reason);
}

function promptUnlock(reason) {
  return new Promise(resolve => {
    const modal = document.getElementById('lockModal');
    if (!modal) return resolve(false);

    const input  = document.getElementById('lockInput');
    const reasonEl = document.getElementById('lockReason');
    const okBtn  = document.getElementById('lockOk');
    const cancel = document.getElementById('lockCancel');
    const errEl  = document.getElementById('lockErr');

    reasonEl.textContent = reason;
    errEl.textContent = '';
    input.value = '';
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => input.focus(), 50);

    const cleanup = () => {
      modal.hidden = true;
      document.body.style.overflow = '';
      okBtn.removeEventListener('click', onOk);
      cancel.removeEventListener('click', onCancel);
      modal.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onKey);
    };

    const onOk = () => {
      const pw = input.value;
      if (unlockWith(pw)) {
        errEl.textContent = '';
        cleanup();
        resolve(true);
      } else {
        errEl.textContent = '密碼錯誤';
        input.select();
      }
    };
    const onCancel = () => { cleanup(); resolve(false); };
    const onBackdrop = e => { if (e.target.dataset?.close === '') onCancel(); };
    const onKey = e => {
      if (e.key === 'Enter') onOk();
      if (e.key === 'Escape') onCancel();
    };

    okBtn.addEventListener('click', onOk);
    cancel.addEventListener('click', onCancel);
    modal.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKey);
  });
}
