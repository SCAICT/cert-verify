// 此模組同時供建置端和瀏覽器使用，僅依賴 Web Crypto，不包含憑證或私有資料。
const encoder = new TextEncoder();
const MAGIC = encoder.encode('SCAICT-PDF-1\n');
const SALT_BYTES = 16;
const IV_BYTES = 12;
const HEADER_BYTES = MAGIC.length + SALT_BYTES + IV_BYTES;
const ITERATIONS = 600_000;

export const MAX_PDF_BYTES = 20 * 1024 * 1024;

export class PdfPasswordError extends Error {
  constructor() {
    super('密碼不正確，或電子檔已更新。請確認密碼後再試。');
    this.name = 'PdfPasswordError';
  }
}

export function validateDownloadPassword(password: string): void {
  if (Array.from(password.trim()).length < 12) {
    throw new Error('download_password 至少需要 12 個字元（不計頭尾空白）');
  }
}

function validatePdf(pdf: ArrayBuffer): void {
  if (pdf.byteLength > MAX_PDF_BYTES) {
    throw new Error('PDF 不可超過 20 MiB');
  }
  if (new TextDecoder().decode(pdf.slice(0, 5)) !== '%PDF-') {
    throw new Error('檔案不是 PDF，請上傳 PDF 電子檔');
  }
}

async function deriveKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  usage: 'encrypt' | 'decrypt',
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    [usage],
  );
}

/** 格式 v1：magic + 16-byte salt + 12-byte IV + AES-GCM 密文（含 128-bit tag）。 */
export async function encryptCertificatePdf(
  pdf: ArrayBuffer,
  password: string,
  certificateNo: string,
): Promise<ArrayBuffer> {
  validateDownloadPassword(password);
  validatePdf(pdf);
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt, 'encrypt');
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: encoder.encode(`SCAICT-PDF-1\n${certificateNo}`),
      tagLength: 128,
    },
    key,
    pdf,
  );
  const encrypted = new Uint8Array(HEADER_BYTES + ciphertext.byteLength);
  encrypted.set(MAGIC);
  encrypted.set(salt, MAGIC.length);
  encrypted.set(iv, MAGIC.length + SALT_BYTES);
  encrypted.set(new Uint8Array(ciphertext), HEADER_BYTES);
  return encrypted.buffer;
}

export async function decryptCertificatePdf(
  encrypted: ArrayBuffer,
  password: string,
  certificateNo: string,
): Promise<ArrayBuffer> {
  const bytes = new Uint8Array(encrypted);
  if (
    bytes.length < HEADER_BYTES + 16 + 5 ||
    bytes.length > HEADER_BYTES + 16 + MAX_PDF_BYTES ||
    !MAGIC.every((value, index) => bytes[index] === value)
  ) {
    throw new Error('電子檔格式不正確，請重新整理頁面後再試。');
  }

  const salt = bytes.slice(MAGIC.length, MAGIC.length + SALT_BYTES);
  const iv = bytes.slice(MAGIC.length + SALT_BYTES, HEADER_BYTES);
  const key = await deriveKey(password, salt, 'decrypt');
  let pdf: ArrayBuffer;
  try {
    pdf = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData: encoder.encode(`SCAICT-PDF-1\n${certificateNo}`),
        tagLength: 128,
      },
      key,
      encrypted.slice(HEADER_BYTES),
    );
  } catch {
    throw new PdfPasswordError();
  }
  validatePdf(pdf);
  return pdf;
}
