import { fetchRegistryRows } from './sheets';
import { maskName } from './mask';
import type { CertificateRecord, CertificateStatus } from './types';

function baseCertificateNo(certificateNo: string): string {
  return certificateNo.replace(/-r\d+$/, '');
}

function reissueIndex(certificateNo: string): number {
  const match = certificateNo.match(/-r(\d+)$/);
  return match ? Number(match[1]) : 0;
}

/**
 * 讀取登記簿、去除敏感欄位（activity_name / remark / serial / 完整姓名）並產生
 * 公開查驗頁面可用的資料。未遮罩姓名只在這個函式內短暫存在，回傳值只包含遮罩後結果。
 */
export async function loadCertificates(): Promise<CertificateRecord[]> {
  const rows = await fetchRegistryRows();

  const records: CertificateRecord[] = rows.map((row) => ({
    certificate_no: row.certificate_no,
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
      }
    }
  }

  return records;
}
