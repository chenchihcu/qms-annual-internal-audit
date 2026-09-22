import { useEffect, useRef, useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import type { NavigateOptions, ObservationSection } from '../lib/navigation'
import { listAuditObservationEntries } from '../lib/observation'
import { planRowSelectOptions } from '../lib/planRowOptions'
import type { ObservationStatus, TabId } from '../types'
import { Badge, Button, Card, Input, Select } from './ui/Badge'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { EmptyState } from './ui/EmptyState'
import { PrintDocHeader } from './ui/PrintDocHeader'

const statusLabel: Record<ObservationStatus, string> = {
  open: '待追蹤',
  closed: '已結案',
  became_ncr: '已轉 NCR',
}

interface ObservationsProps {
  store: AuditStore
  section: ObservationSection
  onNavigate: (tab: TabId, options?: NavigateOptions) => void
}

export function Observations({ store, section, onNavigate }: ObservationsProps) {
  const {
    state,
    updateObservation,
    promoteObservationToNcr,
    carryForwardObservation,
    carryForwardNCR,
    regeneratePlan,
    addObservation,
  } = store
  const { company, settings } = state
  const currentYear = settings.auditYear
  const priorObs = company.observations.filter((o) => o.year < currentYear)
  const openPriorNCR = company.ncrs.filter(
    (n) => n.status !== '結案' && (n.sourceYear ?? currentYear - 1) < currentYear,
  )

  const currentRef = useRef<HTMLDivElement>(null)
  const priorRef = useRef<HTMLDivElement>(null)

  const [regenConfirm, setRegenConfirm] = useState(false)
  const [promoteTarget, setPromoteTarget] = useState<string | null>(null)
  const [newObs, setNewObs] = useState({
    qpCode: company.planRows[0]?.qpCode ?? 'QP-01',
    departmentId: company.planRows[0]?.departmentId ?? '',
    content: '',
    description: '',
  })
  const [contentError, setContentError] = useState<string | undefined>()

  const auditObservations = listAuditObservationEntries(company.audits)
  const planRowOptions = planRowSelectOptions(company.planRows)

  useEffect(() => {
    const target = section === 'prior' ? priorRef.current : currentRef.current
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [section])

  const importCarryForwardOnly = () => {
    for (const obs of priorObs.filter((o) => o.status === 'open' && !o.carriedToYear)) {
      carryForwardObservation(obs.id, obs.qpCode || 'QP-01', obs.departmentId)
    }
    for (const ncr of openPriorNCR.filter((n) => !n.carriedToYear)) {
      carryForwardNCR(ncr.id, ncr.qpCode, ncr.departmentId)
    }
  }

  const handleAddObservation = () => {
    if (!newObs.content.trim()) {
      setContentError('請填寫觀察內容')
      return
    }
    setContentError(undefined)
    addObservation(newObs)
    setNewObs((s) => ({ ...s, content: '', description: '' }))
  }

  const handleStatusChange = (obsId: string, next: ObservationStatus) => {
    if (next === 'became_ncr') {
      setPromoteTarget(obsId)
      return
    }
    updateObservation(obsId, { status: next })
  }

  const promoteTargetObs = promoteTarget
    ? company.observations.find((o) => o.id === promoteTarget)
    : undefined

  return (
    <div className="space-y-6 print-area">
      <PrintDocHeader
        companyName={company.name}
        auditYear={settings.auditYear}
        formTitle="觀察事項追蹤"
      />

      <ConfirmDialog
        open={regenConfirm}
        title="重新編排年度計畫"
        description="將依待追蹤項目提高風險權重並重算未鎖定的計畫月格。建議先完成「帶入查檢表」。"
        confirmLabel="重排計畫"
        onConfirm={() => {
          regeneratePlan()
          setRegenConfirm(false)
        }}
        onCancel={() => setRegenConfirm(false)}
      />

      <ConfirmDialog
        open={promoteTarget !== null}
        title="轉為不符合事項（NCR）"
        description={
          promoteTargetObs
            ? `將為「${promoteTargetObs.content}」建立 NCR 並標記為已轉 NCR。之後若改回待追蹤或已結案，已建立的 NCR 仍會保留。`
            : ''
        }
        confirmLabel="建立 NCR"
        onConfirm={() => {
          if (promoteTarget) promoteObservationToNcr(promoteTarget)
          setPromoteTarget(null)
        }}
        onCancel={() => setPromoteTarget(null)}
      />

      <div ref={currentRef} id="section-current" className="scroll-mt-6">
      <Card>
        <h2 className="mb-2 text-lg font-semibold text-ink">
          {currentYear} 年度觀察事項（來自查檢表）
        </h2>
        <p className="mb-3 text-sm text-muted no-print">
          與儀表板「本年查檢觀察」同一計數，含雙證分別判定為觀察的項目。
        </p>
        {auditObservations.length === 0 ? (
          <EmptyState message="查檢表判定「觀察」後會顯示於此。" />
        ) : (
          <ul className="space-y-2 text-sm">
            {auditObservations.map((obs) => (
              <li key={obs.id} className="rounded border border-line p-3">
                <span className="font-medium text-ink">
                  {obs.label}
                  {obs.sideLabel ? `（${obs.sideLabel}）` : ''}：
                </span>
                {obs.content}
                {obs.sourceYear && (
                  <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                    （源自 {obs.sourceYear} 年）
                  </span>
                )}
                {obs.description && (
                  <p className="mt-1 text-xs text-muted print-only">{obs.description}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      </div>

      <Card className="no-print">
        <h2 className="mb-3 text-lg font-semibold text-ink">新增觀察事項</h2>
        <p className="mb-3 text-sm text-muted">
          主要仍建議在「程序稽核」判定「觀察」；此處可手動登錄跨年追蹤。
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="程序／部門"
            value={`${newObs.qpCode}|${newObs.departmentId}`}
            onChange={(v) => {
              const [qp, dept] = v.split('|')
              setNewObs((s) => ({ ...s, qpCode: qp, departmentId: dept }))
            }}
            options={planRowOptions}
          />
          <Input
            label="觀察內容"
            value={newObs.content}
            error={contentError}
            onChange={(v) => {
              setNewObs((s) => ({ ...s, content: v }))
              if (contentError && v.trim()) setContentError(undefined)
            }}
          />
          <Input
            label="說明"
            value={newObs.description}
            onChange={(v) => setNewObs((s) => ({ ...s, description: v }))}
          />
          <div className="flex items-end">
            <Button onClick={handleAddObservation} disabled={!newObs.content.trim()}>
              新增
            </Button>
          </div>
        </div>
      </Card>

      <div ref={priorRef} id="section-prior" className="scroll-mt-6 space-y-6">
        <Card className="no-print">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">跨年度追蹤匯入</h2>
              <p className="text-sm text-muted">
                分兩步：先帶入查檢表，再視需要重排年度計畫（提高風險權重）。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={importCarryForwardOnly}>
                帶入查檢表
              </Button>
              <Button onClick={() => setRegenConfirm(true)}>重排年度計畫</Button>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="mb-2 text-lg font-semibold text-ink">跨年觀察事項追蹤</h2>
          <h3 className="mb-3 font-medium text-ink">前年度觀察事項（{priorObs.length}）</h3>
          {priorObs.length === 0 ? (
            <EmptyState message="無前年度觀察事項" />
          ) : (
            <div className="space-y-3">
              {priorObs.map((obs) => (
                <div key={obs.id} className="rounded-lg border border-line p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge label={`${obs.year}年`} />
                    <span className="font-medium text-ink">{obs.qpCode} · {obs.department}</span>
                    <Badge label={statusLabel[obs.status]} />
                    {obs.carriedToYear && (
                      <span className="text-xs text-primary">已帶入 {obs.carriedToYear} 年</span>
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
                        帶入 {currentYear} 年查檢表
                      </Button>
                    )}
                    {obs.status === 'became_ncr' ? (
                      <Button variant="secondary" onClick={() => onNavigate('ncr')}>
                        查看 NCR
                      </Button>
                    ) : (
                      <Select
                        label="狀態"
                        value={obs.status}
                        onChange={(v) => handleStatusChange(obs.id, v as ObservationStatus)}
                        options={[
                          { value: 'open', label: '待追蹤' },
                          { value: 'closed', label: '已結案' },
                          { value: 'became_ncr', label: '已轉 NCR' },
                        ]}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="mb-3 font-medium text-ink">
            前年度未結案 NCR 跨年追蹤（{openPriorNCR.length}）
          </h3>
          {openPriorNCR.length === 0 ? (
            <EmptyState message="無前年度未結案 NCR" />
          ) : (
            <ul className="space-y-2 text-sm">
              {openPriorNCR.map((ncr) => (
                <li
                  key={ncr.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-line p-3"
                >
                  <span>{ncr.ncrNumber} · {ncr.qpCode} · {ncr.description}</span>
                  {ncr.carriedToYear ? (
                    <span className="text-xs text-primary">已帶入 {ncr.carriedToYear} 年</span>
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
        </Card>
      </div>
    </div>
  )
}
