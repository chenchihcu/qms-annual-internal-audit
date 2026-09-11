# QMS 年度內部稽核系統

114 年度內部稽核查檢表完整種子（九潤精密／正隆興精密），對應 QR-28 系列紙本表單設計。

## 快速開始

```bash
npm install
npm run dev    # http://127.0.0.1:43123
npm test       # 27 項單元測試
```

## 查檢表種子覆蓋率（SEED_JSON 6/6）

| 指標 | 數值 |
|------|------|
| 程序列（raw entries） | **29**（QP-16 業務/品保各一） |
| 唯一 QP 代碼 | **28/28（100%）** |
| 系統稽核查檢項 | **130** |
| 製程稽核 QR-28-04 | **18** |
| 型態稽核 QR-28-05 | **4** |
| 合計查檢項 | **152** |
| 稽核重點標示列 | **27** + 製程/型態 |

補充程序：**QP-09**（紀錄文件）、**QP-13**（風險作業）依 seed 標記 `supplemented`。

## 採用的紙本設計優點

1. **程序導向** — 以 QP 查檢表為主；QP-16 業務部/品保部獨立項目  
2. **QR-28-02 表頭** — 被稽核部門、稽核流程、對應文件、日期、主管、稽核人員  
3. **列格式** — 項目｜NO｜稽核內容｜判定｜內容說明  
4. **稽核重點標示** — 儀表板 focusLegend（風險、單位、負責人、項數）  
5. **月格計畫** — 擬定/滿意/不滿意/矯正中/矯正圓滿  
6. **雙公司** — 九潤精密｜正隆興精密  
7. **三類稽核** — 系統｜製程(QR-28-04)｜型態(QR-28-05)  
8. **跨年度** — NCR/觀察/第三方建議帶入新年度  
9. **建議追蹤** — open/closed 一覽表  
10. **稽核前準備** — 雙公司合併取證外部稽核前查核表（一張證書、兩家公司）  
11. **列印 CSS** — QR-28 表單邊框版型  

## 外部稽核前準備（dual_company_single_certificate）

- 種子：`src/data/externalAuditPrep.seed.json`  
- 來源：**第三方主任稽核員長期觀察 — 九潤+正隆興合併稽核取得一張證書**（措辭 verbatim，不自行改寫）  
- 欄位：項次｜稽核前準備事項｜負責人｜九潤｜正隆興｜完成｜備註/表單  
- 範圍模式：`both_separate`（◎◎）、`merged`（合併）、`site_scope`（稽核廠區範圍）  
- 序位橫幅：內部稽核完成 → 管理審查完成 → 外部稽核；未結 NCR / 管審順序錯誤時警告  
- 狀態依年度共用，儲存於 AppState `externalAuditPrep`（非 per-company）

## 資料

- 查檢表種子：`src/data/checklists.seed.json`（`import.finalized: true`）  
- localStorage：`qms-annual-internal-audit-v4`  

## 技術棧

Vite + React + TypeScript + Tailwind CSS v4 + Vitest
