import { useMemo, useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import { exportOnsiteExcel } from '../lib/formExport'
import { buildAppHash } from '../lib/navigation'
import { PROCEDURE_PLAN_TEMPLATE } from '../data/procedurePlan'
import type { OnsiteAuditSlot, OnsiteSite } from '../types'
import { COMPANY_LABELS } from '../types'
import { ACTION_ICONS } from '../lib/uiIcons'
import { Button, Input, Select } from './ui/Badge'
import { CheckboxList } from './ui/CheckboxList'
import { EmptyState } from './ui/EmptyState'
import { PageToolbar } from './ui/PageToolbar'
import { ScrollRegion } from './ui/ScrollRegion'
import { TagInput } from './ui/TagInput'

const UNIQUE_QP_CODES = [...new Set(PROCEDURE_PLAN_TEMPLATE.map((entry) => entry.qpCode))].sort()

const SITE_OPTIONS: { value: OnsiteSite; label: string }[] = [
  { value: 'jiurun', label: COMPANY_LABELS.jiurun },
  { value: 'zhenglongxing', label: COMPANY_LABELS.zhenglongxing },
  { value: 'both', label: '兩公司合併' },
]

function blankSlot(): OnsiteAuditSlot {
  return {
    id: `onsite-${Date.now()}`,
    date: '',
    startTime: '',
    endTime: '',
    site: 'both',
    departmentId: '',
    qpCodes: [],
    productModels: [],
    escortPersonIds: [],
    note: '',
  }
}

export function OnsiteSchedulePage({ store }: { store: AuditStore }) {
  const { state, addOnsiteSlot, updateOnsiteSlot, removeOnsiteSlot } = store
  const { externalAuditPrep, people } = state
  const slots = externalAuditPrep.onsiteSlots ?? []
  const [draft, setDraft] = useState<OnsiteAuditSlot | null>(null)

  const escortOptions = useMemo(
    () => people.filter((person) => person.active).map((person) => ({ value: person.id, label: person.name })),
    [people],
  )

  const qpOptions = useMemo(
    () => UNIQUE_QP_CODES.map((qpCode) => ({ value: qpCode, label: qpCode })),
    [],
  )

  const departmentOptions = useMemo(() => {
    const ids = new Set<string>()
    return Object.values(state.companies).flatMap((company) =>
      company.departments
        .filter((dept) => {
          if (ids.has(dept.id)) return false
          ids.add(dept.id)
          return true
        })
        .map((dept) => ({ value: dept.id, label: dept.name })),
    )
  }, [state.companies])

  const startEdit = (slot?: OnsiteAuditSlot) => {
    const next = slot ? { ...slot } : blankSlot()
    setDraft(next)
  }

  const saveDraft = () => {
    if (!draft || !draft.date.trim()) return
    if (slots.some((slot) => slot.id === draft.id)) {
      updateOnsiteSlot(draft.id, draft)
    } else {
      addOnsiteSlot(draft)
    }
    setDraft(null)
  }

  const siteLabel = (site: OnsiteSite) => SITE_OPTIONS.find((item) => item.value === site)?.label ?? site

  return (
    <div className="space-y-6 print-area qr-form">
      <div>
        <PageToolbar
          title="外稽當日行程"
          meta={(
            <>
              外部稽核預定：{externalAuditPrep.externalAuditDate || '未設定'}
              <a className="ml-2 font-medium text-blue-700 underline" href={buildAppHash('prep')}>外稽準備</a>
            </>
          )}
          actions={(
            <>
              <Button icon={ACTION_ICONS.add} onClick={() => startEdit()}>新增時段</Button>
              <Button variant="secondary" icon={ACTION_ICONS.exportExcel} onClick={() => exportOnsiteExcel(state)}>匯出 Excel</Button>
            </>
          )}
        />

        {draft && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 no-print">
            <h3 className="mb-3 font-semibold">{slots.some((slot) => slot.id === draft.id) ? '編輯時段' : '新增時段'}</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Input label="日期 *" type="date" value={draft.date} onChange={(value) => setDraft({ ...draft, date: value })} />
              <Input label="開始時間" type="time" value={draft.startTime} onChange={(value) => setDraft({ ...draft, startTime: value })} />
              <Input label="結束時間" type="time" value={draft.endTime} onChange={(value) => setDraft({ ...draft, endTime: value })} />
              <Select
                label="廠區"
                value={draft.site}
                onChange={(value) => setDraft({ ...draft, site: value as OnsiteSite })}
                options={SITE_OPTIONS}
              />
              <Select
                label="受稽單位"
                value={draft.departmentId ?? ''}
                onChange={(value) => setDraft({ ...draft, departmentId: value || undefined })}
                options={[{ value: '', label: '待確認' }, ...departmentOptions]}
              />
              <Input label="備註" value={draft.note} onChange={(value) => setDraft({ ...draft, note: value })} />
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <TagInput
                label="受稽產品／型號"
                value={draft.productModels}
                onChange={(productModels) => setDraft({ ...draft, productModels })}
              />
              <CheckboxList
                label="涵蓋程序（QP）"
                options={qpOptions}
                selected={draft.qpCodes}
                onChange={(qpCodes) => setDraft({ ...draft, qpCodes })}
              />
              <CheckboxList
                label="陪同人員"
                options={escortOptions}
                selected={draft.escortPersonIds}
                onChange={(escortPersonIds) => setDraft({ ...draft, escortPersonIds })}
              />
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={saveDraft} disabled={!draft.date.trim()}>儲存</Button>
              <Button variant="secondary" onClick={() => setDraft(null)}>取消</Button>
            </div>
          </div>
        )}

        {slots.length === 0 ? (
          <EmptyState message="目前沒有外稽當日時段。" />
        ) : (
          <ScrollRegion ariaLabel="外稽當日行程表">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="border p-2">日期</th>
                  <th className="border p-2">時段</th>
                  <th className="border p-2">廠區</th>
                  <th className="border p-2">QP</th>
                  <th className="border p-2">產品／型號</th>
                  <th className="border p-2">陪同</th>
                  <th className="border p-2">備註</th>
                  <th className="border p-2 no-print">操作</th>
                </tr>
              </thead>
              <tbody>
                {slots.map((slot) => (
                  <tr key={slot.id}>
                    <td className="border p-2">{slot.date}</td>
                    <td className="border p-2 text-xs">{slot.startTime}{slot.endTime ? `–${slot.endTime}` : ''}</td>
                    <td className="border p-2 text-xs">{siteLabel(slot.site)}</td>
                    <td className="border p-2 text-xs">{slot.qpCodes.join('、') || '—'}</td>
                    <td className="border p-2 text-xs">{slot.productModels.join('、') || '—'}</td>
                    <td className="border p-2 text-xs">
                      {slot.escortPersonIds.map((id) => people.find((person) => person.id === id)?.name ?? id).join('、') || '—'}
                    </td>
                    <td className="border p-2 text-xs">{slot.note || '—'}</td>
                    <td className="border p-2 no-print">
                      <div className="flex gap-1">
                        <Button variant="ghost" icon={ACTION_ICONS.edit} onClick={() => startEdit(slot)}>編輯</Button>
                        <Button variant="ghost" icon={ACTION_ICONS.delete} className="text-red-600" onClick={() => removeOnsiteSlot(slot.id)}>刪除</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollRegion>
        )}
      </div>
    </div>
  )
}
