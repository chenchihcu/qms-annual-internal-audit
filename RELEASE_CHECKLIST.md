# Current Local Release Readiness

本文件先記錄目前工作樹的驗收狀態；下方 v6 發佈資料是歷史紀錄，不代表目前版本。

## Current worktree

| Gate | Result | Evidence |
| --- | --- | --- |
| 儲存格式 | verified | 43124 的完整 JSON 備份通過 `scripts\verify.ps1 -Mode local-backup`；檔案版本 v14，與 `SINGLE_WORKSPACE_STORAGE_VERSION=14` 相同。未對使用者資料執行遷移。 |
| Lint | verified | 本輪 `scripts\verify.ps1 -Mode all` 內含 lint，完成且未回報錯誤。 |
| Tests | verified | 本輪完整固定驗證：63 files / 359 tests passed；完整 gate 輸出 `event=verification result=ok verification_marker=true`。 |
| Build | verified | 同一完整 gate 的 TypeScript 專案檢查與 Vite production build 通過。 |
| Dependency audit | verified | `scripts\audit-dependencies.ps1`：`npm audit --audit-level=low` 回報 0 vulnerabilities。未使用的 `xlsx` 依賴已移除，Excel 匯出仍由 `src/lib/simpleXlsx.ts` 提供。 |
| 本機啟動 | verified | `package.json` 將開發與預覽服務固定在 `127.0.0.1:43124` 並啟用 `--strictPort`；Windows 啟動器在伺服器成功啟動後才開啟瀏覽器，避免自動換埠造成另一份 localStorage。 |
| Browser | verified | 僅以 `http://127.0.0.1:43124/` 為驗收對象。完整 browser smoke 在 320／375／768／1280／1536px 各檢查 12 頁（現行側欄命名），0 errors、0 page failures、0 print failures；1280px 的 25 項隔離工作流程涵蓋利害關係人編輯對話框標籤、方案風險分欄、觀察深連結展開列、查檢客觀性與完成回報鎖定等。設定頁 smoke 仍斷言已移除的證書／稽核基本資料標題不存在。 |
| 年度計畫表格 | verified | 43124 實際頁面截圖確認 QR-28-04 在 QP 欄保持單行；12 個月份的寬矩陣保留界內水平捲動提示，31 列以每頁 10 筆分頁。 |
| 工作區範圍 | partial | 導覽與外稽準備畫面使用單一工作區、沒有公司切換或公司別篩選；外稽準備逐句隱去舊法人抬頭／公司適用範圍指示，同列的通用檢查句仍保留，來源種子未改寫。NCR 清單與追蹤列已隱去歷史公司尾碼並處理同號顯示，localStorage 原始編號未改寫。查檢表以顯示層統一舊雙公司題目與分類，題號、列數、判定、得分、原始來源及既有稽核快照不變；重複 NCR-2023-01 僅作待覆核參考。適用證書／受控程序仍待核對。 |
| 實際作業前提 | not verified | 43124 系統設定目前顯示 ISO 9001 版本 2015、AS9100 版本 2016 (Rev D)，兩者適用性欄位均標為「已確認」；同一張證書的範圍與依據仍空白，QP-28 版次顯示待確認，正式紀錄保存位置空白。ISO 9001:2026 已發布，但現有設定未自動改寫；實際證書適用版本、驗證機構轉版安排，以及查檢表是否對應適用版本尚未依受控依據核實。本輪未猜填資料，也未開始稽核。 |
| Migration backup | verified | 43124 系統設定下載的 `QMS備份_2026_2026-09-26T13-42-42-984Z.json` 經 `scripts\verify.ps1 -Mode local-backup` 驗證通過：v14、74,417 bytes，SHA-256 `EFC9860F5E605B80A530FD9B04806934978A21720705A52C454D3F126FE5FFDF`。目前格式已是 v14，沒有執行遷移或修改 localStorage。 |
| Deployment | verified | 發佈前 production deploy `6ab9c34d0b827900087f6905`（site `3c4efad3-ce7b-4c46-80ab-f6af9992870b`／`as9100qms`）。`deploy-netlify-production.ps1` 產出 production deploy `6ab9d2260daf0259a8e4eb5a` → `https://as9100qms.netlify.app/`。`verify-netlify-production.mjs`：bundle `/assets/index-CDcHuFxu.js` 與本機 `dist` 一致；375／768／1280／1536 × 12 頁，0 findings。 |

本機程式、隔離操作流程與 Netlify production 靜態發佈驗證已通過；實際稽核作業仍未具備可核實的證書範圍／引用、QP-28 程序版次、正式紀錄保存位置與查檢表版本對應，不能把這些缺項視為組織正式受控紀錄已就緒。

