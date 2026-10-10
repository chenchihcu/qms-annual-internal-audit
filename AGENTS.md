# QMS 年度內部稽核系統：專案指引

## 專案範圍

- 本專案是以 React、TypeScript、Vite、Tailwind CSS v4 建置的 QMS 年度內部稽核輔助工具。
- 先沿用既有元件、資料模型與頁面流程；避免為單一頁面複製共用行為。
- 目前狀態儲存在瀏覽器 `localStorage`。不得將本工具或其本機資料描述為組織的正式受控紀錄。

## 稽核語意與資料

- ISO 9001 與 AS9100 的適用性須依證書範圍、客戶／合約、法規及受控程序等證據確認；證據不足時標示待確認，不自行推定。
- 不得杜撰稽核證據、標準要求、缺失內容或產品／組織適用性。
- 修改資料結構、預設種子或儲存流程前，先確認既有使用者資料的相容性；不得以清除 `localStorage` 作為一般修復方式。
- 人員、稽核計畫、查檢與改善使用單一工作區；雙公司欄位只作舊資料相容，不重建公司切換。跨年度與各表單的語意變更須同步檢視所有讀寫頁面。
- 本案共用一張證書，證書範圍／引用只記錄一次；ISO 9001、AS9100 各自保留版本與適用性。不得將本案共用證書推定為所有組織的固定關係。
- 單一工作區遷移沿用已核准規格：讀到 v14 或更舊鍵時在瀏覽器內升級並寫入 v15，舊鍵保留；無衝突合併、矛盾待覆核、查檢判定不猜測。升級後請用設定頁下載 v15 完整備份。自建資料刪除先進可還原回收區，永久清除另確認。
- SCMH、指導手冊及歷史表單須保留來源與年代；只採用已核對適用性的資訊，不將指導資料或舊版內容直接升格為現行強制要求。
- 文案精簡只改 UI 包裝與系統訊息；保留使用者輸入、查檢表快照、`src/data/externalAuditPrep.seed.json` 的來源內容、列印來源標題及 QP／QR 識別字。驗證時分開比對 UI 與來源內容，不能以「移除舊文案」為由改寫正式來源。

### 稽核流程語意（2026-09 缺口修正後）

