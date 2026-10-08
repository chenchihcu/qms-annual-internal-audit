import { WORKSPACE_COMPANY_ID } from '../lib/singleWorkspaceMigration'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import type {
  AnnualPersonnelAssignment,
  EvidenceAttachment,
  ManagedQualificationStatus,
  Person,
  PersonnelRole,
  QualificationRecord,
  RoleAppointment,
} from '../types'
import {
  AUDITOR_QUALIFICATION_FORM_LABELS,
  AUDITOR_QUALIFICATION_ROLES,
  currentAuditorQualification,
  isAuditorQualificationRole,
  managedQualificationStatusLabel,
  PERSONNEL_ROLE_LABELS,
  personRoles,
  qualificationState,
} from '../lib/personnel'
import { exportPersonnelExcel } from '../lib/formExport'
import { ACTION_ICONS } from '../lib/uiIcons'
import { Badge, Button, Card, Input, Select } from './ui/Badge'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { MoveToTrashDialog, type TrashDeleteTarget } from './ui/MoveToTrashDialog'
import { EmptyState } from './ui/EmptyState'
import { WorkflowGuide } from './ui/WorkflowGuide'
import { PrintDocHeader } from './ui/PrintDocHeader'
import { ScrollRegion } from './ui/ScrollRegion'
import { useTablePagination } from '../hooks/useTablePagination'
import { TablePagination } from './ui/TablePagination'
import { AttachmentField } from './ui/AttachmentField'

type AuditorQualificationRole = (typeof AUDITOR_QUALIFICATION_ROLES)[number]

interface AuditorFormState {
  id?: string
  qualificationId?: string
  name: string
  departmentId: string
  qualificationRole: AuditorQualificationRole
  qualificationStatus: ManagedQualificationStatus
  effectiveFrom: string
  evidenceAttachments: EvidenceAttachment[]
  createdAt?: string
  updatedAt?: string
}

const OTHER_ROLE_OPTIONS: { value: PersonnelRole; label: string }[] = [
  { value: 'internal_lead_auditor', label: '主任稽核員任命' },
  { value: 'management_representative', label: PERSONNEL_ROLE_LABELS.management_representative },
  { value: 'annual_escort', label: PERSONNEL_ROLE_LABELS.annual_escort },
]

const QUALIFICATION_STATUS_OPTIONS: { value: ManagedQualificationStatus; label: string }[] = [
  { value: 'effective', label: '有效' },
  { value: 'invalid', label: '失效' },
]

const OTHER_PERSONNEL_ROLES = new Set<PersonnelRole>(OTHER_ROLE_OPTIONS.map((item) => item.value))

interface OtherFormState {
  id?: string
  name: string
  type: 'internal' | 'external'
  departmentId: string
  externalOrganization: string
  role: PersonnelRole
  effectiveFrom: string
  effectiveTo: string
}

const blankAuditorForm = (): AuditorFormState => ({
  name: '',
  departmentId: '',
  qualificationRole: 'internal_auditor',
  qualificationStatus: 'effective',
  effectiveFrom: '',
  evidenceAttachments: [],
})

const blankOtherForm = (): OtherFormState => ({
  name: '',
  type: 'internal',
  departmentId: '',
  externalOrganization: '',
  role: 'internal_lead_auditor',
  effectiveFrom: '',
  effectiveTo: '',
})

function personHasOtherRoleEntry(
  person: Person,
  year: number,
  assignments: AnnualPersonnelAssignment[],
): boolean {
  const roles = personRoles(person, year, assignments)
  if (roles.some((role) => OTHER_PERSONNEL_ROLES.has(role))) return true
  const today = new Date().toISOString().slice(0, 10)
  return person.appointments.some((appointment) => (
    appointment.role === 'internal_lead_auditor'
    && (!appointment.supersededAt || appointment.supersededAt > today)
  ))
}

