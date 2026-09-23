import { useEffect, useMemo, useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import { exportAllAuditsExcel, exportAuditExcel } from '../lib/formExport'
import { buildAppHash } from '../lib/navigation'
import { scoreProcedureAudit } from '../lib/scoring'
import { canCompleteAuditReport } from '../lib/workflowStatus'
import type { Judgment } from '../types'
import { ACTION_ICONS } from '../lib/uiIcons'
import { Badge, Button, Card, Input, Select } from './ui/Badge'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { PageToolbar } from './ui/PageToolbar'
import { PrintDocHeader } from './ui/PrintDocHeader'
import { ScrollRegion } from './ui/ScrollRegion'

const JUDGMENTS: Judgment[] = ['符合', '不符', '觀察', '不適用']

interface ProcedureAuditPanelProps {
  store: AuditStore
  auditKey?: string
  onAuditKeyChange?: (auditId: string) => void
  onBackToSchedule?: () => void
}

export function ProcedureAuditPanel({ store, auditKey, onAuditKeyChange, onBackToSchedule }: ProcedureAuditPanelProps) {
  const {
    state,
    getOrCreateAudit,
    createAuditEvent,
    updateAudit,
    updateChecklistItem,
    addChecklistItem,
    removeChecklistItem,
    ensureAllAudits,
    getProcedureTitle,
    startAudit,
    validateAuditStart,
  } = store

  const { company, settings } = state
  const auditOptions = useMemo(
    () =>
      company.audits.map((item, index) => ({
        value: item.id,
        label: `${item.qpCode} · ${item.department} · ${item.auditDate || item.plannedDate || `事件 ${index + 1}`}`,
      })),
    [company.audits, getProcedureTitle],
  )

  const [newPlanKey, setNewPlanKey] = useState(company.planRows[0] ? `${company.planRows[0].qpCode}|${company.planRows[0].departmentId}` : '')
  const [showCompleteDialog, setShowCompleteDialog] = useState(false)
  const [completingReport, setCompletingReport] = useState(false)
  const [pendingDeleteItemId, setPendingDeleteItemId] = useState<string | null>(null)

  useEffect(() => {
    ensureAllAudits()
  }, [ensureAllAudits])

  const hashAuditId = auditKey && company.audits.some((item) => item.id === auditKey) ? auditKey : undefined
  const activeAuditId = hashAuditId ?? company.audits[0]?.id ?? ''

  const selectAudit = (id: string) => {
    onAuditKeyChange?.(id)
  }
  const audit = company.audits.find((item) => item.id === activeAuditId)
    ?? (() => { const [qpCode, departmentId] = newPlanKey.split('|'); return qpCode && departmentId ? getOrCreateAudit(qpCode, departmentId) : null })()

  if (!audit) {
    return <p className="text-slate-500">請先於稽核日程選擇事件</p>
  }

  const score = scoreProcedureAudit(audit, settings.scoringRules)
  const categories = [...new Set(audit.items.map((i) => i.category))]

  const handleHeaderChange = (field: string, value: string) => {
    updateAudit({ ...audit, [field]: value })
  }
  const team = audit.team ?? { auditorPersonIds: [], escortPersonIds: [], impartialityConfirmed: false, impartialityNote: '' }
  const updateTeam = (patch: Partial<typeof team>) => updateAudit({ ...audit, team: { ...team, ...patch } })
  const toggle = (ids: string[], id: string) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]
  const planning = !audit.status || audit.status === '規劃中'
  const reported = audit.status === '已回報'
  const teamValidation = planning
    ? validateAuditStart({ ...audit, team })
    : { errors: [], warnings: [] }
  const completeCheck = canCompleteAuditReport(audit, settings.scoringRules)
  const canStart = planning && teamValidation.errors.length === 0
  const startBlockReasons = teamValidation.errors.join('；')
  const pendingDeleteItem = pendingDeleteItemId
    ? audit.items.find((item) => item.id === pendingDeleteItemId)
    : undefined

  const buildDeleteDescription = (item: NonNullable<typeof pendingDeleteItem>) => {
    const summary = item.content.trim().slice(0, 60) || `NO ${item.no}`
    const base = `確定刪除「${summary}${item.content.length > 60 ? '…' : ''}」？`
    if (item.origin === 'carryforward' || item.sourceYear) {
      return `${base}\n此為跨年追蹤項，刪除後追蹤鏈將斷裂。`
    }
    return base
  }

  const handleCompleteReport = () => {
    if (completingReport) return
    setCompletingReport(true)
    updateAudit({ ...audit, status: '已回報' })
    setShowCompleteDialog(false)
    setCompletingReport(false)
  }

  return (
    <div className="space-y-6 print-area qr-form">
      <Card>
        <PageToolbar
          title="查檢表"
          className="no-print"
          actions={(
            <>
              {onBackToSchedule && (
                <Button variant="ghost" icon="chevronLeft" onClick={onBackToSchedule}>返回日程</Button>
              )}
              <Select
                label=""
                ariaLabel="目前稽核事件"
                value={activeAuditId}
                onChange={selectAudit}
                options={auditOptions}
              />
              <Button variant="secondary" icon={ACTION_ICONS.exportExcel} onClick={() => exportAuditExcel(state, state.activeCompanyId, audit)}>
                本表 Excel
              </Button>
              <Button variant="secondary" icon={ACTION_ICONS.exportExcel} onClick={() => exportAllAuditsExcel(state, state.activeCompanyId)}>
                全部 Excel
              </Button>
            </>
          )}
        />

        <div className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-blue-100 bg-blue-50/50 p-3 no-print">
          <div className="min-w-64 flex-1"><Select label="新增單次稽核事件" value={newPlanKey} onChange={setNewPlanKey} options={company.planRows.map((row) => ({ value: `${row.qpCode}|${row.departmentId}`, label: `${row.qpCode} · ${row.department} · ${row.process}` }))} /></div>
          <Button variant="ghost" onClick={() => { const [qpCode, departmentId] = newPlanKey.split('|'); if (qpCode && departmentId) selectAudit(createAuditEvent(qpCode, departmentId)) }}>建立獨立事件</Button>
        </div>

        <PrintDocHeader
          companyName={company.name}
          auditYear={settings.auditYear}
          formTitle="內部稽核查檢表 QR-28-02"
          subtitle={`${audit.qpCode} ${getProcedureTitle(audit.qpCode, audit.department)} · ${audit.auditCategory}`}
        />

        <ScrollRegion ariaLabel="稽核表頭 QR-28-02" className="mb-6 print:block">
        <table className="qr-header-table w-full min-w-[640px] border-collapse text-sm">
          <tbody>
            <tr>
              <td className="qr-label border p-2">被稽核部門</td>
              <td className="border p-2">{audit.department}</td>
              <td className="qr-label border p-2">稽核流程 (QP)</td>
              <td className="border p-2">{audit.qpCode} {audit.process}</td>
            </tr>
            <tr>
              <td className="qr-label border p-2">對應文件</td>
              <td className="border p-2">{audit.documents}</td>
              <td className="qr-label border p-2">通知日期</td>
              <td className="border p-2">
                <Input ariaLabel="通知日期" label="" type="date" value={audit.notifyDate} onChange={(v) => handleHeaderChange('notifyDate', v)} className="no-print" disabled={!planning} />
                <span className="print-only">{audit.notifyDate}</span>
              </td>
            </tr>
            <tr>
              <td className="qr-label border p-2">實施日期</td>
              <td className="border p-2">
                <Input ariaLabel="實施日期" label="" type="date" value={audit.auditDate} onChange={(v) => handleHeaderChange('auditDate', v)} className="no-print" disabled={!planning} />
                <span className="print-only">{audit.auditDate}</span>
              </td>
              <td className="qr-label border p-2">被稽核部門主管</td>
              <td className="border p-2">
                <Input ariaLabel="被稽核部門主管" label="" value={audit.departmentManager} onChange={(v) => handleHeaderChange('departmentManager', v)} className="no-print" disabled={!planning} />
                <span className="print-only">{audit.departmentManager}</span>
              </td>
            </tr>
            <tr>
              <td className="qr-label border p-2">稽核人員</td>
              <td className="border p-2" colSpan={3}>
                <Input ariaLabel="既有姓名／待配對" label="" value={audit.auditors} onChange={(v) => handleHeaderChange('auditors', v)} className="no-print" disabled={!planning} />
                <span className="print-only">{audit.auditors}</span>
              </td>
            </tr>
          </tbody>
        </table>
        </ScrollRegion>

        <section className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4 no-print">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h3 className="font-semibold">稽核團隊與開始前資格檢查</h3><p className="text-xs text-slate-500">依此次公司、QP、受稽單位與實際日期檢查；陪稽人員不列入獨立判定團隊。</p></div>
            <div className="flex items-center gap-2">
              <Badge label={audit.status ?? '規劃中'} />
              {planning && (
                <span title={!canStart ? startBlockReasons : undefined}>
                  <Button
                    disabled={!canStart}
                    aria-describedby={!canStart ? 'audit-start-gaps' : undefined}
                    onClick={() => {
                      startAudit(audit.id)
                    }}
                  >
                    開始稽核
                  </Button>
                </span>
              )}
              {audit.status === '執行中' && (
                <Button
                  variant="secondary"
                  disabled={!completeCheck.ready || completingReport}
                  onClick={() => setShowCompleteDialog(true)}
                >
                  完成回報
                </Button>
              )}
            </div>
          </div>
          <details className="mt-4" open={planning}>
            <summary className="cursor-pointer text-sm font-medium text-slate-700">團隊與資格設定</summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input label="計畫日期" type="date" value={audit.plannedDate ?? ''} onChange={(value) => updateAudit({ ...audit, plannedDate: value })} disabled={!planning} />
            <Input label="稽核範圍" value={audit.scope ?? ''} onChange={(value) => updateAudit({ ...audit, scope: value })} disabled={!planning} />
            <Input label="稽核準則" value={audit.criteria ?? ''} onChange={(value) => updateAudit({ ...audit, criteria: value })} disabled={!planning} />
            <Input label="回報／正式紀錄編號" value={audit.reportReference ?? ''} onChange={(value) => updateAudit({ ...audit, reportReference: value })} disabled={reported} />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Select label="主任稽核員（內部）" value={team.leadAuditorPersonId ?? ''} onChange={(value) => updateTeam({ leadAuditorPersonId: value || undefined })} options={[{ value: '', label: '尚未指派' }, ...state.people.filter((p) => p.active).map((p) => ({ value: p.id, label: p.name }))]} disabled={!planning} />
            <div><p className="mb-1 text-sm font-medium text-slate-700">內部稽核員</p><div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-slate-300 bg-white p-2">{state.people.filter((p) => p.active).map((p) => <label key={p.id} className="flex min-h-9 items-center gap-2 text-sm"><input type="checkbox" checked={team.auditorPersonIds.includes(p.id)} onChange={() => updateTeam({ auditorPersonIds: toggle(team.auditorPersonIds, p.id) })} disabled={!planning} />{p.name}</label>)}</div></div>
            <div><p className="mb-1 text-sm font-medium text-slate-700">受稽方陪同／協調人員</p><div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-slate-300 bg-white p-2">{state.people.filter((p) => p.active).map((p) => <label key={p.id} className="flex min-h-9 items-center gap-2 text-sm"><input type="checkbox" checked={team.escortPersonIds.includes(p.id)} onChange={() => updateTeam({ escortPersonIds: toggle(team.escortPersonIds, p.id) })} disabled={!planning} />{p.name}</label>)}</div></div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[auto_1fr] lg:items-end">
            <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={team.impartialityConfirmed} onChange={(event) => updateTeam({ impartialityConfirmed: event.target.checked })} disabled={!planning} />已核對客觀性與公正性</label>
            <Input label="客觀性控制措施／判斷依據" value={team.impartialityNote} onChange={(value) => updateTeam({ impartialityNote: value })} disabled={!planning} />
          </div>
          {(teamValidation.errors.length > 0 || teamValidation.warnings.length > 0) && (
            <div id="audit-start-gaps" className="mt-3 space-y-1 text-xs">
              {teamValidation.errors.map((item) => <p key={item} className="text-red-700">阻擋：{item}</p>)}
              {teamValidation.warnings.map((item) => <p key={item} className="text-amber-800">提示：{item}</p>)}
            </div>
          )}
          {audit.status !== '規劃中' && <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <h4 className="font-semibold text-slate-800">稽核開始時固定的來源快照</h4>
            {(audit.procedureCodeSnapshot || audit.procedureVersion || audit.formalRecordLocationSnapshot) ? <div className="mt-2 grid gap-2 text-slate-700 sm:grid-cols-3"><span><strong>程序：</strong>{[audit.procedureCodeSnapshot, audit.procedureVersion].filter(Boolean).join('／')}</span><span><strong>正式紀錄位置：</strong>{audit.formalRecordLocationSnapshot || '未留存'}</span><span><strong>適用標準：</strong>{audit.standardSnapshot?.join('、') || '未留存'}</span></div> : <p className="mt-2 text-xs text-amber-800">此事件沒有稽核開始時的來源快照；系統不補寫未被保存的歷史資料，請以正式紀錄核對。</p>}
          </div>}
          {audit.status === '執行中' && !completeCheck.ready && (
            <p className="mt-3 text-xs text-slate-500">{completeCheck.gaps.join('；')}</p>
          )}
          </details>
          {showCompleteDialog && (
            <ConfirmDialog
              open
              title="確認完成回報？"
              description="回報後查檢判定、客觀證據與內容說明將鎖定，無法從畫面解除。請確認正式紀錄編號與全部查檢項已判定完成。"
              confirmLabel="確認回報"
              variant="danger"
              confirmDisabled={completingReport}
              onConfirm={handleCompleteReport}
              onCancel={() => {
                if (completingReport) return
                setShowCompleteDialog(false)
              }}
            />
          )}
          {pendingDeleteItem && (
            <ConfirmDialog
              open
              title="確認刪除查檢項？"
              description={buildDeleteDescription(pendingDeleteItem)}
              confirmLabel="刪除"
              variant="danger"
              onConfirm={() => {
                removeChecklistItem(audit.id, pendingDeleteItem.id)
                setPendingDeleteItemId(null)
              }}
              onCancel={() => setPendingDeleteItemId(null)}
            />
          )}
          {reported && (
            <div className="mt-4 flex flex-wrap gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm">
              <span className="font-medium text-green-900">已回報 — 後續處理：</span>
              <a className="font-medium text-blue-700 underline" href={buildAppHash('ncr')}>不符合</a>
              <a className="font-medium text-blue-700 underline" href={buildAppHash('observations')}>觀察事項</a>
            </div>
          )}
        </section>

        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm">程序得分：<span className="text-sm font-bold text-blue-700">{score.score == null ? '—' : `${score.score}%`}</span>{score.breakdown.pending > 0 && <span className="ml-2 text-xs text-amber-700">暫時計分 · 待判定 {score.breakdown.pending} 項</span>}</p>
          <Button variant="secondary" icon={ACTION_ICONS.add} className="no-print" onClick={() => addChecklistItem(audit.id)} disabled={reported}>
            新增稽核項目
          </Button>
        </div>

        <ScrollRegion ariaLabel="程序查檢表 QR-28-02">
          <table className="qr-checklist w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="border p-2 w-24">項目</th>
                <th className="border p-2 w-12">NO</th>
                <th className="border p-2">稽核內容</th>
                <th className="border p-2 w-28">判定</th>
                <th className="border p-2">內容說明</th>
                <th className="border p-2 w-16 no-print">操作</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => {
                const catItems = audit.items.filter((i) => i.category === cat)
                return catItems.map((item, idx) => (
                  <tr key={item.id} className={item.sourceYear ? 'bg-amber-50/40' : ''}>
                    {idx === 0 && (
                      <td className="border p-2 align-top font-medium" rowSpan={catItems.length}>
                        {cat}
                      </td>
                    )}
                    <td className="border p-2 align-top text-center">{item.no}</td>
                    <td className="border p-2 align-top">
                      <input
                        className="w-full rounded border border-slate-200 px-2 py-1 no-print"
                        aria-label={`稽核內容 ${item.no}`}
                        value={item.content}
                        disabled={reported}
                        onChange={(e) =>
                          updateChecklistItem(audit.id, item.id, { content: e.target.value })
                        }
                      />
                      <span className="print-only">{item.content}</span>
                      {item.sourceYear && (
                        <span className="mt-1 block text-xs text-amber-700">來源：{item.sourceYear} 年追蹤</span>
                      )}
                    </td>
                    <td className="border p-2 align-top">
                      <select
                        className="w-full rounded border border-slate-200 px-1 py-1 no-print"
                        aria-label={`判定 ${item.no}`}
                        value={item.judgment ?? ''}
                        disabled={reported}
                        onChange={(e) =>
                          updateChecklistItem(audit.id, item.id, {
                            judgment: (e.target.value || null) as Judgment | null,
                          })
                        }
                      >
                        <option value="">—</option>
                        {JUDGMENTS.map((j) => (
                          <option key={j} value={j}>{j}</option>
                        ))}
                      </select>
                      <span className="print-only">{item.judgment && <Badge label={item.judgment} />}</span>
                    </td>
                    <td className="border p-2 align-top">
                      {item.judgment === '不適用' && (
                        <input
                          className="mb-1 w-full rounded border border-slate-200 px-2 py-1 text-xs no-print"
                          placeholder="不適用理由"
                          aria-label={`不適用理由 ${item.no}`}
                          value={item.notApplicableReason ?? ''}
                          disabled={reported}
                          onChange={(e) =>
                            updateChecklistItem(audit.id, item.id, { notApplicableReason: e.target.value })
                          }
                        />
                      )}
                      <input
                        className="mb-1 w-full rounded border border-slate-200 px-2 py-1 text-xs no-print"
                        placeholder="客觀證據引用"
                        aria-label={`客觀證據引用 ${item.no}`}
                        value={item.evidenceReference ?? ''}
                        disabled={reported}
                        onChange={(e) =>
                          updateChecklistItem(audit.id, item.id, { evidenceReference: e.target.value })
                        }
                      />
                      <textarea
                        className="w-full rounded border border-slate-200 px-2 py-1 no-print"
                        aria-label={`內容說明 ${item.no}`}
                        rows={2}
                        value={item.description}
                        disabled={reported}
                        onChange={(e) =>
                          updateChecklistItem(audit.id, item.id, { description: e.target.value })
                        }
                      />
                      <span className="print-only">{item.description}</span>
                    </td>
                    <td className="border p-2 align-top no-print">
                      {!reported && (item.origin === 'custom' || item.origin === 'carryforward') && (
                        <Button
                          variant="ghost"
                          icon={ACTION_ICONS.delete}
                          className="min-h-10 px-2 text-xs text-red-600"
                          onClick={() => setPendingDeleteItemId(item.id)}
                        >
                          刪除
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              })}
            </tbody>
          </table>
        </ScrollRegion>
      </Card>
    </div>
  )
}