**殘餘風險：**儲存版本仍為 v14，本輪未執行遷移或改動瀏覽器 localStorage。Production 為靜態 SPA，使用者資料仍在各瀏覽器本機、未加密。若需還原發佈前版本，Netlify deploy `6ab9c34d0b827900087f6905` 仍保留於 deploy 歷史。隔離 smoke 不取代使用者以正式資料逐頁驗收完整 CRUD／篩選及列印。

**下一檢查：**依有效證書、客戶／合約、法規、驗證機構轉版安排及受控程序核實標準版次／適用性，補齊共用證書引用與範圍、QP-28 版次、正式紀錄保存位置，再核對適用查檢表及稽核員資格／計畫。現存 v14 資料不需遷移。

## Historical v6 release evidence

Release target: v6 人員資格、年度／事件、觀察台帳與十頁版型 release candidate

## Gate 1 — Artifact Verification

| Check | Result | Evidence |
|-------|--------|----------|
| `npm run lint` | PASS | oxlint 0 errors |
| `npm test` | PASS | 13 files / 74 tests |
| `npm run build` | not verified | Local command policy rejected this npm wrapper; equivalent `tsc -b` and `vite build` passed and produced dist/ |
| `npm audit --omit=dev --audit-level=high` | PASS | production dependencies: 0 vulnerabilities |

## Gate 2 — Environment Parity

| Check | Result | Evidence |
|-------|--------|----------|
| v6 key load | PASS | `useAuditStore.migration.test.ts` |
| v5 / v4 → v6 migrate | PASS | `useAuditStore.migration.test.ts` |
| Damaged/unknown v6 data write protection | PASS | `useAuditStore.migration.test.ts` |
| `getOrCreateAudit` no-throw stub | PASS | `useAuditStore.migration.test.ts` |

## Gate 3 — Smoke & Sanity

| Check | Result | Evidence |
|-------|--------|----------|
| Dev server (43123) ten pages | PASS | `verify-v6.mjs` + `App.smoke.test.tsx` |
| 375 / 768 / 1280 / 1536 responsive | PASS | `verify-v6.mjs`, screenshots in `artifacts/v6-visual/` |
| Home button, person form, company switch | PASS | `verify-v6.mjs` + focused tests |
| Preview bundle (43124) core pages | PASS | `verify-v6.mjs` |
| Netlify production 10 pages × 4 widths | PASS | `verify-netlify-production.mjs`: 0 findings; entry asset `/assets/index-B_J6f67F.js` matches local dist |

**Production deploy:** PASS. User approved publication; owner account and site ID `3c4efad3-ce7b-4c46-80ab-f6af9992870b` verified before both deployments. Private preview `6aaa9258fe77d24814611ec2` loaded in the authenticated browser. Production deploy `6aaa937e07259de32085eb77` serves `https://as9100qms.netlify.app/`. Unauthenticated access to the private preview returns 401 by design; its full remote page matrix was not tested, while the published production matrix passed.

## Gate 4 — Rollback Preparedness

| Layer | Action |
|-------|--------|
| Code | Prior published Netlify deploy `6aa7a6e381bc5300082a822a` remains in deploy history for rollback |
| User data | Settings → Export JSON; v5/v4 keys remain readable by v6 migration |
| Emergency | zip workspace (exclude node_modules, .git, dist) + SHA256 |

## User Upgrade Steps

1. Export JSON backup（設定頁）
2. Open the v6 site; v5/v4/v1 data migrate on load
3. Verify company, year, personnel qualification and open NCR counts
4. Keep the downloaded JSON for rollback; do not use clear-all as the first recovery action

## Latest verification - 2026-09-28

| Gate | Result | Evidence |
| --- | --- | --- |
| Lint / tests / build / browser | verified | `scripts\verify.ps1 -Mode all` → `event=verification result=ok verification_marker=true checks=lint,tests,build,browser-smoke`；63 files / 359 tests。 |
| Dependency audit | verified | `scripts\audit-dependencies.ps1` → 0 vulnerabilities。 |
| Netlify production | verified | Deploy `6ab9d2260daf0259a8e4eb5a`；遠端 smoke `verify-netlify-production.mjs` 0 findings。 |
| Harness events.jsonl | not verified | 本輪未讀回 `events.jsonl` 是否入帳。 |

證書範圍與引用、QP-28 版次及正式紀錄保存位置仍缺受控依據；本輪未猜填、未把本機工具資料升格為組織正式受控紀錄。
