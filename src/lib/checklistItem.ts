import type { ChecklistItem } from '../types'

/** Seed items: no origin (legacy), origin seed, or not custom/carryforward categories */
export function isSeedChecklistItem(item: ChecklistItem): boolean {
  if (item.origin === 'custom' || item.origin === 'carryforward') return false
  if (item.origin === 'seed') return true
  if (item.sourceYear || item.carriedFromId) return false
  if (item.category === '自訂' || item.category === '跨年追蹤' || item.category === '第三方建議') {
    return false
  }
  if (item.category === '待匯入') return false
  return true
}

const legacyCategoryLabels: Record<string, string> = {
  '雙法人管理代表': '管理代表',
  '管審紀錄（雙證）': '管理審查紀錄',
  '客戶滿意度（雙證）': '客戶滿意度',
  '正隆興對九潤滿意度': '主要客戶滿意度',
}

const legacyChecklistCopy: Record<string, string> = {
  '九潤精密、正隆興精密是否各自備有管理代表委任書（同一人兼任時，兩張證書檔仍須分開備查）':
    '管理代表之任命或職責授權紀錄，是否依組織實際安排保存？',
  '九潤精密、正隆興精密是否各有一份管理審查會議紀錄（同一人主持仍須分開備查），且內容涵蓋管審輸入與決議。':
    '組織是否保存管理審查會議紀錄，並涵蓋管理審查輸入事項與決議？',
  '根據客戶產品的技術文件、工程圖,分析製程風險,由該單位提供過程流程圖、PFMEA 失效模式效應分析表 九潤NCR-2023-01 PFD/PFMEA/CP 正隆興NCR-2023-01 PFMEA':
    '根據客戶產品技術文件與工程圖分析製程風險，並查核過程流程圖、PFMEA 及控制計畫。歷史參考（識別待覆核）：NCR-2023-01（PFD／PFMEA／CP）、NCR-2023-01（PFMEA）。',
  '1.針對客戶工程圖面,開發工程部是否已指定專人負責審核並整理下列變更資訊：包括產品、相關文件及版本。  2.確認有無審查客戶ECR內容及執行內部工程變更審核流程、工程變更申請單之審查紀錄. 九潤精密 NCR-2024-02':
    '1. 針對客戶工程圖面，是否指定人員審核並整理產品、相關文件及版本變更資訊？ 2. 是否審查客戶 ECR，並保留內部工程變更申請與審查紀錄？歷史參考：NCR-2024-02。',
  '九潤、正隆興是否各自執行客戶滿意度調查（QR-16-07），兩張證書分開備查。':
    '是否執行客戶滿意度調查（QR-16-07），並保存紀錄？',
  '正隆興精密是否對主要客戶九潤精密科技執行客戶滿意度調查（歷年外稽易開缺失）。':
    '是否對主要客戶執行客戶滿意度調查，並保存紀錄？（曾列為外稽關注事項）',
  '是否每年針對當年度有業務往來的客戶，以郵寄、電傳、電子郵件、電話訪談、或實地拜訪客戶等方式完成『QR-16-07客戶滿意度調查表』。 兩公司分開調查；正隆興須對主要客戶九潤精密科技調查。':
    '是否每年針對當年度有業務往來的客戶，以郵寄、電傳、電子郵件、電話訪談或實地拜訪等方式完成「QR-16-07 客戶滿意度調查表」？',
  '新廠商提供其營利登記資料、產品資訊、產品證明文件及品質系統等相關資料後，是否填具於『QR-17-02 供應商基本資料表』、『QR-17-01 供應商評鑑表』。 九潤、 正隆興供應商管理資料: 要求分開管理':
    '新廠商提供營利登記資料、產品資訊、產品證明文件及品質系統等資料後，是否填具「QR-17-02 供應商基本資料表」及「QR-17-01 供應商評鑑表」？',
}

/** Display-only wording for legacy seed items; stored questions and event snapshots stay unchanged. */
export function getChecklistDisplayCategory(item: ChecklistItem): string {
  if (!isSeedChecklistItem(item)) return item.category
  return legacyCategoryLabels[item.category] ?? item.category
}

/** Normalize only exact legacy seed copy so custom and historical user text remains intact. */
export function getChecklistDisplayContent(item: ChecklistItem): string {
  if (!isSeedChecklistItem(item)) return item.content
  return legacyChecklistCopy[item.content] ?? item.content
}
