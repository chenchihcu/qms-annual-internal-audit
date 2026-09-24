# Production Release Checklist

> **Historical snapshot**：以下為 v6 RC 發佈時紀錄，部署 hash 與測試數為當時證據。目前程式為 v7 儲存鍵、16 頁左側導覽；日常驗證請用 `npm run lint`、`npm test`、`npm run build`（2026-09 約 277 tests / 53 files）。

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
