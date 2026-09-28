---
name: qms-audit-change-router
description: "把 QMS 年度內部稽核專案變更路由到正確來源文件、全域技能與驗證 gate。Use when 於本 React/TypeScript 稽核工具開始變更前，需決定先讀 AGENTS.md、導覽規格、localStorage 資料契約、查檢生命週期或應套用的共用技能。變更月格排程、查檢開始/回報、NCR 結案、儀表板觀察計數、hash record 深連結、主任稽核員任命或外稽日期時務必先讀本 skill。Do NOT use for 直接實作 UI 佈局主題（改用 configure-web-layout-theme）、跨專案文件盤點（改用 sync-project-docs）、一般除錯修復（改用 debug-and-fix-bug）或 Agent 規則萃取（改用 harvest-agent-rules）。"
---

# QMS Audit Change Router

Classify the task before changing this repository. This project stores audit state in browser `localStorage`; do not describe tool data as formal controlled records.

若使用者只附本 skill、未說明具體變更，先用 AskQuestion 定路由範圍（例如分類未提交 diff、生命週期、UI、儲存／遷移）；預設不修改原始碼，除非使用者確認範圍。

## Read First

| Change surface | Read first |
| --- | --- |
| Any task | `AGENTS.md` |
| Audit lifecycle, months, counts, NCR close, deep links | [references/audit-lifecycle-semantics.md](references/audit-lifecycle-semantics.md) |
| Sidebar, tab order, RWD, workflow gaps | `docs/web-ui-ux-sidebar-spec.md`, `src/lib/navigation.ts`, `.cursor/rules/ui-information-hierarchy.mdc` |
| Audit semantics, certificate, seed or storage | `AGENTS.md`, `src/lib/singleWorkspaceMigration.ts`, `src/lib/backup.ts`, `src/hooks/useAuditStore.ts`, `docs/single-workspace-migration-spec.md`, affected seeds |
| Checklist seed, department alias, 待匯入占位 | `src/data/checklistLoader.ts`, `src/data/checklists.seed.json`, `src/data/procedurePlan.ts`, [references/audit-lifecycle-semantics.md](references/audit-lifecycle-semantics.md) |
| Checklist start/report, evidence fields | `src/components/ProcedureAuditPanel.tsx`, `src/lib/scoring.ts`, `src/lib/workflowStatus.ts` |
| Plan month schedule vs display | `src/lib/planner.ts`, `src/lib/planStatus.ts`, `src/components/AnnualPlan.tsx` |
| NCR close, description sync | `src/lib/ncr.ts`, `src/components/NCRList.tsx`, `src/hooks/useAuditStore.ts` |
| Dashboard observation metrics | `src/lib/dashboardMetrics.ts`, `src/components/Dashboard.tsx` |
| Follow-up deep links | `src/lib/navigation.ts`, `src/components/FollowupsPage.tsx` |
| Lead auditor, prep sequence | `src/lib/personnel.ts`, `src/lib/externalAuditPrep.ts`, `src/lib/coverage.ts` |
| Forms, checklists, prep, print | Relevant `src/components/` page and paired tests under `src/components/**/__tests__` or `*.test.tsx` |
| Export / release smoke | [project verifier](../../../scripts/verify.ps1), `RELEASE_CHECKLIST.md`, relevant export implementation |

## Route to Shared Skills

- UI layout, density, CJK, accessibility, responsive tables: `configure-web-layout-theme`
- Bug or failing test with stack trace: `debug-and-fix-bug`
- README / docs alignment after behavior change: `sync-project-docs`
- Commit or PR only when explicitly requested: use the current platform's available skill and the required `workgit.ps1` guard; do not assume Cursor-only skills exist elsewhere

## Verification Gates

- Use `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify.ps1` with the relevant Mode (lint/tests/build/browser-smoke); full release checks use all. The service is only `http://127.0.0.1:43124/`
- Docs/skills-only: content, reference and governance checks; rerun only invalidated gates. Distinguish pre-start rejection, failed check and missing Harness registration; preserve raw stdout and read back the matching event
- UI-only: desktop/laptop readability and keyboard focus first; retain existing narrow-window smoke and printable collapsed content. Do not introduce new mobile UX or permissions scope
- Data or storage changes: add or update tests for normal, boundary, and migration paths; never clear `localStorage` as a routine fix
- Lifecycle changes: cover start/report lock, month cycle null↔擬定, NCR close missing fields, dashboard three observation counts, `record` hash navigation

## Non-Negotiables

- One workspace shares personnel, plans and follow-ups. Legacy company fields are compatibility only; migration uses the approved backup/merge/review rules, never guessed judgments
- One shared certificate record; ISO 9001 and AS9100 retain separate versions/applicability. Guidance documents keep their source/date and do not become invented requirements
- User-created deletions go to recoverable trash; permanent purge requires confirmation. Pagination preserves edits, filters, full readback and print
- Do not change scoring weight formulas without explicit approval; judgment *completion* rules (evidence, N/A reason) are separate from weights
- `months` stores schedule only; derived statuses are display-only
- Do not merge dashboard observation counts into a single open total
- `syncNCRDescriptions` must not overwrite user `description`
- Lead auditor from personnel appointment, not plan free text
- UI deduplication is decorative only unless the user approves operational merges
- Preserve user input, checklist snapshots, `src/data/externalAuditPrep.seed.json` source content, print titles, and QP/QR identifiers when simplifying copy

## Delivery

Report with `Changes`, `Impact`, `Verification`, `Residual risk`, and `Next action`. Separate UI wording from source content when validating.

Regression prompts for this skill: see `evals/evals.json`.
