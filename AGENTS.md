# QMS 年度內部稽核 — Agent 行為規則（harvested）

> 自 crash 修復、production release validation、十二表單流程閉環（2026-09）互動萃取。

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

- [ ] 十二個 tab 皆包 `TabErrorBoundary`；class 須在 `App()` 之前定義（避免 ReferenceError 白屏）
- [ ] `AnnualPlan.statusShort`：null-safe（`status == null` → `''`）
- [ ] `emptyMonths`：`Array.from({ length: 12 }, () => null)`，勿用 sparse array
- [ ] `getOrCreateAudit`：缺 dept/entry 回傳 stub（`items: []`），不 throw
- [ ] `ensureAllAudits`：缺 dept 時 `continue`，不 throw

## 工作流與導覽 SSOT

- [ ] 十二 tab 的 purpose／entry／exit／prev／next 只寫在 [`src/lib/navigation.ts`](src/lib/navigation.ts) `TAB_WORKFLOW`；完成度／缺口在 [`src/lib/workflowStatus.ts`](src/lib/workflowStatus.ts)；[`WorkflowGuide`](src/components/ui/WorkflowGuide.tsx) 與程序頁 `PROCEDURE_LIFECYCLE_STEPS` 只讀 SSOT，不在各頁重複銜接文案
- [ ] PDCA 順序：P（標準→程序→風險→計畫→人員）→ D（稽核）→ C（NCR／觀察／建議）→ A（外部稽核前準備）；`buildEffectiveProcedureRisks` 供風險頁與計畫頁自動編排共用
- [ ] `parseAppHash`／`buildAppHash`／`syncHash` 支援 `audit`；[`App.tsx`](src/App.tsx) 側欄切 tab 清 `audit`；[`ProcedureAuditPanel`](src/components/ProcedureAuditPanel.tsx) 消費並回寫 `auditKey`
- [ ] 儀表板缺口卡與得分列可導向（`onNavigate` 或 `buildAppHash`），勿只顯示數字

## 資料流閉環

- [ ] `procedureRisks` 須傳入 [`autoArrangePlan`](src/lib/planner.ts)／`regeneratePlan`；風險頁改月格走預覽→`replacePlanRows`，保留 `manualOverride`
- [ ] 跨年台帳（觀察／建議）合併 `yearArchives`；store 用 `findObservation`／`findSuggestion`／`findNCR` 搜 current + archives；`carryForward*` 須更新 archive 來源
- [ ] 建議須有 `addSuggestion`；切年後歷史建議仍可在 UI 看見
- [ ] 主任稽核員：`companySettings[id].leadAuditor`（紙本字串）與 `team.leadAuditorPersonId`（事件）分軌；store 投影 `syncedState.settings` 給 UI
- [ ] 切年 `switchYearState` 只封存 active company；不動另一家、不動 `externalAuditPrep`（除非 `switchPrepYear`）
- [ ] 外稽準備：`evaluatePrepSequence` 回傳 `openNcrByCompany`；第 15 項需 `relationshipChecks`；`externalAuditPrep.externalAuditDate` 不在 `companySettings`
- [ ] NCR：`isNcrStale` 標示過期，不自動刪；觀察 `convertedNcrId` 顯示 `ncrNumber` 非內部 id
- [ ] 儀表板人員警示與 `validateAuditStartState` 閘門一致；觀察卡讀台帳 `observations` + open suggestions，勿混查檢「觀察」判定次數

## 匯出與表單

- [ ] 新表單匯出：頁面 `export*Excel` + [`formExport.ts`](src/lib/formExport.ts) `build*Sheet`；`buildAllFormsWorkbook` 工作表須與 README 匯出表一致（含 QR-02-01 風險）
- [ ] 刪未引用模組前先 `grep` import（例：已移除 `theme.ts`、`storage.ts`、`DepartmentAuditPanel.tsx`）

## Release Gate（local-first SPA）

- [ ] `npm run lint && npm test && npm run build` 全過才交付
- [ ] dev（43123）+ preview（43124）至少 smoke：稽核總覽、年度稽核計畫、稽核執行與證據、系統設定
- [ ] 變更後跑 `demoData.smoke.test.ts`、`useAuditStore.migration.test.ts`、`App.smoke.test.tsx`
- [ ] `App.smoke.test.tsx` 測 hash／導覽前 `beforeEach` 清 `window.location.hash`（避免 tab 測試污染）

## 交付約束

- [ ] 預設 stability fixes only；使用者明確要求工作流閉環時可改 product，仍須跑 release gate
- [ ] 緊急 zip：排除 `node_modules`、`.git`、`dist`；附 SHA256
- [ ] README 測試數與 `npm test` 實際數量一致（目前 117）

## 已知限制（勿假裝已解）

- [ ] legacy `audit-{qp}-{dept}` 與 `createAuditEvent` 事件 ID 兩套共存；深連結只用實際 `audit.id`
- [ ] 未做：查檢 Excel re-import、證據附件、稽核前準備自動勾選
