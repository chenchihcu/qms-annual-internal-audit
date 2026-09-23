import { useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import { PROCEDURE_PLAN_TEMPLATE } from '../data/procedurePlan'
import type { ObservationStatus } from '../types'
import { Badge, Button, Card, Input, Select } from './ui/Badge'

export function Observations({ store }: { store: AuditStore }) {
  const {
    state,
    updateObservation,
    carryForwardObservation,
    carryForwardNCR,
    addObservation,
  } = store
  const { company, settings } = state
  const currentYear = settings.auditYear
  const priorObs = company.observations.filter((o) => o.year < currentYear)
  const openPriorNCR = company.ncrs.filter(
    (n) => n.status !== '結案' && (n.sourceYear ?? currentYear - 1) < currentYear,
  )

  const [carryMessage, setCarryMessage] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)
  const [newObs, setNewObs] = useState({
    qpCode: company.planRows[0]?.qpCode ?? 'QP-01',
    departmentId: company.planRows[0]?.departmentId ?? '',
    content: '',
    description: '',
  })

  const auditObservations = company.audits.flatMap((audit) =>
    audit.items
      .filter((item) => item.judgment === '觀察')
      .map((item) => ({
        id: item.id,
        label: `${audit.qpCode} · ${audit.department}`,
        content: item.content,
        description: item.description,
        sourceYear: item.sourceYear,
      })),
  )

  const statusLabel: Record<ObservationStatus, string> = {
    open: '待追蹤',
    closed: '已結案',
    became_ncr: '已轉 NCR',
  }

  const importCarryForwardOnly = () => {
    const observations = priorObs.filter((o) => o.status === 'open' && !o.carriedToYear)
    const ncrs = openPriorNCR.filter((n) => !n.carriedToYear)
    const validObservations = observations.filter((o) => company.planRows.some(
      (row) => row.qpCode === (o.qpCode || 'QP-01') && row.departmentId === o.departmentId,
    ) && PROCEDURE_PLAN_TEMPLATE.some(
      (entry) => entry.qpCode === (o.qpCode || 'QP-01') && entry.departmentId === o.departmentId,
    ) && company.departments.some((department) => department.id === o.departmentId))
    const validNcrs = ncrs.filter((n) => company.planRows.some(
      (row) => row.qpCode === n.qpCode && row.departmentId === n.departmentId,
    ) && PROCEDURE_PLAN_TEMPLATE.some((entry) => entry.qpCode === n.qpCode) &&
      company.departments.some((department) => department.id === n.departmentId))
    for (const obs of validObservations) {
      carryForwardObservation(obs.id, obs.qpCode || 'QP-01', obs.departmentId)
    }
    for (const ncr of validNcrs) {
      carryForwardNCR(ncr.id, ncr.qpCode, ncr.departmentId)
    }
    const skipped = observations.length + ncrs.length - validObservations.length - validNcrs.length
    setCarryMessage(`已帶入 ${validObservations.length + validNcrs.length} 筆；略過 ${skipped} 筆（無相符計畫列）。需要時請至年度計畫自動排程。`)
  }

  const planRowOptions = company.planRows.map((r) => ({
    value: `${r.qpCode}|${r.departmentId}`,
    label: `${r.qpCode} · ${r.department}`,
  }))
  const selectedPlanRow = company.planRows.find(
    (row) => row.qpCode === newObs.qpCode && row.departmentId === newObs.departmentId,
  ) ?? company.planRows[0]

  return (
    <div className="space-y-6">
      <Card className="no-print">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">跨年度帶入</h2>
            <p className="text-sm text-muted">
              先帶入查檢表，再視需要重排計畫。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={importCarryForwardOnly}>
              帶入查檢表
            </Button>
          </div>
        </div>
        {carryMessage && <p role="status" aria-live="polite" className="mt-3 text-sm text-muted">{carryMessage}</p>}
      </Card>

      <Card className="no-print">
        <h2 className="mb-3 text-lg font-semibold text-ink">新增觀察</h2>
        <p className="mb-3 text-sm text-muted">可手動新增；查檢表「觀察」會自動列入。</p>
        <form
          className="record-create-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            if (!selectedPlanRow) {
              setFormSuccess(null)
              setFormError('請先建立年度計畫列。')
              return
            }
            if (!newObs.content.trim()) {
              setFormSuccess(null)
              setFormError('請填寫觀察內容。')
              return
            }
            addObservation({ ...newObs, qpCode: selectedPlanRow.qpCode, departmentId: selectedPlanRow.departmentId })
            setNewObs((s) => ({ ...s, qpCode: selectedPlanRow.qpCode, departmentId: selectedPlanRow.departmentId, content: '', description: '' }))
            setFormError(null)
            setFormSuccess('已新增觀察。')
          }}
        >
          <Select
            label="程序／部門"
            value={selectedPlanRow ? `${selectedPlanRow.qpCode}|${selectedPlanRow.departmentId}` : ''}
            onChange={(v) => {
              const [qp, dept] = v.split('|')
              setNewObs((s) => ({ ...s, qpCode: qp, departmentId: dept }))
            }}
            options={planRowOptions}
            disabled={!planRowOptions.length}
            required
            error={formError && !selectedPlanRow ? formError : undefined}
          />
          <Input
            label="觀察內容"
            value={newObs.content}
            onChange={(v) => { setNewObs((s) => ({ ...s, content: v })); setFormError(null); setFormSuccess(null) }}
            required
            error={formError && selectedPlanRow ? formError : undefined}
          />
          <Input
            label="說明"
            value={newObs.description}
            onChange={(v) => setNewObs((s) => ({ ...s, description: v }))}
          />
          <div className="record-create-submit">
            <Button type="submit">
              新增觀察
            </Button>
          </div>
          <div className="record-create-feedback" aria-live="polite">
            {formSuccess && <p role="status" className="text-sm font-medium text-green-800 dark:text-green-300">{formSuccess}</p>}
          </div>
        </form>
      </Card>

      <Card>
        <div className="space-y-6">
          <section aria-labelledby="prior-observations-heading">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="prior-observations-heading" className="text-lg font-semibold text-ink">
                前年度觀察（{priorObs.length}）
              </h2>
            </div>
            {priorObs.length === 0 ? (
              <p className="text-sm text-muted">尚無前年度觀察</p>
            ) : (
              <div className="space-y-3">
                {priorObs.map((obs) => (
                  <div key={obs.id} className="rounded-lg border border-line p-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge label={`${obs.year}年`} />
                      <span className="font-medium text-ink">{obs.qpCode} · {obs.department}</span>
                      <Badge label={statusLabel[obs.status]} />
                      {obs.carriedToYear && (
                        <span className="text-xs text-link">已帶入 {obs.carriedToYear} 年</span>
                      )}
                    </div>
                    <p className="text-sm">{obs.content}</p>
                    <p className="mt-1 text-xs text-muted">{obs.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2 no-print">
                      {!obs.carriedToYear && (
                        <Button
                          variant="secondary"
                          onClick={() =>
                            carryForwardObservation(obs.id, obs.qpCode, obs.departmentId)
                          }
                        >
                          帶入本年查檢表
                        </Button>
                      )}
                      <Select
                        label={`${obs.qpCode} ${obs.department} 狀態`}
                        value={obs.status}
                        onChange={(v) => updateObservation(obs.id, { status: v as ObservationStatus })}
                        options={[
                          { value: 'open', label: '待追蹤' },
                          { value: 'closed', label: '已結案' },
                          { value: 'became_ncr', label: '已轉 NCR' },
                        ]}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="border-t border-line pt-5" aria-labelledby="prior-ncr-heading">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="prior-ncr-heading" className="text-lg font-semibold text-ink">
                前年度未結案 NCR（{openPriorNCR.length}）
              </h2>
              <p className="text-xs text-muted">NCR 維持獨立資料與追蹤語意</p>
            </div>
            {openPriorNCR.length === 0 ? (
              <p className="text-sm text-muted">無前年度未結案 NCR</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {openPriorNCR.map((ncr) => (
                  <li key={ncr.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-line p-3">
                    <span>{ncr.ncrNumber} · {ncr.qpCode} · {ncr.description}</span>
                    {ncr.carriedToYear ? (
                      <span className="text-xs text-link">已帶入 {ncr.carriedToYear} 年</span>
                    ) : (
                      <Button
                        variant="secondary"
                        onClick={() => carryForwardNCR(ncr.id, ncr.qpCode, ncr.departmentId)}
                      >
                        帶入查檢表
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-ink">{currentYear} 年觀察</h2>
        {auditObservations.length === 0 ? (
          <p className="text-sm text-muted">尚無本年觀察。</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {auditObservations.map((obs) => (
              <li key={obs.id} className="rounded border border-line p-3">
                <span className="font-medium text-ink">{obs.label}：</span>{obs.content}
                {obs.sourceYear && (
                  <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">（源自 {obs.sourceYear} 年）</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