- **月格 `months`**：只存排程（`null`／`擬定`）；滿意等結果一律 `getDisplayMonthStatus`／`deriveMonthStatus` 推導，不可寫回 `months`。
- **查檢狀態**：非「執行中」不可判定；「已回報」鎖定。年度結案「尚未開始」只計**已排月格**（`isAuditScheduledInPlan`）；未排月格仍可開查檢，不擋結案。
- **程序風險**：依 QP 存 `procedureRisks`，按「存檔」才寫入；部門 O/S（利害關係人）不取代固有風險。
- **NCR**：`syncNCRDescriptions` 不覆寫 `description`；結案須矯正措施引用、效果確認引用、確認人、確認日四欄，`updateNCR` 回傳缺項給畫面。畫面與 NCR 匯出顯示 `companyScope` 時用 `ncrCompanyScopeLabel`（`src/lib/certificateScope.ts`）；`both`／空不顯示成雙證書公司名，舊 `jiurun`／`zhenglongxing` 仍顯示。檢查：`src/lib/__tests__/certificateScope.test.ts`。
- **觀察計數**：儀表板三數不可合併——查檢判定次數、本年度台帳 open、前年度 open（含封存）；實作見 `src/lib/dashboardMetrics.ts`。
- **任命與年度**：主任稽核員用 `resolveLeadAuditorPersonId`；內稽年度僅頁首切換；外稽日期僅在查檢表的「外稽準備」檢視編輯並同步 `settings.externalAuditDate`，讀取一律用 `effectiveExternalAuditDate`；內部稽核完成為覆蓋推導唯讀。
- **外稽準備併入查檢表（2026-10-09）**：外稽準備是查檢表的檢視模式（`#tab=prep`，`TabEntry.viewOf='audit'`），側欄只留「查檢表」。準備任務唯一來源仍是 `externalAuditPrep`，查檢判定仍在 `ProcedureAudit`；兩者只用種子 `linkedQp` 讀取關聯（`src/lib/prepLinks.ts`），不互寫、不把準備項變成查檢題、不依判定自動勾選。第 4 項與序位「2 管審」是單一控制（`setManagementReviewComplete` 同步寫兩欄）；完成狀態一律讀 `prepItemCompleted`，兩值不一致只標「待覆核」。系統檢核提示（2-a 覆蓋、2-b／2-c 未結 NCR、第 4 項管審前置、第 7 項管代任命）只讀。檢查：`src/lib/__tests__/prepLinks.test.ts` 23 項對照。
- **利害關係人併入方案風險（2026-10-09）**：利害關係人是方案風險的檢視模式（`#tab=stakeholders`，`TabEntry.viewOf='risk'`），側欄只留「方案風險」；頁內「程序風險｜部門利害關係人」切換（`ViewSwitch`）。資料、缺口導向與 O／S 語意不變，部門 O／S 仍不取代固有風險。
- **程序相關部門**：查檢表顯示「被稽核部門」（依年度計畫列，不可改）與「程序相關部門」（`procedureRelatedDepartments`：年度計畫同 QP 的所有部門，只讀推導不另存）。它與利害關係人標籤（4.2 相關方：客戶、供應商等）是不同概念，不互相取代；不依計畫以外的來源推定程序涉及部門。
- **深連結**：`src/lib/navigation.ts` 的 hash 支援 `record`（`recordId`）；待改善追蹤點列須開到 NCR／觀察／建議該筆並展開。
- **查檢種子與部門名**：題目基準在 `src/data/checklists.seed.json`，查詢鍵為 `QP|部門`（`resolveProcedureSeed`／`getSeedChecklistQuestions`）。年度計畫 `proceduresRaw.department`（例：開發工程部）與部門主檔 `DepartmentProfile.name`（例：開發工程）可能不一致；`procedurePlan.ts` 的 `DEPT_ID` 與 `checklistLoader` 的部門別名須同步維護。畫面「查檢項目待匯入」先查別名與 `localStorage` 是否只剩占位，不可直接判定種子未上傳。
- **待匯入占位刷新**：僅當稽核項目全是未填寫的「待匯入」、且狀態非「已回報」時，才可用種子題目取代（`refreshedSeedItemsIfPendingOnly`／`getOrCreateAudit`）。已有判定、說明或證據的快照不覆寫；不得以清 `localStorage` 修復。
- **外部 QR-28-02 盤點**：與種子比對時以 `checklists.seed.json` 的年度與 `proceduresRaw` 為準（現行為 114 年度種子，非 112 原檔逐字複製）。114 增補題、NCR 附註與 `checklistItem.ts` 顯示層改寫，不因 112 Excel 盤點而覆寫種子或使用者快照。

<!-- 文案邊界依據：2026-09-24「002#稽核介面文案精簡」；來源保留見 src/components/PreAuditPrep.tsx，列印識別驗證見 smoke-playwright.mjs。 -->

## UI 與可用性

