import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildCertificateRegistry } from '../src/lib/certificates.ts';
import { decryptCertificatePdf } from '../src/lib/pdf.ts';
import { fetchDrivePdf } from '../src/lib/drive.ts';
import {
  PASSWORD,
  PDF,
  PRIVATE_FILE_ID,
  PRIVATE_NAME,
  ROW,
} from './fixtures.ts';

test('只輸出遮罩資料、公開下載路徑與密文', async () => {
  const result = await buildCertificateRegistry([ROW], async (fileId) => {
    assert.equal(fileId, PRIVATE_FILE_ID);
    return PDF;
  });
  assert.equal(
    result.records[0].download_url,
    `/downloads/${ROW.certificate_no}.bin`,
  );
  assert.equal(result.downloads.length, 1);
  assert.deepEqual(
    await decryptCertificatePdf(
      result.downloads[0].encrypted,
      PASSWORD,
      ROW.certificate_no,
    ),
    PDF,
  );
  const serialized = JSON.stringify(result);
  for (const secret of [
    PASSWORD,
    PRIVATE_NAME,
    PRIVATE_FILE_ID,
    ROW.activity_name,
    ROW.remark,
  ]) {
    assert.equal(serialized.includes(secret), false);
  }
});

test('未設定電子檔、已作廢與已補發的證書不讀取或發布 PDF', async () => {
  const result = await buildCertificateRegistry(
    [
      { ...ROW, pdf_file_id: '', download_password: '' },
      { ...ROW, certificate_no: 'scaict-void-11501', status: 'void' },
      { ...ROW, certificate_no: 'scaict-complete-11501', status: 'reissued' },
      {
        ...ROW,
        certificate_no: 'scaict-complete-11501-r1',
        pdf_file_id: undefined,
        download_password: undefined,
      },
    ],
    async () => {
      throw new Error('不應呼叫 Google Drive');
    },
  );
  assert.equal(result.downloads.length, 0);
  assert.ok(
    result.records.every((record) => record.download_url === undefined),
  );
  assert.equal(result.records[2].reissued_to, 'scaict-complete-11501-r1');
});

test('不完整下載設定或短密碼會在讀取 Drive 之前讓建置失敗', async () => {
  for (const fields of [
    { download_password: '' },
    { pdf_file_id: '' },
    { download_password: 'short' },
    { download_password: '                ' },
  ]) {
    await assert.rejects(
      buildCertificateRegistry([{ ...ROW, ...fields }], async () => {
        assert.fail('不應呼叫 Google Drive');
      }),
      (error: Error) => {
        assert.ok(error.message.includes(ROW.certificate_no));
        assert.match(error.message, /必須一起填寫|12 個字元/);
        assert.equal(error.message.includes(PRIVATE_FILE_ID), false);
        return true;
      },
    );
  }
});

test('Drive 錯誤會阻止發布，並指出需要處理的證書', async () => {
  await assert.rejects(
    buildCertificateRegistry([ROW], async () => {
      throw new Error('HTTP 403');
    }),
    new RegExp(`${ROW.certificate_no}.*HTTP 403`),
  );
  await assert.rejects(
    fetchDrivePdf('https://drive.google.com/file/d/test/view'),
    /檔案 ID/,
  );
});
