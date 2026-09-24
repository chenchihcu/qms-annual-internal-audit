---
name: qms-audit-change-router
description: "把 QMS 年度內部稽核專案變更路由到正確來源文件、全域技能與驗證 gate。Use when 於本 React/TypeScript 稽核工具開始變更前，需決定先讀 AGENTS.md、導覽規格、localStorage 資料契約、查檢生命週期或應套用的共用技能。變更月格排程、查檢開始/回報、NCR 結案、儀表板觀察計數、hash record 深連結、主任稽核員任命或外稽日期時務必先讀本 skill。Do NOT use for 直接實作 UI 佈局主題（改用 configure-web-layout-theme）、跨專案文件盤點（改用 sync-project-docs）、一般除錯修復（改用 debug-and-fix-bug）或 Agent 規則萃取（改用 harvest-agent-rules）。"
---

# QMS Audit Change Router

Classify the task before changing this repository. This project stores audit state in browser `localStorage`; do not describe tool data as formal controlled records.

## Read First

| Change surface | Read first |
| --- | --- |
| Any task | `AGENTS.md` |
| Audit lifecycle, months, counts, NCR close, deep links | [references/audit-lifecycle-semantics.md](references/audit-lifecycle-semantics.md) |
| Sidebar, tab order, RWD, workflow gaps | `docs/web-ui-ux-sidebar-spec.md`, `src/lib/navigation.ts`, `.cursor/rules/ui-information-hierarchy.mdc` |
| Audit semantics, ISO 9001 / AS9100, seed or storage | `AGENTS.md` audit sections, `src/lib/storage.ts`, `src/hooks/useAuditStore.ts`, affected `src/data/` seeds |
| Checklist start/report, evidence fields | `src/components/ProcedureAuditPanel.tsx`, `src/lib/scoring.ts`, `src/lib/workflowStatus.ts` |
| Plan month schedule vs display | `src/lib/planner.ts`, `src/lib/planStatus.ts`, `src/components/AnnualPlan.tsx` |
| NCR close, description sync | `src/lib/ncr.ts`, `src/components/NCRList.tsx`, `src/hooks/useAuditStore.ts` |
| Dashboard observation metrics | `src/lib/dashboardMetrics.ts`, `src/components/Dashboard.tsx` |
| Follow-up deep links | `src/lib/navigation.ts`, `src/components/FollowupsPage.tsx` |
| Lead auditor, prep sequence | `src/lib/personnel.ts`, `src/lib/externalAuditPrep.ts`, `src/lib/coverage.ts` |
| Forms, checklists, prep, print | Relevant `src/components/` page and paired tests under `src/components/**/__tests__` or `*.test.tsx` |
| Export / release smoke | `artifacts/release/`, `npm run build`, project smoke scripts if touched |

## Route to Shared Skills

- UI layout, density, CJK, accessibility, responsive tables: `configure-web-layout-theme`
- Bug or failing test with stack trace: `debug-and-fix-bug`
- README / docs alignment after behavior change: `sync-project-docs`
- Commit or PR only when the user explicitly asks: `git-commit-protocol` / `github-pr-create` (Cursor-only under `~/.cursor/skills`)

## Verification Gates

- Default: `npm run lint`, `npm test`, `npm run build`
- UI-only: also verify 375 / 768 / 1280 / 1536 px layout and keyboard focus; collapsible sections must remain printable
- Data or storage changes: add or update tests for normal, boundary, and migration paths; never clear `localStorage` as a routine fix
- Lifecycle changes: cover start/report lock, month cycle null↔擬定, NCR close missing fields, dashboard three observation counts, `record` hash navigation

## Non-Negotiables

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