- 以內部稽核員／主任稽核員的桌機、筆電操作為設計目標；無權限管理及新增行動裝置 UI 的需求。既有窄視窗仍須保持主要操作可達。
- 畫面字級兩級（14px／12px）、盤點順序與列印／匯出例外見 `.cursor/rules/ui-information-hierarchy.mdc`「畫面字級」與「2026-09-28 畫面字級對齊（harvest）」；螢幕用工作表表頭 12px 以 `src/index.css` 的 `.worksheet-table thead th` 為 SSOT，勿在各頁 `th` 逐格加字級 class。字級優化先全庫盤點再改，未核准不把 body 或工作表升到 16px。
- 短碼、日期、狀態與人員用固定欄寬；自由文字在欄內換行並可查看全文。工作表先設 `table-fixed` 與 `colgroup`，空欄不塌縮、長文不撐欄；看到撐開再調比例不算完成。長清單沿用共用分頁，保留篩選、編輯、讀回與完整列印。
- 維持稽核員可完成的完整流程，包含輸入、追蹤、查閱及列印；重要狀態須有文字說明，不可只靠顏色表達。
- UI-only 去重先比對操作、資料來源與狀態；NCR／觀察／建議、查檢表觀察判定數／待追蹤觀察數，以及桌面／窄螢幕導覽，不因名稱相似而合併。移除操作入口後，驗證保留入口仍可完成原流程。裝飾去重（`shadow-sm`、`backdrop-blur`、工作表整頁 `Card` 外框、卡內再包框、側欄藍卡第二回家、Guide 常駐 purpose、`PageToolbar` 與缺口條／頁首／列印重複說明、內容欄頁尾標語、設定「關於」、外稽準備色條進度、儀表板三類稽核重複補充、查檢列「未判定」標籤與列底、台帳列上多顆按鈕〔每列只留一個主按鈕，次要動作在編輯卡／明細〕）不改判定、計分或儲存；細節見 `.cursor/rules/ui-information-hierarchy.mdc`（側欄藍卡只顯示產品名不可點，回家僅「稽核總覽」；`plan`／`risk`／`stakeholders` 工具列不重複年度／任命／互代／已存檔 a/b）。`src/lib/navigation.ts` 的 `purpose`／entry／exit 仍供 workflow metadata，不在畫面顯示。側欄保留「資料儲存於本機 · v15」；外稽準備進度用檢視切換的可見 `外稽準備 a/b`；NCR 自動匯入說明只在展開手動登錄區顯示。
- 主要導覽採左側選單，依稽核作業流程排列；專案基準與驗收條件見 `docs/web-ui-ux-sidebar-spec.md`。功能項目使用語意一致的圖示，側欄寬度依圖示與最長項目名稱的實際內容需求設定，不保留非必要空白。
- 表單欄位須有明確標籤、可見鍵盤焦點及可理解的錯誤提示；空白、載入、錯誤與成功狀態須有清楚回饋。
- 將欄位改為固定選單前，先由現行型別、資料來源或受控規範確認完整值域；敘述及外部自訂值保留自由輸入，數值無核准範圍時不造選項，混合內外部值可提供保留自訂值的提示清單。檢查：逐欄核對型別、既有值及實際選項。來源：2026-09-27 手動輸入與選單盤點。
- 驗證桌面與窄螢幕版面；表單在窄螢幕逐項堆疊。捲動提示依表格在該寬度的實際 overflow 決定，不一律顯示，也不以全域窄螢幕 CSS 隱藏仍需水平捲動的表格提示。
- 長中文內容不得靜默截斷；需要限制顯示時，應讓使用者能查看完整內容。
- 純視覺調整不得改變稽核判定、評分公式、狀態或資料意義。
- 內容去留以 AS9100／ISO 9001 條文與品質管理效益判斷（2026-10-10）：已移除程序得分／年度總分、進階評分設定、系統流程圖、總覽「已排月格」「外稽準備 a/b」、保存位置寫死預設；不補回。`scoringRules`、`linkType` 等持久欄位保留。風險來源「逃逸控制」關聯類型對應 AS9100 逃逸點，保留。
- 精簡完成度逐項對照核准計畫：年度計畫套用 `stacked-table`／`data-label` 不等於完成低頻欄位詳細區，共用 class 不等於操作與回饋位置已一致；替代方案、未實作與未驗證項目分開回報。

<!-- 精簡驗收依據：2026-09-24「002#可精簡 UI/UX 設計盤點與分階段精簡計畫」；2026-09-24「刪除多餘畫面框與常駐說明」（Guide 缺口-only、工作表去 Card、年度計畫去重複 meta／頁尾小卡）；2026-09-24「刪除重複畫面裝飾」（頁尾標語、設定關於、外稽 meta／色條、NCR 常駐說明、儀表板三類稽核補充）；2026-09-24「移除重複說明與第二回家」（藍卡不可點、plan／risk／stakeholders 去 PageToolbar meta 與風險頁尾計數卡）；2026-09-27 五頁低效益簡化（觀察主列只留狀態、查檢未同步獨立按鈕、利害關係人標籤不顯示權重、外稽序位一行且清單不分頁、證書一區兩欄網格只編輯 AS9100、方案風險無暫定欄）；2026-09-27 查檢列依判定顯示證據欄並移除「標不適用」。見 `.cursor/rules/ui-information-hierarchy.mdc`。 -->

## 驗證與 Git

