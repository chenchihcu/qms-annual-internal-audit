---
name: qms-audit-change-router
description: "把 QMS 年度內部稽核專案變更路由到正確來源文件、全域技能與驗證 gate。Use when 於本 React/TypeScript 稽核工具開始變更前，需決定先讀 AGENTS.md、導覽規格、localStorage 資料契約或應套用的共用技能。Do NOT use for 直接實作 UI 佈局主題（改用 configure-web-layout-theme）、跨專案文件盤點（改用 sync-project-docs）、一般除錯修復（改用 debug-and-fix-bug）或 Agent 規則萃取（改用 harvest-agent-rules）。"
---

# QMS Audit Change Router

Classify the task before changing this repository. This project stores audit state in browser `localStorage`; do not describe tool data as formal controlled records.

## Read First

| Change surface | Read first |
| --- | --- |
| Any task | `AGENTS.md` |
| Sidebar, tab order, RWD, workflow gaps | `docs/web-ui-ux-sidebar-spec.md`, `src/lib/navigation.ts`, `.cursor/rules/ui-information-hierarchy.mdc` |
| Audit semantics, ISO 9001 / AS9100, seed or storage | `AGENTS.md` audit sections, `src/lib/storage.ts`, `src/hooks/useAuditStore.ts`, affected `src/data/` seeds |
| Forms, checklists, NCR, prep, print | Relevant `src/components/` page and paired tests under `src/components/**/__tests__` or `*.test.tsx` |
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

## Non-Negotiables

- Do not change scoring formulas, judgment meaning, or stored field semantics without reviewing all readers and writers
- UI deduplication is decorative only unless the user approves operational merges
- Preserve user input, checklist snapshots, `src/data/externalAuditPrep.seed.json` source content, print titles, and QP/QR identifiers when simplifying copy

## Delivery

Report with `Changes`, `Impact`, `Verification`, `Residual risk`, and `Next action`. Separate UI wording from source content when validating.
