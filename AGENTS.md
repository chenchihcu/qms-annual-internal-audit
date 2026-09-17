# QMS 年度內部稽核 — Agent 行為規則（harvested）

> 自 crash 修復、production release validation、十三表單流程閉環、資訊三層 UI、利害關係人 P-tab（2026-09）互動萃取。

## Demo 與 Seed 對齊

- [ ] `createDemoState` / `buildAudit` 的 `qpCode` + `departmentId` 必須存在於 `PROCEDURE_PLAN_TEMPLATE`
- [ ] 變更 demo 配對時同步更新 `demoData.smoke.test.ts` 的 `DEMO_AUDIT_PAIRS`
- [ ] `buildAudit` throw 僅允許 seed 錯配時在 **demo 建置路徑**；runtime 用 `getOrCreateAudit` stub，不可 throw

## localStorage 與遷移

- [ ] 現行 key：`qms-annual-internal-audit-v7`（`STORAGE_KEY`）；legacy v6 key 仍可讀並遷移
- [ ] `loadState` 順序：v7 → v6 migrate → v5 → v4 → v1 → demo fallback；`version > 7` 拒絕降版；JSON parse 失敗不得 crash
- [ ] v7：`companySettings` per `CompanyId`；`yearArchives` 稀疏 per-company；`prepArchives` 獨立於公司切年
- [ ] bump storage 時：實作 `migrateToV*`，加 migration test，README 註明升級步驟

## Crash-Safe UI

- [ ] 十三個 tab 皆包 `TabErrorBoundary`；class 須在 `App()` 之前定義（避免 ReferenceError 白屏）
- [ ] `AnnualPlan.statusShort`：null-safe（`status == null` → `''`）
- [ ] `emptyMonths`：`Array.from({ length: 12 }, () => null)`，勿用 sparse array
- [ ] `getOrCreateAudit`：缺 dept/entry 回傳 stub（`items: []`），不 throw
- [ ] `ensureAllAudits`：缺 dept 時 `continue`，不 throw

## UI 資訊三層

- [ ] 集合資料分三層：導覽／狀態（`a/b` 或 ≤3 條）、工作面（表／篩選／批次）、明細（只開一筆）
- [ ] `WorkflowGuide` 與 `workflowStatus` 缺口禁止逐 `planRows`／查檢項展開；底部「下一步」`title` 只取 `gaps[0]`，禁止 `join` 完整清單
- [ ] `risk` tab：`getTabWorkflowStatus` 只 push `固有風險已存檔 a/b`；`ready` 仍為全部存檔；`TAB_WORKFLOW.exit` 與閘門一致（其餘因素可暫定）
- [ ] N≥10 的 QP／觀察／查檢：預設緊湊表或單列，禁止 `space-y-4` 大卡牆；手機查檢共用 `qr-checklist` 表（`overflow-x-auto`），禁止 `lg:hidden` 逐項 `<article>` 牆
- [ ] 風險工作面：矩陣對齊 `buildRiskSheet`；`persistDisplayedRisks` 獨立成鈕，不必先套用月格；證據欄點列展開
- [ ] 觀察台帳收合列仍保留「轉為 NCR」「編輯／結案」（`App.smoke` 與開案操作依賴）
- [ ] 正例：儀表板缺口 `slice`、外稽 `x/y`、年度計畫月格表、儀表板需關注篩選、風險 `data-risk-matrix`
- [ ] 反例：風險頁每 QP 一張 `<details>`、風險 tab 逐筆 gap、觀察／跨年全文卡片牆
- [ ] 變更缺口粒度或風險版面：跑 `workflowStatus.test`（`gaps.length === 1` + `/\d+\/\d+/`）、`RiskAssessment.test`、`App.smoke`
- [ ] 利害關係人頁：桌面表（`lg:block`）＋手機可展開卡（`lg:hidden`）；jsdom 兩套同時在 DOM，測試限域 `#stakeholders-form` 或 `[data-stakeholder-dept]`，勿用裸 `getByText` 部門名

## 利害關係人（部門輸入）

- [ ] 部門 `stakeholders`／`riskOccurrence`／`riskSeverity` 只在 `stakeholders` tab 編輯；[`AnnualPlan`](src/components/AnnualPlan.tsx) 不呼叫 `updateDepartment`
- [ ] 部門優先分數＝`calculateDepartmentPriority`（`STAKEHOLDER_WEIGHTS×2 + O×S`），餵 [`autoArrangePlan`](src/lib/planner.ts)；與 QR-02-01 `procedureRisks` 七因素分軌，UI 須註明非方案風險
- [ ] `stakeholdersReady`：每部門 `stakeholders.length >= 1`；`getPdcaOverview` P 缺口 `tab: 'stakeholders'` 插在程序與風險之間
- [ ] 改部門輸入不呼叫 `replacePlanRows`；只影響下次「預覽自動編排」；已有 `manualOverride` 月格保留
- [ ] O／S 用 1–5 `radiogroup`，勿 `type="number"`；勿重用 RiskAssessment `ScaleFive`（綁因素 % 權重）
- [ ] 無 QR 紙本的工作流頁（例：利害關係人）不加 `formExport` 工作表；備份 JSON 已含 `departments`

