import { fetchRegistryRows, type RawSheetRow } from './sheets.ts';
import { maskName } from './mask.ts';
import { fetchDrivePdf } from './drive.ts';
import { encryptCertificatePdf, validateDownloadPassword } from './pdf.ts';
import type { CertificateRecord, CertificateStatus } from './types';
import { certificateRouteId, routeSecret } from './routes.ts';

interface CertificateDownload {
  certificate_no: string;
  route_id: string;
  encrypted: ArrayBuffer;
}

interface CertificateRegistry {
  records: CertificateRecord[];
  downloads: CertificateDownload[];
}

// 查驗頁與靜態下載端點共用同一次讀取，僅快取遮罩資料與密文。
let registryPromise: Promise<CertificateRegistry> | undefined;

function loadRegistry(): Promise<CertificateRegistry> {
  registryPromise ??= fetchRegistryRows()
    .then((rows) => buildCertificateRegistry(rows))
    .catch((error) => {
      registryPromise = undefined;
      throw error;
    });
  return registryPromise;
}

export async function loadCertificates(): Promise<CertificateRecord[]> {
  return (await loadRegistry()).records;
}

export async function loadCertificateDownloads(): Promise<
  CertificateDownload[]
> {
  return (await loadRegistry()).downloads;
}

function baseCertificateNo(certificateNo: string): string {
  return certificateNo.replace(/-r\d+$/, '');
}

function reissueIndex(certificateNo: string): number {
  const match = certificateNo.match(/-r(\d+)$/);
  return match ? Number(match[1]) : 0;
}

/**
 * 去除敏感欄位並加密 PDF。回傳值只包含公開查驗資料與密文，
 * 完整姓名、Drive ID、下載密碼與原始 PDF 都不會傳給頁面或端點。
 */
export async function buildCertificateRegistry(
  rows: RawSheetRow[],
  readPdf: (fileId: string) => Promise<ArrayBuffer> = fetchDrivePdf,
  secret: string = routeSecret(),
): Promise<CertificateRegistry> {
  const records: CertificateRecord[] = rows.map((row) => ({
    certificate_no: row.certificate_no,
    route_id: certificateRouteId(row.certificate_no, secret),
    type_code: row.type_code,
    roc_year: row.roc_year,
    issued_date: row.issued_date,
    status: (row.status as CertificateStatus) || 'valid',
    holder_name_masked: maskName(row.holder_name),
  }));

  // 依補發後綴（-r1, -r2...）分組，讓已補發的舊編號能連結到最新有效編號。
  const byBase = new Map<string, CertificateRecord[]>();
  for (const record of records) {
    const base = baseCertificateNo(record.certificate_no);
    const group = byBase.get(base) ?? [];
    group.push(record);
    byBase.set(base, group);
  }

  for (const group of byBase.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort(
      (a, b) => reissueIndex(a.certificate_no) - reissueIndex(b.certificate_no),
    );
    const latest = sorted[sorted.length - 1];
    for (const record of sorted) {
      if (record.status === 'reissued' && record !== latest) {
        record.reissued_to = latest.certificate_no;
        record.reissued_url = `/${latest.route_id}/`;
      }
    }
  }

  const downloads: CertificateDownload[] = [];
  for (const [index, record] of records.entries()) {
    if (record.status !== 'valid') continue;
    const row = rows[index];
    const fileId = row.pdf_file_id?.trim() ?? '';
    const password = row.download_password ?? '';
    if (!fileId && !password) continue;

    try {
      if (!fileId || !password) {
        throw new Error('pdf_file_id 與 download_password 必須一起填寫');
      }
      validateDownloadPassword(password);
      const encrypted = await encryptCertificatePdf(
        await readPdf(fileId),
        password,
        record.certificate_no,
      );
      record.download_url = `/downloads/${record.route_id}.bin`;
      downloads.push({
        certificate_no: record.certificate_no,
        route_id: record.route_id,
        encrypted,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'PDF 處理失敗';
      throw new Error(`[cert-verify] ${record.certificate_no}：${message}`);
    }
  }

  return { records, downloads };
}
