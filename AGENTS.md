# QMS 年度內部稽核系統：專案指引

## 專案範圍

- 本專案是以 React、TypeScript、Vite、Tailwind CSS v4 建置的 QMS 年度內部稽核輔助工具。
- 先沿用既有元件、資料模型與頁面流程；避免為單一頁面複製共用行為。
- 目前狀態儲存在瀏覽器 `localStorage`。不得將本工具或其本機資料描述為組織的正式受控紀錄。

## 稽核語意與資料

- ISO 9001 與 AS9100 的適用性須依證書範圍、客戶／合約、法規及受控程序等證據確認；證據不足時標示待確認，不自行推定。
- 不得杜撰稽核證據、標準要求、缺失內容或產品／組織適用性。
- 修改資料結構、預設種子或儲存流程前，先確認既有使用者資料的相容性；不得以清除 `localStorage` 作為一般修復方式。
- 跨年度追蹤、雙公司資料及各類稽核表單的欄位語意須維持一致；需要改變時同步檢視所有讀寫頁面。
- 文案精簡只改 UI 包裝與系統訊息；保留使用者輸入、查檢表快照、`src/data/externalAuditPrep.seed.json` 的來源內容、列印來源標題及 QP／QR 識別字。驗證時分開比對 UI 與來源內容，不能以「移除舊文案」為由改寫正式來源。

### 稽核流程語意（2026-09 缺口修正後）

- **月格 `months`**：只存排程（`null`／`擬定`）；滿意等結果一律 `getDisplayMonthStatus`／`deriveMonthStatus` 推導，不可寫回 `months`。
- **查檢狀態**：非「執行中」不可判定；「已回報」鎖定。年度結案「尚未開始」只計**已排月格**（`isAuditScheduledInPlan`）；未排月格仍可開查檢，不擋結案。
- **程序風險**：依 QP 存 `procedureRisks`，按「存檔」才寫入；部門 O/S（利害關係人）不取代固有風險。
- **NCR**：`syncNCRDescriptions` 不覆寫 `description`；結案須矯正措施引用、效果確認引用、確認人、確認日四欄，`updateNCR` 回傳缺項給畫面。
- **觀察計數**：儀表板三數不可合併——查檢判定次數、本年度台帳 open、前年度 open（含封存）；實作見 `src/lib/dashboardMetrics.ts`。
- **任命與年度**：主任稽核員用 `resolveLeadAuditorPersonId`；內稽年度僅頁首切換；外稽日期僅外稽準備編輯並同步 `settings.externalAuditDate`；內部稽核完成為覆蓋推導唯讀。
- **深連結**：`src/lib/navigation.ts` 的 hash 支援 `record`（`recordId`）；待改善追蹤點列須開到 NCR／觀察／建議該筆並展開。

<!-- 文案邊界依據：2026-09-24「002#稽核介面文案精簡」；來源保留見 src/components/PreAuditPrep.tsx，列印識別驗證見 smoke-playwright.mjs。 -->

## UI 與可用性

