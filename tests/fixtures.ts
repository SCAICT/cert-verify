import type { RawSheetRow } from '../src/lib/sheets.ts';

export const PASSWORD = 'test-only-Q7p9-W2k8';
export const PRIVATE_FILE_ID = 'private-drive-file-test';
export const PRIVATE_NAME = '測試完整姓名';

export const ROW: RawSheetRow = {
  certificate_no: 'scaict-staff-11501',
  type_code: 'staff',
  roc_year: '115',
  serial: '01',
  holder_name: PRIVATE_NAME,
  activity_name: 'private-activity-test',
  issued_date: '2026-10-10',
  status: 'valid',
  remark: 'private-remark-test',
  pdf_file_id: PRIVATE_FILE_ID,
  download_password: PASSWORD,
};

// 產生可被 PDF 閱讀器開啟的單頁測試檔，沒有實際持有人資料。
const stream = 'BT /F1 18 Tf 40 100 Td (CONFIDENTIAL_PDF_TEST_CONTENT) Tj ET\n';
const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 500 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
];
let source = '%PDF-1.4\n';
const offsets = [0];
for (const [index, object] of objects.entries()) {
  offsets.push(source.length);
  source += `${index + 1} 0 obj\n${object}\nendobj\n`;
}
const xref = source.length;
source += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
source += offsets
  .slice(1)
  .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
  .join('');
source += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

export const PDF = new TextEncoder().encode(source).buffer;
