# SCAICT 證書查驗系統

依 [SCAICT 證書編號標準規範](https://hackmd.io/@SCAICT/證書標準) 第 14 條建立的證書查驗網站，部署於 `verify.scaict.org`。

輸入或掃描證書上的查驗連結 `https://verify.scaict.org/{certificate_no}/`，
即可查詢該證書的類別、發證日期、狀態（有效／已作廢／已補發），並以遮罩姓名
（如「中○喵」）呈現持有人，不會顯示完整姓名。

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
