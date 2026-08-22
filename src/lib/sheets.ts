import { JWT } from 'google-auth-library';

export interface RawSheetRow {
  certificate_no: string;
  type_code: string;
  roc_year: string;
  serial: string;
  holder_name: string;
  activity_name: string;
  issued_date: string;
  status: string;
  remark: string;
}

/**
 * 讀取 Google 試算表登記簿原始資料列。
 * 未設定 GOOGLE_SHEET_ID / GOOGLE_SERVICE_ACCOUNT_KEY 時（例如本機開發），
 * 改用 sampleData.ts 的範例資料，方便無憑證也能跑 `pnpm build` / `pnpm dev`。
 */
export async function fetchRegistryRows(): Promise<RawSheetRow[]> {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const range = process.env.GOOGLE_SHEET_RANGE ?? '登記簿!A:I';

  if (!sheetId || !keyJson) {
    console.warn(
      '[cert-verify] 未設定 GOOGLE_SHEET_ID / GOOGLE_SERVICE_ACCOUNT_KEY，改用本地範例資料建置（僅供開發測試，正式部署前必須設定）。',
    );
    const { SAMPLE_ROWS } = await import('./sampleData');
    return SAMPLE_ROWS;
  }

  const credentials = JSON.parse(keyJson) as {
    client_email: string;
    private_key: string;
  };

  const auth = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const { token } = await auth.getAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(
      `[cert-verify] 讀取 Google 試算表失敗：${res.status} ${res.statusText}`,
    );
  }

  const data = (await res.json()) as { values?: string[][] };
  const rows = data.values ?? [];
  const [header, ...body] = rows;
  if (!header) return [];

  const keys = header.map((h) => h.trim());

  return body
    .filter((row) => row.length > 0 && row[0])
    .map((row) => {
      const record: Record<string, string> = {};
      keys.forEach((key, i) => {
        record[key] = row[i] ?? '';
      });
      return record as unknown as RawSheetRow;
    });
}
