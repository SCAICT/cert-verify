import { JWT } from 'google-auth-library';

const MAX_ATTEMPTS = 4;

/** 憑證或權限錯誤不會因為重試而恢復。 */
class GoogleConfigError extends Error {}

export function createGoogleAuth(scopes: string[]): JWT {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) {
    throw new GoogleConfigError(
      '[cert-verify] 未設定 GOOGLE_SERVICE_ACCOUNT_KEY',
    );
  }

  let credentials: { client_email: string; private_key: string };
  try {
    credentials = JSON.parse(keyJson);
    if (!credentials.client_email || !credentials.private_key)
      throw new Error();
  } catch {
    throw new GoogleConfigError('[cert-verify] Service Account 金鑰格式不正確');
  }

  return new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes,
  });
}

/** Sheets 與 Drive 的暫時性錯誤都以退避重試處理，記錄中不包含私有網址或回應內容。 */
export async function fetchGoogleResource(
  url: string,
  token: string,
  description: string,
): Promise<Response> {
  let lastError = new Error(`[cert-verify] ${description}失敗`);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(60_000),
      });

      if (res.ok) return res;
      await res.body?.cancel();

      const message = `[cert-verify] ${description}失敗：HTTP ${res.status}`;
      if (res.status < 500 && res.status !== 429) {
        throw new GoogleConfigError(message);
      }
      lastError = new Error(message);
    } catch (error) {
      if (error instanceof GoogleConfigError) throw error;
      // 不輸出底層錯誤，避免私有檔案 ID 或授權資料進入建置紀錄。
    }

    if (attempt < MAX_ATTEMPTS) {
      const delay = 2 ** (attempt - 1) * 1000;
      console.warn(
        `${lastError.message}，${delay / 1000} 秒後重試（第 ${attempt + 1}/${MAX_ATTEMPTS} 次）。`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
