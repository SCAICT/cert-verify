import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  decryptCertificatePdf,
  encryptCertificatePdf,
  MAX_PDF_BYTES,
  PdfPasswordError,
} from '../src/lib/pdf.ts';
import { PASSWORD, PDF, ROW } from './fixtures.ts';

test('正確密碼可還原完全相同的 PDF，支援 Unicode 與頭尾空白', async () => {
  const password = ` ${PASSWORD}密碼 `;
  const encrypted = await encryptCertificatePdf(
    PDF,
    password,
    ROW.certificate_no,
  );
  assert.deepEqual(
    await decryptCertificatePdf(encrypted, password, ROW.certificate_no),
    PDF,
  );
  assert.equal(
    Buffer.from(encrypted).includes('CONFIDENTIAL_PDF_TEST_CONTENT'),
    false,
  );
  await assert.rejects(
    decryptCertificatePdf(encrypted, password.trim(), ROW.certificate_no),
    PdfPasswordError,
  );
});

test('同一張 PDF、同一密碼每次加密都使用不同 salt 與 IV', async () => {
  const first = await encryptCertificatePdf(PDF, PASSWORD, ROW.certificate_no);
  const second = await encryptCertificatePdf(PDF, PASSWORD, ROW.certificate_no);
  assert.notDeepEqual(first, second);
  assert.deepEqual(
    await decryptCertificatePdf(second, PASSWORD, ROW.certificate_no),
    PDF,
  );
});

test('拒絕錯誤密碼、其他證書編號與被竄改的密文', async () => {
  const encrypted = await encryptCertificatePdf(
    PDF,
    PASSWORD,
    ROW.certificate_no,
  );
  await assert.rejects(
    decryptCertificatePdf(encrypted, 'wrong-password', ROW.certificate_no),
    PdfPasswordError,
  );
  await assert.rejects(
    decryptCertificatePdf(encrypted, PASSWORD, 'scaict-staff-11502'),
    PdfPasswordError,
  );
  const tampered = encrypted.slice(0);
  const bytes = new Uint8Array(tampered);
  bytes[bytes.length - 1] ^= 1;
  await assert.rejects(
    decryptCertificatePdf(tampered, PASSWORD, ROW.certificate_no),
    PdfPasswordError,
  );
});

test('拒絕損壞／未知版本的下載格式', async () => {
  await assert.rejects(
    decryptCertificatePdf(PDF, PASSWORD, ROW.certificate_no),
    /格式不正確/,
  );
  const encrypted = await encryptCertificatePdf(
    PDF,
    PASSWORD,
    ROW.certificate_no,
  );
  await assert.rejects(
    decryptCertificatePdf(encrypted.slice(0, 10), PASSWORD, ROW.certificate_no),
    /格式不正確/,
  );
  new Uint8Array(encrypted)[0] = 0;
  await assert.rejects(
    decryptCertificatePdf(encrypted, PASSWORD, ROW.certificate_no),
    /格式不正確/,
  );
});

test('建置時拒絕短密碼、非 PDF 及過大的 PDF', async () => {
  await assert.rejects(
    encryptCertificatePdf(PDF, '123456', ROW.certificate_no),
    /12 個字元/,
  );
  await assert.rejects(
    encryptCertificatePdf(
      new TextEncoder().encode('<html>error</html>').buffer,
      PASSWORD,
      ROW.certificate_no,
    ),
    /不是 PDF/,
  );
  await assert.rejects(
    encryptCertificatePdf(
      new ArrayBuffer(MAX_PDF_BYTES + 1),
      PASSWORD,
      ROW.certificate_no,
    ),
    /20 MiB/,
  );
});
