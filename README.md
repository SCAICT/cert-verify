# SCAICT 證書查驗系統

依 [SCAICT 證書編號標準規範](https://hackmd.io/@SCAICT/證書標準) 第 14 條建立的證書查驗網站，部署於 `verify.scaict.org`。

輸入或掃描證書上的查驗連結 `https://verify.scaict.org/{certificate_no}/`，
即可查詢該證書的類別、發證日期、狀態（有效／已作廢／已補發），並以遮罩姓名
（如「王○明」）呈現持有人，不會顯示完整姓名。

## 架構

- **Astro（`output: 'static'`）**：建置時透過 `getStaticPaths()` 依登記簿每一列
  資料各自產生一頁純靜態 HTML，網址即為 `/{certificate_no}/`，不需要任何
  client-side 路由技巧或查詢字串。
- **資料來源：Google 試算表**：建置時以 Service Account 直接讀取試算表登記簿
  （對應附錄 B 欄位），在讀到資料的當下就完成姓名遮罩、並捨棄
  `activity_name` / `remark` / `serial` 等不應公開的欄位，未遮罩的完整姓名
  不會寫入任何建置產物或 git 記錄。
- **部署：GitHub Pages（本 repo 自己的 Pages，非 SCAICT.github.io）**，透過
  `.github/workflows/deploy.yml` 建置後部署，並用 `public/CNAME` 指定
  `verify.scaict.org` 這個自訂網域。

## 設定 Google 試算表串接

1. 到 [Google Cloud Console](https://console.cloud.google.com/) 建立（或使用既有）專案，
   啟用 **Google Sheets API**，並建立一組 **Service Account**，下載其 JSON 金鑰。
2. 將登記簿試算表分享給該 Service Account 的信箱（`xxx@xxx.iam.gserviceaccount.com`），
   權限設為「檢視者」即可（唯讀，不需要編輯權限）。
3. 在本 repo 的 GitHub Settings → Secrets and variables → Actions 新增：
   - `GOOGLE_SHEET_ID`：試算表網址中 `/d/` 與 `/edit` 之間的那段 ID
   - `GOOGLE_SERVICE_ACCOUNT_KEY`：下載的整份 JSON 金鑰內容（原封不動貼上）
   - （選填）Repository variable `GOOGLE_SHEET_RANGE`：分頁名稱與範圍，
     預設為 `登記簿!A:I`，對應附錄 B 欄位順序
     `certificate_no, type_code, roc_year, serial, holder_name, activity_name, issued_date, status, remark`。
4. 未設定上述 Secrets 時（例如本機開發），會自動改用
   [`src/lib/sampleData.ts`](./src/lib/sampleData.ts) 的範例資料建置，
   方便在沒有憑證的情況下也能跑 `pnpm dev` / `pnpm build`。

## 自訂網域 DNS 設定（需在 DNS 供應商操作，此 repo 內無法完成）

在 `scaict.org` 的 DNS 設定（例如 Cloudflare）新增一筆：

```
CNAME  verify  SCAICT.github.io
```

並在本 repo 的 GitHub Settings → Pages 確認 Custom domain 已顯示為
`verify.scaict.org` 且 HTTPS 憑證已核發完成（`public/CNAME` 檔案會在部署後
由 GitHub Pages 自動讀取設定，但第一次仍需等待 DNS 生效與憑證簽發）。

## 重新建置時機

- 每次 push 到 `main`。
- 排程：每 6 小時自動重建一次，讓試算表的異動（新發證、作廢、補發）
  不需要人工介入就能反映到網站上。
- 手動：GitHub Actions 頁面對 `Build and deploy verify site` 按
  `Run workflow`，適合剛核發完證書、想立刻更新的情況。

## 本機開發

```sh
pnpm install
pnpm dev       # http://localhost:4321
pnpm build     # 產出 ./dist
pnpm preview   # 本機預覽建置結果
```

## 遮罩規則

見 [`src/lib/mask.ts`](./src/lib/mask.ts)：3 字以上姓名保留首尾、中間以單一
「○」取代（如「王小明」→「王○明」）；2 字姓名保留姓氏、名字整個遮罩；
1 字姓名完全遮罩。1、2 字的規則為本專案延伸定義，證書標準原文僅示範 3 字姓名。

## 已知待確認事項

- Google 試算表 ID、分頁名稱與實際欄位是否與附錄 B 完全一致，需行政組確認。
- 排程重建頻率（目前預設每 6 小時）可依實際發證頻率調整。
- 「補發後連結至最新編號」為本專案依 `-r{n}` 後綴慣例推論出的加強功能，
  非規範明文要求，如不需要可移除 `src/lib/certificates.ts` 中相關邏輯。