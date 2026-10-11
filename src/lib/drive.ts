import { createGoogleAuth, fetchGoogleResource } from './google.ts';
import { MAX_PDF_BYTES } from './pdf.ts';

let auth: ReturnType<typeof createGoogleAuth> | undefined;

/** 僅在建置時，以 Service Account 讀取分享給該帳號的私有 PDF。 */
export async function fetchDrivePdf(fileId: string): Promise<ArrayBuffer> {
  if (!/^[a-zA-Z0-9_-]+$/.test(fileId)) {
    throw new Error('pdf_file_id 請填入 Google Drive 檔案 ID，而非分享網址');
  }

  auth ??= createGoogleAuth(['https://www.googleapis.com/auth/drive.readonly']);
  const { token } = await auth.getAccessToken();
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`;
  const res = await fetchGoogleResource(
    url,
    token ?? '',
    '讀取 Google Drive PDF',
  );

  if (Number(res.headers.get('content-length')) > MAX_PDF_BYTES) {
    await res.body?.cancel();
    throw new Error('PDF 不可超過 20 MiB');
  }
  const pdf = await res.arrayBuffer();
  if (pdf.byteLength > MAX_PDF_BYTES) throw new Error('PDF 不可超過 20 MiB');
  return pdf;
}
