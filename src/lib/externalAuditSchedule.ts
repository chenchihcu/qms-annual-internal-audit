import type { CompanyId, ExternalAuditDaySchedule, ExternalAuditScheduleEntry } from '../types'
import { COMPANY_LABELS } from '../types'

export function createDefaultExternalAuditSchedule(
  year: number,
  auditDate: string,
): ExternalAuditDaySchedule {
  const entries: ExternalAuditScheduleEntry[] = [
    {
      id: 'sched-1',
      timeStart: '08:30',
      timeEnd: '09:00',
      activity: '開幕會議／簡介與稽核範圍確認',
      location: '會議室 A',
      productModels: '—',
      companyFocus: 'both',
      remark: '雙公司合併取證開場',
    },
    {
      id: 'sched-2',
      timeStart: '09:00',
      timeEnd: '11:30',
      activity: '生產現場稽核（製程與追溯）',
      location: '生產一線',
      productModels: '航太支架、精密連接件',
      companyFocus: 'jiurun',
      remark: '九潤主導機種展示',
    },
    {
      id: 'sched-3',
      timeStart: '13:00',
      timeEnd: '15:30',
      activity: '品保／量測室與文件審查',
      location: '品保部、量測室',
      productModels: 'ODM 精密件、客供圖面件',
      companyFocus: 'zhenglongxing',
      remark: '正隆興機種與客戶滿意度佐證',
    },
    {
      id: 'sched-4',
      timeStart: '15:45',
      timeEnd: '16:30',
      activity: '結束會議／不符合與觀察事項確認',
      location: '會議室 A',
      productModels: '—',
      companyFocus: 'both',
      remark: '',
    },
  ]

  return {
    year,
    auditDate,
    companyProductHighlights: {
      jiurun: '航太支架、精密連接件、CNC 加工件',
      zhenglongxing: 'ODM 精密件、客供圖面件、表面處理件',
    },
    entries,
  }
}

export function companyFocusLabel(focus: CompanyId | 'both'): string {
  if (focus === 'both') return `${COMPANY_LABELS.jiurun} + ${COMPANY_LABELS.zhenglongxing}`
  return COMPANY_LABELS[focus]
}

export function normalizeExternalAuditSchedule(
  schedule: ExternalAuditDaySchedule | undefined,
  year: number,
  auditDate: string,
): ExternalAuditDaySchedule {
  if (schedule && schedule.year === year && schedule.entries?.length) {
    return {
      ...createDefaultExternalAuditSchedule(year, auditDate),
      ...schedule,
      companyProductHighlights: {
        ...createDefaultExternalAuditSchedule(year, auditDate).companyProductHighlights,
        ...schedule.companyProductHighlights,
      },
    }
  }
  return createDefaultExternalAuditSchedule(year, auditDate || `${year}-09-15`)
}