- 唯一本機服務為 `http://127.0.0.1:43124/`；啟動、瀏覽器檢查與 smoke 固定使用此位置，不輪流檢查其他埠。手動開頁 hash 為 `#tab=<TabId>`（`parseAppHash`／`buildAppHash`），非 `#<tabId>`。43124 已被佔用代表 dev 已在跑，勿另判為必須重啟的失敗。（2026-09-27）
- 文件／技能修改使用內容、引用及治理檢查；只重跑本次修改會影響的 gate，不為取得 Harness marker 重跑無關產品全套測試。命令被啟動前拒絕、產品檢查失敗、Harness 事件未登錄須分開回報，無新證據不重複重試。
- Harness 識別：從 `functions.exec` 執行固定驗證器時，直接輸出 `exec_command` 的 stdout 原文，不用 `JSON.stringify` 包裝；完成後確認 `C:\Users\user\.codex\data\harness\events.jsonl` 有 `event=verification`、`result=ok`、`verification_marker=true`。若只看到終端 marker 而事件未入帳，視為 Harness 尚未驗證。（2026-09-26）
- 完整驗證使用固定入口 `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify.ps1`，依序執行 lint、tests、build 及僅連到 43124 的隔離瀏覽器 smoke；全數成功才輸出 `event=verification result=ok verification_marker=true`。單一檢查使用同一入口加 `-Mode lint`、`-Mode tests`、`-Mode build` 或 `-Mode browser-smoke`；成功時輸出範圍明確的 Harness marker，測試可再限縮 `-TestFile`／`-TestName`。`-Mode local-backup` 只檢查設定頁完整 JSON 備份（`QMS備份_*.json`）為 v15 封套（`state.version === 15`、含 `workspace`／`settings`／`auditProfile`、不含 `companies`）；未指定 `-BackupPath` 時限最近 30 分鐘內檔案。可用 `-BackupPath` 指定路徑，不輸出紀錄內容，也不代表完整程式驗證成功。避免臨時 PowerShell `-Command` 驗證，因本機執行政策會在啟動前拒絕不透明命令；拒絕代表命令未啟動，應改用已檢視的固定 `-File` 入口，不可把拒絕算成測試失敗或成功。
- 已移除的設定頁（「稽核基本資料」「管理系統認證證書」、證書範圍／編號／適用性輸入）不得從 `HEAD`（`424a86a` 的 `SettingsPanel.tsx` 仍含這些標題）或舊煙測補回。`smoke-playwright.mjs` 只斷言這些標題與欄位不存在；煙測因缺標題失敗時改斷言，不把舊頁加回。`SettingsPanel`、設定頁測試、煙測與 [`docs/web-ui-ux-sidebar-spec.md`](docs/web-ui-ux-sidebar-spec.md) 同一批提交，避免捨棄未提交檔後整頁回到舊設計。證書文字仍留在資料與匯出。檢查：設定頁無上述標題與欄位；煙測在它們出現時失敗。出處：2026-09-28 舊設定頁被工作區蓋回。
- 依變更範圍使用 `npm run lint`、`npm test` 與 `npm run build`；UI 變更另檢查 375／768／1280／1536px 實際呈現與鍵盤操作，涉及收合區時檢查收合後列印內容。僅有 DOM 文字或無整頁 overflow 的檢查，不能取代可讀性、互動與列印驗收。側欄 smoke 斷言產品名須容忍桌面／窄螢幕雙 DOM（`getAllByText`）；`lazy` 分頁測試全套件易逾時，可 `beforeAll` 預載該 chunk。
- 開始前先檢查 `git status` 並保留既有變更；不得重設、清理或覆蓋不屬於目前工作的檔案。
- 未經使用者明確要求，不建立提交、不推送、不整合至受保護分支，也不清除或重建使用者資料。
- 提交前核對 `workgit.ps1` 現行行為：`start` 要求乾淨工作樹，`save` 會 `add -A`。依 staged／unstaged／untracked 清單確認是否符合已授權範圍；使用者已授權 `commit all` 且範圍未變時直接沿用。路由或分類計畫列出檔案後，若距提交前工作區已擴張，以最新 `git status`／`git diff --stat` 重划範圍；排除 `.netlify` 僅換行 diff 與 `QMS遷移前備份_*.json` 等本機備份。guard 不支援目前狀態時回報缺少的受控操作，不改用直接 Git mutation 或要求使用者代跑來規避。
- 執行 `save` 前，在預定提交的執行環境以 `git var GIT_AUTHOR_IDENT`、`git var GIT_COMMITTER_IDENT` 驗證身分；缺值先查現有設定與讀取權限，仍無法確認才詢問。不得由舊 commit 作者或示例地址推定本次身分，也不承諾 guard 尚未支援的 config 寫入。
- `save` 失敗不代表未變更 index。以 `git status --short`、`git diff --cached --stat`、`git rev-parse HEAD` 讀回暫存區與 HEAD，分別回報 staging、commit、push 是否完成；保留現狀，重試前重新核對範圍。

<!-- 提交依據：2026-09-24 本任務 commit all 的 staging 成功／identity 失敗紀錄；行為已對照 C:/Users/user/.codex/bin/workgit.ps1 的 start/save 實作。 -->
