import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { build } from 'astro';
import { JWT } from 'google-auth-library';
import { decryptCertificatePdf } from '../src/lib/pdf.ts';
import {
  PASSWORD,
  PDF,
  PRIVATE_FILE_ID,
  PRIVATE_NAME,
  ROW,
} from './fixtures.ts';

test('實際靜態建置：只有有效證書提供加密下載，所有產物不含私有資料', async (t) => {
  const outDir = await mkdtemp(join(tmpdir(), 'cert-verify-test-'));
  t.after(() => rm(outDir, { recursive: true, force: true }));
  const previousEnv = { ...process.env };
  t.after(() => {
    for (const name of [
      'GOOGLE_SHEET_ID',
      'GOOGLE_SERVICE_ACCOUNT_KEY',
      'GOOGLE_SHEET_RANGE',
    ]) {
      if (previousEnv[name] === undefined) delete process.env[name];
      else process.env[name] = previousEnv[name];
    }
  });
  process.env.GOOGLE_SHEET_ID = 'test-sheet';
  process.env.GOOGLE_SERVICE_ACCOUNT_KEY = JSON.stringify({
    client_email: 'fixture@example.invalid',
    private_key: 'private-key-test-only',
  });
  process.env.GOOGLE_SHEET_RANGE = '登記簿!A:K';
  t.mock.method(JWT.prototype, 'getAccessToken', async () => ({
    token: 'test-token',
  }));

  const rows = [
    ROW,
    { ...ROW, certificate_no: 'scaict_感_01' },
    {
      ...ROW,
      certificate_no: 'scaict-staff-11502',
      pdf_file_id: '',
      download_password: '',
    },
    { ...ROW, certificate_no: 'scaict-staff-11503', status: 'void' },
    { ...ROW, certificate_no: 'scaict-staff-11504', status: 'reissued' },
  ];
  const headers = Object.keys(ROW) as (keyof typeof ROW)[];
  let driveRequests = 0;
  t.mock.method(
    globalThis,
    'fetch',
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input);
      assert.equal(
        new Headers(init?.headers).get('Authorization'),
        'Bearer test-token',
      );
      if (url.hostname === 'sheets.googleapis.com') {
        assert.ok(decodeURIComponent(url.pathname).endsWith('登記簿!A:K'));
        return Response.json({
          values: [
            headers,
            ...rows.map((row) => headers.map((key) => row[key] ?? '')),
          ],
        });
      }
      assert.equal(url.hostname, 'www.googleapis.com');
      assert.equal(url.pathname, `/drive/v3/files/${PRIVATE_FILE_ID}`);
      assert.equal(url.searchParams.get('alt'), 'media');
      assert.equal(url.searchParams.get('supportsAllDrives'), 'true');
      driveRequests += 1;
      return new Response(PDF, {
        headers: { 'Content-Type': 'application/pdf' },
      });
    },
  );

  await build({
    root: fileURLToPath(new URL('../', import.meta.url)),
    outDir,
    logLevel: 'silent',
  });
  assert.equal(driveRequests, 2);
  const files = await readdir(outDir, { recursive: true });
  assert.equal(files.filter((file) => file.endsWith('.bin')).length, 2);
  assert.equal(
    files.some((file) => file.endsWith('.pdf')),
    false,
  );
  const downloaded = await readFile(
    join(outDir, 'downloads', `${ROW.certificate_no}.bin`),
  );
  assert.deepEqual(
    await decryptCertificatePdf(
      Uint8Array.from(downloaded).buffer,
      PASSWORD,
      ROW.certificate_no,
    ),
    PDF,
  );

  for (const row of rows) {
    const html = await readFile(
      join(outDir, row.certificate_no, 'index.html'),
      'utf8',
    );
    const available = row.status === 'valid' && Boolean(row.pdf_file_id);
    assert.equal(html.includes('id="pdf-download-form"'), available);
    if (available) {
      assert.ok(
        html.includes(
          `/downloads/${encodeURIComponent(row.certificate_no)}.bin`,
        ),
      );
      const encrypted = await readFile(
        join(outDir, 'downloads', `${row.certificate_no}.bin`),
      );
      assert.deepEqual(
        await decryptCertificatePdf(
          Uint8Array.from(encrypted).buffer,
          PASSWORD,
          row.certificate_no,
        ),
        PDF,
      );
    }
  }
  for (const file of files) {
    if (!/\.(html|js|css|json|bin|map)$/.test(file)) continue;
    const contents = await readFile(join(outDir, file));
    for (const secret of [
      PASSWORD,
      PRIVATE_NAME,
      PRIVATE_FILE_ID,
      'private-key-test-only',
      'CONFIDENTIAL_PDF_TEST_CONTENT',
    ]) {
      assert.equal(
        contents.includes(secret),
        false,
        `${file} 不可包含私有資料`,
      );
    }
  }
});