## 工作流與導覽 SSOT

- [ ] 十三 tab 的 purpose／entry／exit／prev／next 只寫在 [`src/lib/navigation.ts`](src/lib/navigation.ts) `TAB_WORKFLOW`；完成度／缺口在 [`src/lib/workflowStatus.ts`](src/lib/workflowStatus.ts)；[`WorkflowGuide`](src/components/ui/WorkflowGuide.tsx) 與程序頁 `PROCEDURE_LIFECYCLE_STEPS` 只讀 SSOT，不在各頁重複銜接文案
- [ ] PDCA 順序：P（標準→程序→利害關係人→風險→計畫→人員）→ D（稽核）→ C（NCR／觀察／建議）→ A（外部稽核前準備）；`buildEffectiveProcedureRisks` 供風險頁與計畫頁自動編排共用
- [ ] 新增 workflow tab 同步：`TabId`、`TAB_GROUPS`、`TAB_WORKFLOW`、`PROCEDURE_LIFECYCLE_STEPS`、`workflowStatus`（含 `getPdcaOverview`）、`App` lazy＋`TabErrorBoundary`、`navigation.test`、`App.smoke` 標籤序、`README`／本檔表單數與測試數
- [ ] `parseAppHash`／`buildAppHash`／`syncHash` 支援 `audit`；[`App.tsx`](src/App.tsx) 側欄切 tab 清 `audit`；[`ProcedureAuditPanel`](src/components/ProcedureAuditPanel.tsx) 消費並回寫 `auditKey`
- [ ] 儀表板缺口卡與得分列可導向（`onNavigate` 或 `buildAppHash`），勿只顯示數字

## 資料流閉環

- [ ] `procedureRisks` 須傳入 [`autoArrangePlan`](src/lib/planner.ts)／`regeneratePlan`；風險頁改月格走預覽→`replacePlanRows`，保留 `manualOverride`
- [ ] 跨年台帳（觀察／建議）合併 `yearArchives`；store 用 `findObservation`／`findSuggestion`／`findNCR` 搜 current + archives；`carryForward*` 須更新 archive 來源
- [ ] 建議須有 `addSuggestion`；切年後歷史建議仍可在 UI 看見
- [ ] 主任稽核員：`companySettings[id].leadAuditor`（紙本字串）與 `team.leadAuditorPersonId`（事件）分軌；store 投影 `syncedState.settings` 給 UI
- [ ] 切年 `switchYearState` 只封存 active company；不動另一家、不動 `externalAuditPrep`（除非 `switchPrepYear`）
- [ ] 外稽準備：`evaluatePrepSequence` 回傳 `openNcrByCompany`；序位旗標 `internalAuditComplete`／`managementReviewComplete` 為共用 boolean（兩家同一順序）；第 15 項需 `relationshipChecks`；`externalAuditPrep.externalAuditDate` 不在 `companySettings`
- [ ] NCR：`isNcrStale` 標示過期，不自動刪；觀察 `convertedNcrId` 顯示 `ncrNumber` 非內部 id
- [ ] 儀表板人員警示與 `validateAuditStartState` 閘門一致；觀察卡讀台帳 `observations` + open suggestions，勿混查檢「觀察」判定次數

## 匯出與表單

- [ ] 新表單匯出：頁面 `export*Excel` + [`formExport.ts`](src/lib/formExport.ts) `build*Sheet`；`buildAllFormsWorkbook` 工作表須與 README 匯出表一致（含 QR-02-01 風險）
- [ ] 刪未引用模組前先 `grep` import（例：已移除 `theme.ts`、`storage.ts`、`DepartmentAuditPanel.tsx`）

## Release Gate（local-first SPA）

- [ ] `npm run lint && npm test && npm run build` 全過才交付
- [ ] dev（43123）+ preview（43124）至少 smoke：稽核總覽、利害關係人、年度稽核計畫、稽核執行與證據、系統設定
- [ ] 變更後跑 `demoData.smoke.test.ts`、`useAuditStore.migration.test.ts`、`App.smoke.test.tsx`
- [ ] `App.smoke.test.tsx` 測 hash／導覽前 `beforeEach` 清 `window.location.hash`（避免 tab 測試污染）

## 交付約束

- [ ] 預設 stability fixes only；使用者明確要求工作流閉環時可改 product，仍須跑 release gate
- [ ] 緊急 zip：排除 `node_modules`、`.git`、`dist`；附 SHA256
- [ ] README 測試數與 `npm test` 實際數量一致（目前 122）

## 已知限制（勿假裝已解）

- [ ] legacy `audit-{qp}-{dept}` 與 `createAuditEvent` 事件 ID 兩套共存；深連結只用實際 `audit.id`
- [ ] 未做：查檢 Excel re-import、證據附件、稽核前準備自動勾選
