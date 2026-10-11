export function normalizeLookup(value: string): string {
  return decodeURIComponent(
    value
      .trim()
      .replace(/^https?:\/\/[^/]+\//i, '')
      .replace(/^\/+|\/+$/g, ''),
  ).toLowerCase();
}

export async function certificateLookupHash(
  certificateNo: string,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(certificateNo.trim().toLowerCase()),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

export async function resolveCertificateUrl(
  value: string,
): Promise<string | undefined> {
  const normalized = normalizeLookup(value);
  if (/^[a-f0-9]{64}$/.test(normalized)) return `/${normalized}/`;
  if (!normalized || normalized.includes('/')) return undefined;
  const hash = await certificateLookupHash(normalized);
  const response = await fetch(`/lookup/${hash}.json`);
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error('查驗服務暫時無法使用，請稍後再試。');
  const data = await response.json();
  if (typeof data.url !== 'string' || !/^\/[a-f0-9]{64}\/$/.test(data.url)) {
    throw new Error('查驗資料格式錯誤，請稍後再試。');
  }
  return data.url;
}