function activeLeadAppointment(
  person: Person,
  onDate: string,
): RoleAppointment | undefined {
  return person.appointments.find((appointment) => (
    appointment.role === 'internal_lead_auditor'
    && appointment.companyId === WORKSPACE_COMPANY_ID
    && (!appointment.supersededAt || appointment.supersededAt > onDate)
  ))
}

export function PersonnelPage({ store }: { store: AuditStore }) {
  const { state, addPerson, updatePerson, deactivatePerson, movePersonToTrash, upsertAnnualPersonnelAssignment } = store
  const [auditorEditing, setAuditorEditing] = useState<AuditorFormState | null>(null)
  const [otherEditing, setOtherEditing] = useState<OtherFormState | null>(null)
  const [auditorDirty, setAuditorDirty] = useState(false)
  const [otherDirty, setOtherDirty] = useState(false)
  const [pendingCancel, setPendingCancel] = useState<'auditor' | 'other' | null>(null)
  const [pendingDeactivate, setPendingDeactivate] = useState<Person | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TrashDeleteTarget | null>(null)
  const [saveMessage, setSaveMessage] = useState(false)
  const [nameFilter, setNameFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const editCardRef = useRef<HTMLDivElement>(null)
  const today = new Date().toISOString().slice(0, 10)

  const departmentOptions = useMemo(
    () => state.company.departments.map((department) => ({ value: department.id, label: department.name })),
    [state.company.departments],
  )

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!auditorDirty && !otherDirty) return
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [auditorDirty, otherDirty])

  useEffect(() => {
    if ((auditorEditing?.id || otherEditing?.id) && editCardRef.current) {
      editCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [auditorEditing?.id, otherEditing?.id])

  const auditorRows = useMemo(() => {
    return state.people.filter((person) => currentAuditorQualification(person, today))
  }, [state.people, today])

  const filteredAuditorRows = useMemo(() => {
    const keyword = nameFilter.trim().toLowerCase()
    return auditorRows.filter((person) => {
      const qualification = currentAuditorQualification(person, today)
      if (!qualification) return false
      if (keyword && !person.name.toLowerCase().includes(keyword)) return false
      const deptId = person.affiliations[0]?.departmentId ?? ''
      if (departmentFilter && deptId !== departmentFilter) return false
      const statusLabel = managedQualificationStatusLabel(qualification, today)
      if (statusFilter && statusLabel !== statusFilter) return false
      return true
    })
  }, [auditorRows, nameFilter, departmentFilter, statusFilter, today])

  const otherRows = useMemo(
    () => state.people.filter((person) => personHasOtherRoleEntry(
      person,
      state.settings.auditYear,
      state.annualPersonnelAssignments,
    )),
    [state.people, state.settings.auditYear, state.annualPersonnelAssignments],
  )

  const patchAuditorForm = (patch: Partial<AuditorFormState>) => {
    setAuditorEditing((current) => current ? { ...current, ...patch } : current)
    setAuditorDirty(true)
  }

  const patchOtherForm = (patch: Partial<OtherFormState>) => {
    setOtherEditing((current) => current ? { ...current, ...patch } : current)
    setOtherDirty(true)
  }

  const openAuditorEdit = (person: Person) => {
    const qualification = currentAuditorQualification(person, today)
    if (!qualification || !isAuditorQualificationRole(qualification.role)) return
    setOtherEditing(null)
    setOtherDirty(false)
    setAuditorEditing({
      id: person.id,
      qualificationId: qualification.id,
      name: person.name,
      departmentId: person.affiliations[0]?.departmentId ?? '',
      qualificationRole: qualification.role,
      qualificationStatus: qualification.qualificationStatus ?? legacyManagedStatus(qualification, today),
      effectiveFrom: qualification.effectiveFrom ?? '',
      evidenceAttachments: qualification.evidenceAttachments ?? [],
      createdAt: qualification.createdAt,
      updatedAt: qualification.updatedAt,
    })
    setAuditorDirty(false)
  }

  const openOtherEdit = (person: Person) => {
    const roles = personRoles(person, state.settings.auditYear, state.annualPersonnelAssignments)
    const role = roles.find((item) => OTHER_PERSONNEL_ROLES.has(item)) ?? 'internal_lead_auditor'
    const appointment = activeLeadAppointment(person, today)
      ?? person.appointments.find((item) => (
        (item.role === role || (role === 'management_representative' && item.role === 'management_representative'))
        && item.companyId === WORKSPACE_COMPANY_ID
      ))
    setOtherEditing({
      id: person.id,
      name: person.name,
      type: person.type,
      departmentId: person.affiliations[0]?.departmentId ?? '',
      externalOrganization: person.affiliations[0]?.externalOrganization ?? '',
      role,
      effectiveFrom: appointment?.effectiveFrom ?? '',
      effectiveTo: appointment?.effectiveTo ?? '',
    })
    setOtherDirty(false)
  }

function legacyManagedStatus(
  qualification: QualificationRecord,
  onDate: string,
): ManagedQualificationStatus {
  if (qualification.suspendedAt && qualification.suspendedAt <= onDate) return 'suspended'
  if (qualification.endedAt && qualification.endedAt <= onDate) return 'invalid'
  if (qualification.supersededAt && qualification.supersededAt <= onDate) return 'invalid'
  const state = qualificationState(qualification, onDate)
  if (state === 'effective') return 'effective'
  if (state === 'suspended') return 'suspended'
  return 'invalid'
}

  const cancelAuditor = () => {
    if (auditorDirty) {
      setPendingCancel('auditor')
      return
    }
    setAuditorEditing(null)
    setAuditorDirty(false)
  }

  const cancelOther = () => {
    if (otherDirty) {
      setPendingCancel('other')
      return
    }
    setOtherEditing(null)
    setOtherDirty(false)
  }

  const saveAuditor = () => {
    if (!auditorEditing?.name.trim() || !auditorEditing.departmentId) return
    const now = new Date().toISOString()
    const existing = state.people.find((person) => person.id === auditorEditing.id)
    const affiliation = {
      id: existing?.affiliations[0]?.id ?? `aff-${crypto.randomUUID()}`,
      companyId: WORKSPACE_COMPANY_ID,
      departmentId: auditorEditing.departmentId,
      effectiveFrom: existing?.affiliations[0]?.effectiveFrom,
      effectiveTo: existing?.affiliations[0]?.effectiveTo,
    }
    const existingQual = existing?.qualifications.find((item) => item.id === auditorEditing.qualificationId)
      ?? existing?.qualifications.toReversed().find((item) => (
        isAuditorQualificationRole(item.role) && (!item.supersededAt || item.supersededAt > today)
      ))
    const qualification: QualificationRecord = {
      id: existingQual?.id ?? `qual-${crypto.randomUUID()}`,
      role: auditorEditing.qualificationRole,
      companyIds: [WORKSPACE_COMPANY_ID],
      standardVersions: existingQual?.standardVersions ?? [],
      procedureScopes: existingQual?.procedureScopes ?? [],
      departmentScopes: existingQual?.departmentScopes ?? [],
      documentTitle: existingQual?.documentTitle ?? '',
      documentNumber: existingQual?.documentNumber ?? '',
      documentLocation: existingQual?.documentLocation ?? '',
      assessedBy: existingQual?.assessedBy ?? '',
      assessmentDate: existingQual?.assessmentDate ?? '',
      effectiveFrom: auditorEditing.effectiveFrom,
      validityMode: existingQual?.validityMode ?? 'no_expiry',
      effectiveTo: existingQual?.effectiveTo,
      suspendedAt: auditorEditing.qualificationStatus === 'suspended' ? (existingQual?.suspendedAt ?? today) : undefined,
      endedAt: auditorEditing.qualificationStatus === 'invalid' ? (existingQual?.endedAt ?? today) : undefined,
      supersededAt: existingQual?.supersededAt,
      revisionOfId: existingQual?.revisionOfId,
      revisedAt: existingQual?.revisedAt,
      statusReason: existingQual?.statusReason,
      qualificationStatus: auditorEditing.qualificationStatus,
      applicableStandard: 'AS9100',
      evidenceAttachments: [...auditorEditing.evidenceAttachments],
      createdAt: existingQual?.createdAt ?? now,
      updatedAt: now,
    }
    const otherQualifications = (existing?.qualifications ?? []).filter((item) => item.id !== qualification.id)
    const person: Omit<Person, 'id'> = {
      name: auditorEditing.name.trim(),
      employeeNumber: existing?.employeeNumber ?? '',
      type: 'internal',
      affiliations: [affiliation],
      qualifications: [...otherQualifications, qualification],
      appointments: existing?.appointments ?? [],
      active: existing?.active ?? true,
      notes: existing?.notes ?? '',
    }
    if (existing) updatePerson(existing.id, person)
    else addPerson(person)
    setAuditorEditing(null)
    setAuditorDirty(false)
    setSaveMessage(true)
  }

  const saveOther = () => {
    if (!otherEditing?.name.trim()) return
    const existing = state.people.find((person) => person.id === otherEditing.id)
    const companyId = WORKSPACE_COMPANY_ID
    const affiliation = {
      id: existing?.affiliations[0]?.id ?? `aff-${crypto.randomUUID()}`,
      companyId,
      departmentId: otherEditing.type === 'internal' || otherEditing.role === 'annual_escort'
        ? otherEditing.departmentId || undefined
        : undefined,
      externalOrganization: otherEditing.type === 'external' ? otherEditing.externalOrganization || undefined : undefined,
    }
    const revisionDate = otherEditing.effectiveFrom || today
    const existingAppointment = existing?.appointments.toReversed().find((item) => {
      if (otherEditing.role === 'internal_lead_auditor') {
        return item.role === 'internal_lead_auditor' && item.companyId === companyId && (!item.supersededAt || item.supersededAt > today)
      }
      if (otherEditing.role === 'management_representative') {
        return item.role === 'management_representative' && item.companyId === companyId && (!item.supersededAt || item.supersededAt > today)
      }
      return false
    })
    let appointments = [...(existing?.appointments ?? [])]
    const needsAppointment = otherEditing.role === 'internal_lead_auditor'
      || otherEditing.role === 'management_representative'
    if (needsAppointment) {
      const effectiveFrom = otherEditing.effectiveFrom || today
      if (existingAppointment) {
        appointments = appointments.map((item) => item.id === existingAppointment.id
          ? { ...item, supersededAt: revisionDate }
          : item)
      }
      if (otherEditing.role === 'internal_lead_auditor' || otherEditing.role === 'management_representative') {
        appointments.push({
          id: `appointment-${crypto.randomUUID()}`,
          role: otherEditing.role,
          companyId,
          documentReference: existingAppointment?.documentReference ?? '',
          scope: existingAppointment?.scope ?? '',
          effectiveFrom,
          effectiveTo: otherEditing.effectiveTo || undefined,
          revisionOfId: existingAppointment?.id,
          revisedAt: new Date().toISOString(),
        })
      }
    }
    const person: Omit<Person, 'id'> = {
      name: otherEditing.name.trim(),
      employeeNumber: existing?.employeeNumber ?? '',
      type: otherEditing.type,
      affiliations: [affiliation],
      qualifications: existing?.qualifications ?? [],
      appointments,
      active: existing?.active ?? true,
      notes: existing?.notes ?? '',
    }
    const savedId = existing ? (updatePerson(existing.id, person), existing.id) : addPerson(person)
    if (otherEditing.role === 'internal_lead_auditor' || otherEditing.role === 'annual_escort' || otherEditing.role === 'management_representative') {
      upsertAnnualPersonnelAssignment({
        year: state.settings.auditYear,
        companyId,
        personId: savedId,
        role: otherEditing.role === 'annual_escort'
          ? 'annual_escort'
          : otherEditing.role as AnnualPersonnelAssignment['role'],
        departmentId: otherEditing.departmentId || undefined,
      })
    }
    setOtherEditing(null)
    setOtherDirty(false)
    setSaveMessage(true)
  }

  const exportExcel = () => {
    exportPersonnelExcel(state, WORKSPACE_COMPANY_ID)
  }

  const auditorPagination = useTablePagination(filteredAuditorRows.length, 10, undefined, String(state.settings.auditYear))

  const otherRoleSummary = (person: Person): string => {
    const roles = personRoles(person, state.settings.auditYear, state.annualPersonnelAssignments)
    const labels = roles
      .filter((role) => OTHER_PERSONNEL_ROLES.has(role))
      .map((role) => (role === 'internal_lead_auditor' ? '主任稽核員任命' : PERSONNEL_ROLE_LABELS[role]))
    if (activeLeadAppointment(person, today) && !labels.includes('主任稽核員任命')) {
      labels.unshift('主任稽核員任命')
    }
    return labels.join('、') || '—'
  }

  return (
    <div className="space-y-6 print-area qr-form">
      <PrintDocHeader
        companyName={state.company.name}
        auditYear={state.settings.auditYear}
        formTitle="人員合格名單"
      />
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-end gap-3 no-print">
          <WorkflowGuide tab="personnel" state={state} className="mr-auto min-w-[min(100%,12rem)] flex-1" />
          <Button icon={ACTION_ICONS.add} onClick={() => {
            setAuditorEditing(blankAuditorForm())
            setOtherEditing(null)
            setAuditorDirty(false)
            setOtherDirty(false)
            setSaveMessage(false)
          }}
          >
            新增稽核員
          </Button>
          <Button variant="secondary" icon={ACTION_ICONS.exportExcel} onClick={exportExcel}>匯出名單</Button>
        </div>
        {saveMessage && !auditorEditing && !otherEditing && (
          <p className="mb-3 text-sm text-green-700" role="status">已儲存</p>
        )}
      </div>

      {auditorEditing && (
        <div ref={editCardRef}>
          <Card className="border-blue-200">
            <h3 className="mb-4 text-sm font-semibold">{auditorEditing.id ? '編輯內部稽核人員資格' : '新增內部稽核人員資格'}</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="姓名 *" value={auditorEditing.name} onChange={(v) => patchAuditorForm({ name: v })} />
              <Select
                label="所屬單位 *"
                value={auditorEditing.departmentId}
                onChange={(v) => patchAuditorForm({ departmentId: v })}
                options={[{ value: '', label: '請選擇' }, ...departmentOptions]}
              />
              <Select
                label="稽核資格 *"
                value={auditorEditing.qualificationRole}
                onChange={(v) => patchAuditorForm({ qualificationRole: v as AuditorQualificationRole })}
                options={AUDITOR_QUALIFICATION_ROLES.map((role) => ({
                  value: role,
                  label: AUDITOR_QUALIFICATION_FORM_LABELS[role],
                }))}
              />
              <Select
                label="資格狀態 *"
                value={auditorEditing.qualificationStatus}
                onChange={(v) => patchAuditorForm({ qualificationStatus: v as ManagedQualificationStatus })}
                options={
                  auditorEditing.qualificationStatus === 'suspended'
                    ? [...QUALIFICATION_STATUS_OPTIONS, { value: 'suspended', label: '暫停' }]
                    : QUALIFICATION_STATUS_OPTIONS
                }
              />
              <Input
                label="資格取得日"
                type="date"
                value={auditorEditing.effectiveFrom}
                onChange={(v) => patchAuditorForm({ effectiveFrom: v })}
              />
              <div className="sm:col-span-2">
                <AttachmentField
                  label="資格證據"
                  attachments={auditorEditing.evidenceAttachments}
                  onChange={(evidenceAttachments) => patchAuditorForm({ evidenceAttachments })}
                />
              </div>
            </div>
            {(auditorEditing.createdAt || auditorEditing.updatedAt) && (
              <p className="mt-3 text-xs text-muted">
                {auditorEditing.createdAt ? `建立：${auditorEditing.createdAt.slice(0, 19).replace('T', ' ')}` : ''}
                {auditorEditing.updatedAt ? ` · 最後修改：${auditorEditing.updatedAt.slice(0, 19).replace('T', ' ')}` : ''}
              </p>
            )}
            <div className="mt-5 flex gap-2">
              <Button variant="secondary" onClick={cancelAuditor}>取消</Button>
              <Button
                onClick={saveAuditor}
                disabled={!auditorEditing.name.trim() || !auditorEditing.departmentId}
              >
                儲存
              </Button>
            </div>
          </Card>
        </div>
      )}

      <div>
        <h3 className="mb-3 text-sm font-semibold">內部稽核人員清單</h3>
        <div className="no-print mb-3 grid gap-3 sm:grid-cols-3">
          <Input label="搜尋姓名" value={nameFilter} onChange={setNameFilter} />
          <Select
            label="所屬單位"
            value={departmentFilter}
            onChange={setDepartmentFilter}
            options={[{ value: '', label: '全部' }, ...departmentOptions]}
          />
          <Select
            label="資格狀態"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: '', label: '全部' },
              { value: '有效', label: '有效' },
              { value: '失效', label: '失效' },
            ]}
          />
        </div>
        {filteredAuditorRows.length === 0 ? (
          <EmptyState message="目前沒有符合條件的內部稽核人員。" />
        ) : (
          <>
            <ScrollRegion ariaLabel="內部稽核人員清單">
              <table className="worksheet-table min-w-[32rem]">
                <colgroup>
                  <col className="col-person-name" />
                  <col className="col-person-dept" />
                  <col className="col-person-role" />
                  <col className="col-person-status" />
                  <col className="col-person-action no-print" />
                </colgroup>
                <thead>
                  <tr>
                    <th>姓名</th>
                    <th>所屬單位</th>
                    <th>稽核資格</th>
                    <th>資格狀態</th>
                    <th className="no-print">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAuditorRows.map((person, index) => {
                    const qualification = currentAuditorQualification(person, today)!
                    const statusLabel = managedQualificationStatusLabel(qualification, today)
                    const deptName = state.company.departments.find((d) => d.id === person.affiliations[0]?.departmentId)?.name ?? '—'
                    return (
                      <tr
                        key={person.id}
                        className={!auditorPagination.isVisible(index) ? 'pagination-hidden-row' : ''}
                      >
                        <td className="font-medium">{person.name}</td>
                        <td>{deptName}</td>
                        <td>
                          {isAuditorQualificationRole(qualification.role)
                            ? AUDITOR_QUALIFICATION_FORM_LABELS[qualification.role]
                            : '—'}
                        </td>
                        <td><Badge label={statusLabel} /></td>
                        <td className="no-print">
                          <div className="flex flex-wrap gap-1">
                            <Button variant="ghost" icon={ACTION_ICONS.edit} className="shrink-0 whitespace-nowrap" onClick={() => openAuditorEdit(person)}>編輯</Button>
                            {person.active && (
                              <Button variant="ghost" icon="minusCircle" className="shrink-0 whitespace-nowrap" onClick={() => setPendingDeactivate(person)}>停用</Button>
                            )}
                            <Button
                              variant="ghost"
                              icon={ACTION_ICONS.delete}
                              className="shrink-0 text-red-700"
                              aria-label={`移至回收區：${person.name}`}
                              title="移至回收區"
                              onClick={() => setDeleteTarget({ id: person.id, label: person.name })}
                            />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </ScrollRegion>
            <TablePagination pagination={auditorPagination} label="內部稽核人員清單" />
          </>
        )}
      </div>

      {otherEditing && (
        <div ref={editCardRef}>
          <Card className="border-slate-200">
            <h3 className="mb-4 text-sm font-semibold">{otherEditing.id ? '編輯其他角色與任命' : '新增其他角色與任命'}</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="姓名 *" value={otherEditing.name} onChange={(v) => patchOtherForm({ name: v })} />
              <Select
                label="人員類型"
                value={otherEditing.type}
                onChange={(v) => patchOtherForm({ type: v as OtherFormState['type'] })}
                options={[{ value: 'internal', label: '內部人員' }, { value: 'external', label: '外部人員' }]}
              />
              {otherEditing.type === 'external' && (
                <Input label="外部機構" value={otherEditing.externalOrganization} onChange={(v) => patchOtherForm({ externalOrganization: v })} />
              )}
              {(otherEditing.type === 'internal' || otherEditing.role === 'annual_escort') && (
                <Select
                  label="所屬單位"
                  value={otherEditing.departmentId}
                  onChange={(v) => patchOtherForm({ departmentId: v })}
                  options={[{ value: '', label: '待確認' }, ...departmentOptions]}
                />
              )}
              <Select
                label="角色／任命"
                value={otherEditing.role}
                onChange={(v) => patchOtherForm({ role: v as PersonnelRole })}
                options={OTHER_ROLE_OPTIONS}
              />
              {(otherEditing.role === 'internal_lead_auditor' || otherEditing.role === 'management_representative') && (
                <>
                  <Input label="生效日期" type="date" value={otherEditing.effectiveFrom} onChange={(v) => patchOtherForm({ effectiveFrom: v })} />
                  <Input label="到期日" type="date" value={otherEditing.effectiveTo} onChange={(v) => patchOtherForm({ effectiveTo: v })} />
                </>
              )}
            </div>
            <div className="mt-5 flex gap-2">
              <Button variant="secondary" onClick={cancelOther}>取消</Button>
              <Button onClick={saveOther} disabled={!otherEditing.name.trim()}>儲存</Button>
            </div>
          </Card>
        </div>
      )}

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">其他角色與任命</h3>
          <Button
            variant="secondary"
            icon={ACTION_ICONS.add}
            className="no-print"
            onClick={() => {
              setOtherEditing(blankOtherForm())
              setAuditorEditing(null)
              setAuditorDirty(false)
              setOtherDirty(false)
            }}
          >
            新增
          </Button>
        </div>
        {otherRows.length === 0 ? (
          <EmptyState message="尚無管理代表、陪稽或主任稽核員任命。" />
        ) : (
          <ScrollRegion ariaLabel="其他角色與任命清單">
            <table className="worksheet-table min-w-[32rem]">
              <thead>
                <tr>
                  <th>姓名</th>
                  <th>角色／任命</th>
                  <th className="no-print">操作</th>
                </tr>
              </thead>
              <tbody>
                {otherRows.map((person) => (
                  <tr key={person.id}>
                    <td className="font-medium">{person.name}</td>
                    <td>{otherRoleSummary(person)}</td>
                    <td className="no-print">
                      <Button variant="ghost" icon={ACTION_ICONS.edit} onClick={() => openOtherEdit(person)}>編輯</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollRegion>
        )}
      </div>

      {pendingCancel && (
        <ConfirmDialog
          open
          title="放棄未儲存變更？"
          description="尚有未儲存變更，確定取消編輯？"
          confirmLabel="放棄變更"
          variant="danger"
          onConfirm={() => {
            if (pendingCancel === 'auditor') {
              setAuditorEditing(null)
              setAuditorDirty(false)
            } else {
              setOtherEditing(null)
              setOtherDirty(false)
            }
            setPendingCancel(null)
          }}
          onCancel={() => setPendingCancel(null)}
        />
      )}
      {pendingDeactivate && (
        <ConfirmDialog
          open
          title={`停用 ${pendingDeactivate.name}？`}
          description="停用後歷史稽核事件仍保留人員快照，但此人不再出現於可指派清單。"
          confirmLabel="停用"
          variant="danger"
          onConfirm={() => {
            deactivatePerson(pendingDeactivate.id)
            setPendingDeactivate(null)
          }}
          onCancel={() => setPendingDeactivate(null)}
        />
      )}
      <MoveToTrashDialog
        target={deleteTarget}
        onConfirm={() => {
          if (deleteTarget) movePersonToTrash(deleteTarget.id)
          setDeleteTarget(null)
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
