import { createHmac } from 'node:crypto';

export function certificateRouteId(
  certificateNo: string,
  secret: string,
): string {
  return createHmac('sha256', secret)
    .update(certificateNo.trim().toLowerCase())
    .digest('hex');
}

export function routeSecret(): string {
  const secret = process.env.CERTIFICATE_URL_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.GOOGLE_SHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    throw new Error(
      '[cert-verify] 請設定至少 32 字元的 CERTIFICATE_URL_SECRET，以產生固定的隨機查驗網址',
    );
  }
  return 'local-sample-route-secret-not-for-production';
}
