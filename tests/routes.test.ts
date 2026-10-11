import assert from 'node:assert/strict';
import { test } from 'node:test';
import { certificateRouteId, routeSecret } from '../src/lib/routes.ts';
import {
  certificateLookupHash,
  resolveCertificateUrl,
} from '../src/lib/lookup.ts';

const SECRET = 'fixture-url-secret-at-least-32-characters';

test('查驗代碼固定、區分不同證書及金鑰，且不是公開編號的雜湊', async () => {
  const id = certificateRouteId('scaict-staff-11401', SECRET);
  assert.match(id, /^[a-f0-9]{64}$/);
  assert.equal(certificateRouteId(' SCAICT-STAFF-11401 ', SECRET), id);
  assert.notEqual(certificateRouteId('scaict-staff-11402', SECRET), id);
  assert.notEqual(
    certificateRouteId('scaict-staff-11401', `${SECRET}-other`),
    id,
  );
  assert.notEqual(await certificateLookupHash('scaict-staff-11401'), id);
});

test('正式 Google 資料缺少網址金鑰或金鑰太短時阻止建置', (t) => {
  const previousEnv = { ...process.env };
  const names = [
    'GOOGLE_SHEET_ID',
    'GOOGLE_SERVICE_ACCOUNT_KEY',
    'CERTIFICATE_URL_SECRET',
  ];
  t.after(() => {
    for (const name of names) {
      if (previousEnv[name] === undefined) delete process.env[name];
      else process.env[name] = previousEnv[name];
    }
  });
  process.env.GOOGLE_SHEET_ID = 'fixture-sheet';
  process.env.GOOGLE_SERVICE_ACCOUNT_KEY = 'fixture-key';
  delete process.env.CERTIFICATE_URL_SECRET;
  assert.throws(() => routeSecret(), /CERTIFICATE_URL_SECRET/);
  process.env.CERTIFICATE_URL_SECRET = 'short';
  assert.throws(() => routeSecret(), /CERTIFICATE_URL_SECRET/);
});

test('輸入編號與新舊完整網址均導向不含編號的查驗頁', async (t) => {
  const certificateNo = 'scaict_感_01';
  const id = certificateRouteId(certificateNo, SECRET);
  const hash = await certificateLookupHash(certificateNo);
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    assert.equal(url, `/lookup/${hash}.json`);
    requests++;
    return Response.json({ url: `/${id}/` });
  });
  for (const value of [
    certificateNo,
    `https://verify.scaict.org/${encodeURIComponent(certificateNo)}/`,
  ]) {
    assert.equal(await resolveCertificateUrl(value), `/${id}/`);
  }
  assert.equal(
    await resolveCertificateUrl(`https://verify.scaict.org/${id}/`),
    `/${id}/`,
  );
  assert.equal(requests, 2);
});

test('查無證書與網路錯誤分開處理，拒絕非本站的回傳網址', async (t) => {
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response(null, { status: 404 }),
  );
  assert.equal(await resolveCertificateUrl('unknown'), undefined);
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response(null, { status: 500 }),
  );
  await assert.rejects(resolveCertificateUrl('unknown'), /暫時無法使用/);
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ url: 'https://example.com/' }),
  );
  await assert.rejects(resolveCertificateUrl('unknown'), /格式錯誤/);
});
