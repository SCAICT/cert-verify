# SCAICT 證書查驗系統

依 [SCAICT 證書編號標準規範](https://hackmd.io/@SCAICT/證書標準) 第 14 條建立的證書查驗網站，部署於 `verify.scaict.org`。

在首頁輸入證書編號，或掃描證書上的查驗連結 `https://verify.scaict.org/{route_id}/`，
即可查詢該證書的類別、發證日期、狀態（有效／已作廢／已補發），並以遮罩姓名
（如「中○喵」）呈現持有人，不會顯示完整姓名。

有提供電子檔的有效證書，查驗頁另有「下載 PDF 電子檔」區塊。
持有人輸入核發時收到的專屬密碼，即可下載該張證書的 PDF。

## 架構

- **Astro（`output: 'static'`）**：建置時透過 `getStaticPaths()` 依登記簿每一列
  資料各自產生一頁純靜態 HTML，網址為 `/{route_id}/`，不含明文證書編號。
  首頁透過編號的 SHA-256 查詢個別靜態索引，再前往對應頁面。
- **資料來源：Google 試算表**：建置時以 Service Account 直接讀取試算表登記簿
  （對應附錄 B 欄位），在讀到資料的當下就完成姓名遮罩、並捨棄
  `activity_name` / `remark` / `serial` 等不應公開的欄位，未遮罩的完整姓名
  不會寫入任何建置產物或 git 記錄。
- **部署：GitHub Pages（本 repo 自己的 Pages，非 SCAICT.github.io）**，透過
  `.github/workflows/deploy.yml` 建置後部署，並用 `public/CNAME` 指定
  `verify.scaict.org` 這個自訂網域。
- **電子檔：Google Drive → 建置時加密 → 瀏覽器解密**：Service Account
  讀取私有 PDF 後，使用每張證書的密碼加密為 `/downloads/{route_id}.bin`。
  網站只發布密文；Drive 檔案 ID、密碼、原始 PDF 都不會寫入公開建置產物。
  持有人輸入的密碼只用於瀏覽器中的解密，不會傳送到 Google 或網站伺服器。

## 查驗網址設定

GitHub Actions 的 Repository secret 請新增 **`CERTIFICATE_URL_SECRET`**，
內容為至少 32 字元的隨機金鑰（建議使用 32 隨機位元組的 64 碼十六進位字串）。
建置時以 HMAC-SHA-256 將證書編號轉成固定的 64 碼不透明網址代碼，
金鑰不會發布到網站。同一金鑰與編號在每次重建時都會得到相同網址；
更換金鑰會改變所有查驗及下載網址，請妥善保存。

首頁接受證書編號及新舊查驗網址。已印製的 `/{certificate_no}/` 舊網址
會由 404 頁的 JavaScript 轉到新網址，不再發布以證書編號命名的查驗頁。
新 QR Code 請使用 `/{route_id}/` 網址；查驗頁內容仍會顯示證書編號。
不透明網址用於隱藏網址中的編號，首頁的編號查驗仍是公開功能；PDF 仍需下載密碼。

未提供 Google 憑證時，範例資料使用固定的本機開發金鑰；正式資料缺少網址金鑰
或金鑰太短時會讓建置失敗。

## 設定 PDF 密碼下載

### 1. Google Drive

1. 在 Service Account 所屬的 Google Cloud 專案啟用 **Google Drive API**。
2. 上傳已製作好的 PDF（每個檔案最多 20 MiB）。
3. 將 PDF 或所屬資料夾分享給現有 Service Account 的 `client_email`，權限設為
   **檢視者**，並保留下載權限。一般存取權維持「受限制」。
4. 從分享網址取得檔案 ID，例如
   `https://drive.google.com/file/d/檔案ID/view` 中的 `檔案ID`。

沿用現有的 `GOOGLE_SERVICE_ACCOUNT_KEY`，不需要新增另一組金鑰。
支援一般雲端硬碟及共用雲端硬碟中的 PDF；Google 文件或捷徑請先轉成 PDF 上傳。

### 2. Google 試算表

在登記簿原本 A～I 欄後新增兩欄，第一列標題必須使用以下名稱：

| 欄位 | 標題                | 內容                                       |
| ---- | ------------------- | ------------------------------------------ |
| J    | `pdf_file_id`       | 該張證書的 Google Drive 檔案 ID（只填 ID） |
| K    | `download_password` | 該張證書的下載密碼                         |

- 密碼欄請設為「純文字」。每組至少 12 個字元（不計頭尾空白），建議使用
  16 個以上的隨機英數字元，並個別通知持有人。解密時會精確比對，包含大小寫及空白。
- 兩欄都留空代表不提供電子檔；只填一欄、密碼太短、無法讀取 PDF 或檔案格式錯誤，
  都會讓建置失敗，錯誤訊息會指出證書編號。
- 只有 `status` 為 `valid`（或沿用原有規則留空視為有效）的證書會產生電子檔。
  `void`、`reissued` 不會讀取或發布 PDF；補發檔案請填在新編號的資料列。

預設讀取範圍已擴大為 `登記簿!A:K`。**如果 GitHub Actions 的 Repository variable
`GOOGLE_SHEET_RANGE` 已設為 `登記簿!A:I`，請改成 `登記簿!A:K`**
（工作表名稱依實際設定）。舊試算表未新增欄位時仍可正常查驗。

### 3. 建置與使用

更新後手動執行 GitHub Actions 的 `Build and deploy verify site`，或等待排程重建。
部署完成後，開啟該張證書的查驗頁，輸入密碼並按「下載 PDF」，檔名為
`{certificate_no}.pdf`。瀏覽器需支援 Web Crypto，網站需使用 HTTPS
（本機 `localhost` 也可）。

### 加密方式與更新

使用 Web Crypto 的 **PBKDF2-SHA-256（600,000 次）與 AES-256-GCM**。
每次加密使用隨機 salt 與 IV，並將證書編號納入驗證，防止不同證書的檔案被調換。

這是靜態加密下載：任何人都能取得 `.bin` 密文，密碼強度決定離線猜測的難度，
因此請使用獨立的隨機密碼，不要使用生日或證書編號。
更換密碼、PDF、作廢狀態或移除下載設定，都要重新建置部署才會生效；
已被保存的舊密文仍可用舊密碼解密，已下載的 PDF 也無法收回。

## 重新建置時機

- 每次 push 到 `main`。
- 排程：每 6 小時自動重建一次，讓試算表的異動（新發證、作廢、補發）
  不需要人工介入就能反映到網站上。
- 手動：GitHub Actions 頁面對 `Build and deploy verify site` 按
  `Run workflow`，適合剛核發完證書、想立刻更新的情況。

## 本機開發

```sh
pnpm install
pnpm dev --background # http://localhost:4321
pnpm build     # 產出 ./dist
pnpm preview   # 本機預覽建置結果
pnpm check     # Astro / TypeScript 檢查
pnpm test      # 加解密、下載條件與實際靜態建置測試
```

背景開發伺服器可用 `pnpm astro dev status`、`pnpm astro dev logs`、
`pnpm astro dev stop` 管理。修改試算表後請重新啟動開發伺服器，讓登記簿重新載入。

建置端從 `process.env` 讀取 `GOOGLE_SHEET_ID`、`GOOGLE_SERVICE_ACCOUNT_KEY`
與選填的 `GOOGLE_SHEET_RANGE`；使用正式資料時另需 `CERTIFICATE_URL_SECRET`。
若將這些值放在本機 `.env`，可用 Node 載入後執行：

```sh
node --env-file=.env ./node_modules/astro/bin/astro.mjs build
node --env-file=.env ./node_modules/astro/bin/astro.mjs dev --background
```

未提供 Google 憑證時使用原有範例資料，不會提供真實 PDF。
自動測試使用模擬的 Google 回應與測試 PDF，不會存取正式試算表或雲端硬碟。