- 維持稽核員可完成的完整流程，包含輸入、追蹤、查閱及列印；重要狀態須有文字說明，不可只靠顏色表達。
- UI-only 去重先比對操作、資料來源與狀態；NCR／觀察／建議、查檢表觀察判定數／待追蹤觀察數，以及桌面／窄螢幕導覽，不因名稱相似而合併。移除操作入口後，驗證保留入口仍可完成原流程。裝飾去重（`shadow-sm`、`backdrop-blur`、工作表整頁 `Card` 外框、卡內再包框、側欄藍卡第二回家、Guide 常駐 purpose、`PageToolbar` 與缺口條／頁首／列印重複說明、內容欄頁尾標語、設定「關於」、外稽準備色條進度、儀表板三類稽核重複補充）不改判定、計分或儲存；細節見 `.cursor/rules/ui-information-hierarchy.mdc`（側欄藍卡只顯示產品名不可點，回家僅「稽核總覽」；`plan`／`risk`／`stakeholders` 工具列不重複年度／任命／互代／已存檔 a/b）。`src/lib/navigation.ts` 的 `purpose`／entry／exit 仍供 workflow metadata，不在畫面顯示。側欄保留「資料儲存於本機 · v7」；外稽準備進度用可見 `準備清單 a/b`；NCR 自動匯入說明只在展開手動登錄區顯示。
- 主要導覽採左側選單，依稽核作業流程排列；專案基準與驗收條件見 `docs/web-ui-ux-sidebar-spec.md`。功能項目使用語意一致的圖示，側欄寬度依圖示與最長項目名稱的實際內容需求設定，不保留非必要空白。
- 表單欄位須有明確標籤、可見鍵盤焦點及可理解的錯誤提示；空白、載入、錯誤與成功狀態須有清楚回饋。
- 驗證桌面與窄螢幕版面；表單在窄螢幕逐項堆疊。捲動提示依表格在該寬度的實際 overflow 決定，不一律顯示，也不以全域窄螢幕 CSS 隱藏仍需水平捲動的表格提示。
- 長中文內容不得靜默截斷；需要限制顯示時，應讓使用者能查看完整內容。
- 純視覺調整不得改變稽核判定、評分公式、狀態或資料意義。
- 精簡完成度逐項對照核准計畫：年度計畫套用 `stacked-table`／`data-label` 不等於完成低頻欄位詳細區，共用 class 不等於操作與回饋位置已一致；替代方案、未實作與未驗證項目分開回報。

<!-- 精簡驗收依據：2026-09-24「002#可精簡 UI/UX 設計盤點與分階段精簡計畫」；2026-09-24「刪除多餘畫面框與常駐說明」（Guide 缺口-only、工作表去 Card、年度計畫去重複 meta／頁尾小卡）；2026-09-24「刪除重複畫面裝飾」（頁尾標語、設定關於、外稽 meta／色條、NCR 常駐說明、儀表板三類稽核補充）；2026-09-24「移除重複說明與第二回家」（藍卡不可點、plan／risk／stakeholders 去 PageToolbar meta 與風險頁尾計數卡）。 -->

## 驗證與 Git

- 依變更範圍使用 `npm run lint`、`npm test` 與 `npm run build`；UI 變更另檢查 375／768／1280／1536px 實際呈現與鍵盤操作，涉及收合區時檢查收合後列印內容。僅有 DOM 文字或無整頁 overflow 的檢查，不能取代可讀性、互動與列印驗收。側欄 smoke 斷言產品名須容忍桌面／窄螢幕雙 DOM（`getAllByText`）；`lazy` 分頁測試全套件易逾時，可 `beforeAll` 預載該 chunk。
- 開始前先檢查 `git status` 並保留既有變更；不得重設、清理或覆蓋不屬於目前工作的檔案。
- 未經使用者明確要求，不建立提交、不推送、不整合至受保護分支，也不清除或重建使用者資料。
- 提交前核對 `workgit.ps1` 現行行為：`start` 要求乾淨工作樹，`save` 會 `add -A`。依 staged／unstaged／untracked 清單確認是否符合已授權範圍；使用者已授權 `commit all` 且範圍未變時直接沿用。guard 不支援目前狀態時回報缺少的受控操作，不改用直接 Git mutation 或要求使用者代跑來規避。
- 執行 `save` 前，在預定提交的執行環境以 `git var GIT_AUTHOR_IDENT`、`git var GIT_COMMITTER_IDENT` 驗證身分；缺值先查現有設定與讀取權限，仍無法確認才詢問。不得由舊 commit 作者或示例地址推定本次身分，也不承諾 guard 尚未支援的 config 寫入。
- `save` 失敗不代表未變更 index。以 `git status --short`、`git diff --cached --stat`、`git rev-parse HEAD` 讀回暫存區與 HEAD，分別回報 staging、commit、push 是否完成；保留現狀，重試前重新核對範圍。

<!-- 提交依據：2026-09-24 本任務 commit all 的 staging 成功／identity 失敗紀錄；行為已對照 C:/Users/user/.codex/bin/workgit.ps1 的 start/save 實作。 -->
