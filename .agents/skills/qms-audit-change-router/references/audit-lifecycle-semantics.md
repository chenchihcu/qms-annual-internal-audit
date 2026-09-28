# Audit Lifecycle Semantics (QMS)

Read when changing checklists, plan months, NCR close, dashboard counts, or navigation deep links.

## Checklist seed vs stored snapshot

- Seed questions: `src/data/checklistLoader.ts` + `src/data/checklists.seed.json`.
- Runtime snapshots live in `company.audits[].items` (localStorage). `createChecklistForProcedure` uses department **profile name**, not always `proceduresRaw.department`.
- Department alias example: profile `開發工程` → seed key `開發工程部` (`normalizeDepartmentForSeedLookup`).
- Placeholder row `category: 待匯入` does not mean seed is empty; check alias + existing audit before editing JSON.
- Safe refresh: `isPendingImportOnlyAudit` + `refreshedSeedItemsIfPendingOnly`; skip when status is `已回報` or any item has user work.

## Checklist state machine

```
規劃中 → [開始稽核] → 執行中 → [完成回報] → 已回報 (locked)
```

- Only `執行中` allows judgment edits.
- `startAudit` / `validateAuditStartState` in `src/hooks/useAuditStore.ts`.
- Report requires formal record number + no pending checklist items (`isChecklistItemPending` in `src/lib/scoring.ts`).
- `updateAudit` attempting `已回報` must pass the same `canCompleteAuditReport` gate as the UI (store fail-closed).
- Conform / non-conform need `objectiveEvidence`; N/A needs `notApplicableReason` or legacy description.

## Plan months

- `cycleMonthStatus` (`src/lib/planner.ts`): `null` ↔ `擬定` only.
- Display: `getDisplayMonthStatus` / `deriveMonthStatus` (`src/lib/planStatus.ts`).
- Never persist 滿意/不滿意/矯正中/矯正圓滿 into `planRows[].months`.

## NCR & observations

- Close gate: `correctiveActionReference`, `effectivenessReference`, `effectivenessVerifiedBy`, `effectivenessVerifiedAt` (`validateNcrClose` in `src/lib/ncr.ts`).
- `syncNCRDescriptions` updates finding/requirement/evidence snapshots only—not `description`.
- Dual-certificate observations: id pattern `observation-${itemId}-${side}` in `syncObservationsFromAudits`.

## Dashboard observation counts (do not merge)

| Label | Source |
| --- | --- |
| 本年查檢觀察 | `calculateAnnualScore` observation breakdown |
| 本年度待追蹤 | ledger `open` where `year === auditYear` |
| 前年度未結 | `open` where `year < auditYear` including `yearArchives` |

Implementation: `src/lib/dashboardMetrics.ts`.

## Navigation hash

- `buildAppHash` / `parseAppHash`: `tab`, `audit`, `section` (`current`|`prior`), `record` (record id).
- Followups → NCR / observations / suggestions must pass `recordId` and expand target row.

## Personnel & dates

- Lead auditor: `resolveLeadAuditorPersonId` (`src/lib/personnel.ts`); not free text on annual plan.
- Internal audit year: header `AuditYearSwitcher` only.
- Year-switch confirm copy (`buildYearSwitchDescription`) must match `switchWorkspaceYear` in `src/lib/singleWorkspaceMigration.ts`: no archive → keep `planRows`, clear `months` to `null`, empty audits/NCR/observations/suggestions; do not describe a blank plan rebuild. Check: `src/lib/__tests__/auditYearSwitch.test.ts`.
- External audit date: edit on prep page; sync `settings.externalAuditDate`.
- Internal audit complete: derived via `buildMergedCertificateCoverage`; not a manual prep flag.
