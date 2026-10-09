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
import { CheckboxList } from './ui/CheckboxList'
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

/** 統一新增表單的角色；auditor 寫資格，其餘寫任命／年度指派 */
type PersonFormRole = 'auditor' | 'lead_appointment' | 'management_representative' | 'annual_escort'

const PERSON_ROLE_OPTIONS: { value: PersonFormRole; label: string }[] = [
  { value: 'auditor', label: '內部稽核員' },
  { value: 'lead_appointment', label: '主任稽核員' },
  { value: 'management_representative', label: '管理代表' },
  { value: 'annual_escort', label: '陪稽人員' },
]

const QUALIFICATION_STATUS_OPTIONS: { value: ManagedQualificationStatus; label: string }[] = [
  { value: 'effective', label: '有效' },
  { value: 'invalid', label: '失效' },
]

const OTHER_PERSONNEL_ROLES = new Set<PersonnelRole>([
  'internal_lead_auditor',
  'management_representative',
  'annual_escort',
])

interface PersonFormState {
  id?: string
  name: string
  type: 'internal' | 'external'
  departmentId: string
  externalOrganization: string
  roles: PersonFormRole[]
  qualificationId?: string
  qualificationRole: AuditorQualificationRole
  qualificationStatus: ManagedQualificationStatus
  qualificationFrom: string
  evidenceAttachments: EvidenceAttachment[]
  createdAt?: string
  updatedAt?: string
  leadFrom: string
  leadTo: string
  mrFrom: string
  mrTo: string
  /** 停用人員儲存時重新啟用 */
  reactivate?: boolean
}

const blankPersonForm = (): PersonFormState => ({
  name: '',
  type: 'internal',
  departmentId: '',
  externalOrganization: '',
  roles: [],
  qualificationRole: 'internal_auditor',
  qualificationStatus: 'effective',
  qualificationFrom: '',
  evidenceAttachments: [],
  leadFrom: '',
  leadTo: '',
  mrFrom: '',
  mrTo: '',
})

const orderRoles = (roles: PersonFormRole[]): PersonFormRole[] => (
  PERSON_ROLE_OPTIONS.map((option) => option.value).filter((role) => roles.includes(role))
)

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

function activeAppointment(
  person: Person,
  role: 'internal_lead_auditor' | 'management_representative',
  onDate: string,
): RoleAppointment | undefined {
  return person.appointments.toReversed().find((appointment) => (
    appointment.role === role
    && appointment.companyId === WORKSPACE_COMPANY_ID
    && (!appointment.supersededAt || appointment.supersededAt > onDate)
  ))
}

function activeLeadAppointment(person: Person, onDate: string): RoleAppointment | undefined {
  return activeAppointment(person, 'internal_lead_auditor', onDate)
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

function auditorFieldsChanged(form: PersonFormState, initial: PersonFormState): boolean {
  return form.qualificationRole !== initial.qualificationRole
    || form.qualificationStatus !== initial.qualificationStatus
    || form.qualificationFrom !== initial.qualificationFrom
    || JSON.stringify(form.evidenceAttachments) !== JSON.stringify(initial.evidenceAttachments)
}

export function PersonnelPage({ store }: { store: AuditStore }) {
  const { state, addPerson, updatePerson, deactivatePerson, movePersonToTrash, upsertAnnualPersonnelAssignment } = store
  const [editing, setEditing] = useState<PersonFormState | null>(null)
  /** 編輯開啟時的快照：鎖定既有角色、判斷資格／任命是否需要重寫 */
  const [initialForm, setInitialForm] = useState<PersonFormState | null>(null)
  const [dirty, setDirty] = useState(false)
  const [pendingCancel, setPendingCancel] = useState(false)
  const [pendingDeactivate, setPendingDeactivate] = useState<Person | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TrashDeleteTarget | null>(null)
  const [saveMessage, setSaveMessage] = useState(false)
  const editCardRef = useRef<HTMLDivElement>(null)
  const today = new Date().toISOString().slice(0, 10)

  const departmentOptions = useMemo(
    () => state.company.departments.map((department) => ({ value: department.id, label: department.name })),
    [state.company.departments],
  )

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  useEffect(() => {
    if (editing?.id && editCardRef.current) {
      editCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [editing?.id])

  const auditorRows = useMemo(() => {
    return state.people.filter((person) => currentAuditorQualification(person, today))
  }, [state.people, today])

  const otherRows = useMemo(
    () => state.people.filter((person) => personHasOtherRoleEntry(
      person,
      state.settings.auditYear,
      state.annualPersonnelAssignments,
    )),
    [state.people, state.settings.auditYear, state.annualPersonnelAssignments],
  )

  const lockedRoles = initialForm?.id ? initialForm.roles : []
  const isAuditor = editing?.roles.includes('auditor') ?? false
  const formType = isAuditor ? 'internal' : editing?.type ?? 'internal'
  const trimmedName = editing?.name.trim() ?? ''
  const duplicatePerson = trimmedName
    ? state.people.find((person) => person.id !== editing?.id && person.name.trim() === trimmedName)
    : undefined
  const missingFields = editing
    ? [
        !trimmedName ? '姓名' : '',
        editing.roles.length === 0 ? '角色' : '',
        isAuditor && !editing.departmentId ? '所屬單位' : '',
      ].filter(Boolean)
    : []
  const canSave = missingFields.length === 0 && !duplicatePerson
  const editingPerson = editing?.id ? state.people.find((person) => person.id === editing.id) : undefined
  const editingInactivePerson = editingPerson?.active === false
  /** 停用／移至回收區只開放給稽核人員清單上的人員（與原列上操作同範圍） */
  const editingRetirable = editingPerson && currentAuditorQualification(editingPerson, today) ? editingPerson : undefined

  const patchForm = (patch: Partial<PersonFormState>) => {
    setEditing((current) => current ? { ...current, ...patch } : current)
    setDirty(true)
  }

  const setRoles = (selected: string[]) => {
    const roles = orderRoles(selected as PersonFormRole[])
    patchForm(roles.includes('auditor') ? { roles, type: 'internal' } : { roles })
  }

  const formFromPerson = (person: Person): PersonFormState => {
    const qualification = currentAuditorQualification(person, today)
    const auditorQual = qualification && isAuditorQualificationRole(qualification.role) ? qualification : undefined
    const annualRoles = state.annualPersonnelAssignments
      .filter((item) => item.personId === person.id && item.year === state.settings.auditYear)
      .map((item) => item.role)
    const lead = activeLeadAppointment(person, today)
    const mr = activeAppointment(person, 'management_representative', today)
    const roles: PersonFormRole[] = []
    if (auditorQual) roles.push('auditor')
    if (lead || annualRoles.includes('internal_lead_auditor')) roles.push('lead_appointment')
    if (mr || annualRoles.includes('management_representative')) roles.push('management_representative')
    if (annualRoles.includes('annual_escort')) roles.push('annual_escort')
    return {
      ...blankPersonForm(),
      id: person.id,
      name: person.name,
      type: person.type,
      departmentId: person.affiliations[0]?.departmentId ?? '',
      externalOrganization: person.affiliations[0]?.externalOrganization ?? '',
      roles,
      ...(auditorQual && isAuditorQualificationRole(auditorQual.role)
        ? {
            qualificationId: auditorQual.id,
            qualificationRole: auditorQual.role,
            qualificationStatus: auditorQual.qualificationStatus ?? legacyManagedStatus(auditorQual, today),
            qualificationFrom: auditorQual.effectiveFrom ?? '',
            evidenceAttachments: auditorQual.evidenceAttachments ?? [],
            createdAt: auditorQual.createdAt,
            updatedAt: auditorQual.updatedAt,
          }
        : {}),
      leadFrom: lead?.effectiveFrom ?? '',
      leadTo: lead?.effectiveTo ?? '',
      mrFrom: mr?.effectiveFrom ?? '',
      mrTo: mr?.effectiveTo ?? '',
    }
  }

  const openCreate = () => {
    setEditing(blankPersonForm())
    setInitialForm(null)
    setDirty(false)
    setSaveMessage(false)
  }

  const openEdit = (person: Person) => {
    const form = formFromPerson(person)
    setEditing(form)
    setInitialForm(form)
    setDirty(false)
  }

  /** 新增時遇同名人員：改為編輯該人，並保留已勾選的新角色與其欄位 */
  const loadExistingPerson = (person: Person) => {
    if (!editing) return
    const base = formFromPerson(person)
    const roles = orderRoles([...new Set([...base.roles, ...editing.roles])])
    const merged: PersonFormState = {
      ...base,
      roles,
      type: roles.includes('auditor') ? 'internal' : base.type,
      departmentId: base.departmentId || editing.departmentId,
      ...(!base.roles.includes('auditor') && editing.roles.includes('auditor')
        ? {
            qualificationRole: editing.qualificationRole,
            qualificationStatus: editing.qualificationStatus,
            qualificationFrom: editing.qualificationFrom,
            evidenceAttachments: editing.evidenceAttachments,
          }
        : {}),
      ...(!base.roles.includes('lead_appointment') ? { leadFrom: editing.leadFrom, leadTo: editing.leadTo } : {}),
      ...(!base.roles.includes('management_representative') ? { mrFrom: editing.mrFrom, mrTo: editing.mrTo } : {}),
      // 為停用人員加角色時，預設勾選重新啟用（畫面可取消）
      reactivate: !person.active,
    }
    setEditing(merged)
    setInitialForm(base)
    setDirty(true)
  }

  const closeForm = () => {
    setEditing(null)
    setInitialForm(null)
    setDirty(false)
  }

  const cancelEdit = () => {
    if (dirty) {
      setPendingCancel(true)
      return
    }
    closeForm()
  }

  const savePerson = () => {
    if (!editing || !canSave) return
    const form = editing
    const now = new Date().toISOString()
    const companyId = WORKSPACE_COMPANY_ID
    const existing = state.people.find((person) => person.id === form.id)
    const hasRole = (role: PersonFormRole) => form.roles.includes(role)
    const hadRole = (role: PersonFormRole) => initialForm?.roles.includes(role) ?? false
    const previousAffiliation = existing?.affiliations[0]
    const affiliation = {
      id: previousAffiliation?.id ?? `aff-${crypto.randomUUID()}`,
      companyId,
      departmentId: formType === 'internal' || hasRole('annual_escort') ? form.departmentId || undefined : undefined,
      externalOrganization: formType === 'external' ? form.externalOrganization || undefined : undefined,
      effectiveFrom: previousAffiliation?.effectiveFrom,
      effectiveTo: previousAffiliation?.effectiveTo,
    }

    let qualifications = existing?.qualifications ?? []
    if (hasRole('auditor') && (!hadRole('auditor') || !initialForm || auditorFieldsChanged(form, initialForm))) {
      const existingQual = existing?.qualifications.find((item) => item.id === form.qualificationId)
        ?? existing?.qualifications.toReversed().find((item) => (
          isAuditorQualificationRole(item.role) && (!item.supersededAt || item.supersededAt > today)
        ))
      const qualification: QualificationRecord = {
        id: existingQual?.id ?? `qual-${crypto.randomUUID()}`,
        role: form.qualificationRole,
        companyIds: [companyId],
        standardVersions: existingQual?.standardVersions ?? [],
        procedureScopes: existingQual?.procedureScopes ?? [],
        departmentScopes: existingQual?.departmentScopes ?? [],
        documentTitle: existingQual?.documentTitle ?? '',
        documentNumber: existingQual?.documentNumber ?? '',
        documentLocation: existingQual?.documentLocation ?? '',
        assessedBy: existingQual?.assessedBy ?? '',
        assessmentDate: existingQual?.assessmentDate ?? '',
        effectiveFrom: form.qualificationFrom,
        validityMode: existingQual?.validityMode ?? 'no_expiry',
        effectiveTo: existingQual?.effectiveTo,
        suspendedAt: form.qualificationStatus === 'suspended' ? (existingQual?.suspendedAt ?? today) : undefined,
        endedAt: form.qualificationStatus === 'invalid' ? (existingQual?.endedAt ?? today) : undefined,
        supersededAt: existingQual?.supersededAt,
        revisionOfId: existingQual?.revisionOfId,
        revisedAt: existingQual?.revisedAt,
        statusReason: existingQual?.statusReason,
        qualificationStatus: form.qualificationStatus,
        applicableStandard: 'AS9100',
        evidenceAttachments: [...form.evidenceAttachments],
        createdAt: existingQual?.createdAt ?? now,
        updatedAt: now,
      }
      qualifications = [...qualifications.filter((item) => item.id !== qualification.id), qualification]
    }

    let appointments = [...(existing?.appointments ?? [])]
    const reviseAppointment = (
      role: 'internal_lead_auditor' | 'management_representative',
      from: string,
      to: string,
      initialFrom: string | undefined,
      initialTo: string | undefined,
      hadRoleBefore: boolean,
    ) => {
      const current = appointments.toReversed().find((item) => (
        item.role === role && item.companyId === companyId && (!item.supersededAt || item.supersededAt > today)
      ))
      // 既有角色且日期未改：不產生空修訂，也不把僅年度指派的角色升格為長期任命
      if (hadRoleBefore && from === initialFrom && to === initialTo) return
      const effectiveFrom = from || today
      if (current) {
        appointments = appointments.map((item) => item.id === current.id ? { ...item, supersededAt: effectiveFrom } : item)
      }
      appointments.push({
        id: `appointment-${crypto.randomUUID()}`,
        role,
        companyId,
        documentReference: current?.documentReference ?? '',
        scope: current?.scope ?? '',
        effectiveFrom,
        effectiveTo: to || undefined,
        revisionOfId: current?.id,
        revisedAt: now,
      })
    }
    if (hasRole('lead_appointment')) {
      reviseAppointment('internal_lead_auditor', form.leadFrom, form.leadTo, initialForm?.leadFrom, initialForm?.leadTo, hadRole('lead_appointment'))
    }
    if (hasRole('management_representative')) {
      reviseAppointment('management_representative', form.mrFrom, form.mrTo, initialForm?.mrFrom, initialForm?.mrTo, hadRole('management_representative'))
    }

    const person: Omit<Person, 'id'> = {
      name: trimmedName,
      employeeNumber: existing?.employeeNumber ?? '',
      type: formType,
      affiliations: [affiliation],
      qualifications,
      appointments,
      active: existing ? existing.active || form.reactivate === true : true,
      notes: existing?.notes ?? '',
    }
    const savedId = existing ? (updatePerson(existing.id, person), existing.id) : addPerson(person)

    const annualRoles: AnnualPersonnelAssignment['role'][] = [
      ...(hasRole('lead_appointment') ? ['internal_lead_auditor' as const] : []),
      ...(hasRole('management_representative') ? ['management_representative' as const] : []),
      ...(hasRole('annual_escort') ? ['annual_escort' as const] : []),
    ]
    annualRoles.forEach((role) => upsertAnnualPersonnelAssignment({
      year: state.settings.auditYear,
      companyId,
      personId: savedId,
      role,
      departmentId: affiliation.departmentId,
    }))
    closeForm()
    setSaveMessage(true)
  }

  const exportExcel = () => {
    exportPersonnelExcel(state, WORKSPACE_COMPANY_ID)
  }

  const auditorPagination = useTablePagination(auditorRows.length, 10, undefined, String(state.settings.auditYear))

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
          <Button icon={ACTION_ICONS.add} onClick={openCreate}>新增人員</Button>
          <Button variant="secondary" icon={ACTION_ICONS.exportExcel} onClick={exportExcel}>匯出名單</Button>
        </div>
        {saveMessage && !editing && (
          <p className="mb-3 text-sm text-tone-success-fg" role="status">已儲存</p>
        )}
      </div>

      {editing && (
        <div ref={editCardRef}>
          <Card className="border-tone-info-line">
            <h3 className="mb-4 text-sm font-bold">{editing.id ? '編輯人員' : '新增人員'}</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Input
                  label="姓名 *"
                  value={editing.name}
                  onChange={(v) => patchForm({ name: v })}
                  error={duplicatePerson ? '已有同名人員，請改為編輯該人員以加入角色。' : undefined}
                />
                {duplicatePerson && !editing.id && (
                  <Button variant="secondary" className="mt-2" onClick={() => loadExistingPerson(duplicatePerson)}>
                    載入既有人員
                  </Button>
                )}
                {editingInactivePerson && (
                  <label className="mt-2 flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={editing.reactivate === true}
                      onChange={(event) => patchForm({ reactivate: event.target.checked })}
                    />
                    <span>重新啟用此人員（目前停用；未啟用時不會出現在稽核指派名單）</span>
                  </label>
                )}
              </div>
              <CheckboxList
                label="角色 *"
                options={PERSON_ROLE_OPTIONS}
                selected={editing.roles}
                onChange={setRoles}
                disabledValues={lockedRoles}
                inline
                footer={lockedRoles.length > 0 && (
                  <p className="mt-1 text-xs text-muted">既有角色不在此移除；資格請改資格狀態，人員請用停用。</p>
                )}
              />
              <Select
                label="人員類型"
                value={formType}
                onChange={(v) => patchForm({ type: v as PersonFormState['type'] })}
                options={[{ value: 'internal', label: '內部人員' }, { value: 'external', label: '外部人員' }]}
                disabled={isAuditor}
                hint={isAuditor ? '內部稽核員須為內部人員。' : undefined}
              />
              {formType === 'external' && (
                <Input label="外部機構" value={editing.externalOrganization} onChange={(v) => patchForm({ externalOrganization: v })} />
              )}
              {(formType === 'internal' || editing.roles.includes('annual_escort')) && (
                <Select
                  label={isAuditor ? '所屬單位 *' : '所屬單位'}
                  value={editing.departmentId}
                  onChange={(v) => patchForm({ departmentId: v })}
                  options={[{ value: '', label: isAuditor ? '請選擇' : '待確認' }, ...departmentOptions]}
                />
              )}
            </div>

            {isAuditor && (
              <section className="mt-5 border-t border-line pt-4" aria-label="內部稽核員資格">
                <h4 className="mb-3 text-sm font-bold">內部稽核員資格</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Select
                    label="稽核資格 *"
                    value={editing.qualificationRole}
                    onChange={(v) => patchForm({ qualificationRole: v as AuditorQualificationRole })}
                    options={AUDITOR_QUALIFICATION_ROLES.map((role) => ({
                      value: role,
                      label: AUDITOR_QUALIFICATION_FORM_LABELS[role],
                    }))}
                  />
                  <Select
                    label="資格狀態 *"
                    value={editing.qualificationStatus}
                    onChange={(v) => patchForm({ qualificationStatus: v as ManagedQualificationStatus })}
                    options={
                      editing.qualificationStatus === 'suspended'
                        ? [...QUALIFICATION_STATUS_OPTIONS, { value: 'suspended', label: '暫停' }]
                        : QUALIFICATION_STATUS_OPTIONS
                    }
                  />
                  <Input
                    label="資格取得日"
                    type="date"
                    value={editing.qualificationFrom}
                    onChange={(v) => patchForm({ qualificationFrom: v })}
                  />
                  <div className="sm:col-span-2">
                    <AttachmentField
                      label="資格證據"
                      attachments={editing.evidenceAttachments}
                      onChange={(evidenceAttachments) => patchForm({ evidenceAttachments })}
                    />
                  </div>
                </div>
                {(editing.createdAt || editing.updatedAt) && (
                  <p className="mt-3 text-xs text-muted">
                    {editing.createdAt ? `建立：${editing.createdAt.slice(0, 19).replace('T', ' ')}` : ''}
                    {editing.updatedAt ? ` · 最後修改：${editing.updatedAt.slice(0, 19).replace('T', ' ')}` : ''}
                  </p>
                )}
              </section>
            )}

            {editing.roles.includes('lead_appointment') && (
              <section className="mt-5 border-t border-line pt-4" aria-label="主任稽核員任命">
                <h4 className="mb-3 text-sm font-bold">主任稽核員任命</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="主任稽核員生效日" type="date" value={editing.leadFrom} onChange={(v) => patchForm({ leadFrom: v })} />
                  <Input label="主任稽核員到期日" type="date" value={editing.leadTo} onChange={(v) => patchForm({ leadTo: v })} />
                </div>
              </section>
            )}

            {editing.roles.includes('management_representative') && (
              <section className="mt-5 border-t border-line pt-4" aria-label="管理代表任命">
                <h4 className="mb-3 text-sm font-bold">管理代表任命</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="管理代表生效日" type="date" value={editing.mrFrom} onChange={(v) => patchForm({ mrFrom: v })} />
                  <Input label="管理代表到期日" type="date" value={editing.mrTo} onChange={(v) => patchForm({ mrTo: v })} />
                </div>
              </section>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={cancelEdit}>取消</Button>
              <Button onClick={savePerson} disabled={!canSave}>儲存</Button>
              {missingFields.length > 0 && (
                <p className="text-xs text-muted" role="status">尚需填寫：{missingFields.join('、')}</p>
              )}
              {editingRetirable && (
                <div className="ml-auto flex flex-wrap gap-2">
                  {editingRetirable.active && (
                    <Button
                      variant="secondary"
                      icon="minusCircle"
                      disabled={dirty}
                      title={dirty ? '請先儲存或取消修改' : undefined}
                      onClick={() => setPendingDeactivate(editingRetirable)}
                    >停用</Button>
                  )}
                  <Button
                    variant="dangerGhost"
                    icon={ACTION_ICONS.delete}
                    disabled={dirty}
                    aria-label={`移至回收區：${editingRetirable.name}`}
                    title={dirty ? '請先儲存或取消修改' : '移至回收區'}
                    onClick={() => setDeleteTarget({ id: editingRetirable.id, label: editingRetirable.name })}
                  >移至回收區</Button>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      <div>
        {auditorRows.length === 0 ? (
          <EmptyState message="目前沒有內部稽核人員" />
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
                  {auditorRows.map((person, index) => {
                    const qualification = currentAuditorQualification(person, today)!
                    const statusLabel = managedQualificationStatusLabel(qualification, today)
                    const deptName = state.company.departments.find((d) => d.id === person.affiliations[0]?.departmentId)?.name ?? '—'
                    return (
                      <tr
                        key={person.id}
                        className={!auditorPagination.isVisible(index) ? 'pagination-hidden-row' : ''}
                      >
                        <td className="font-normal">{person.name}</td>
                        <td>{deptName}</td>
                        <td>
                          {isAuditorQualificationRole(qualification.role)
                            ? AUDITOR_QUALIFICATION_FORM_LABELS[qualification.role]
                            : '—'}
                        </td>
                        <td><Badge label={statusLabel} /></td>
                        <td className="no-print">
                          <Button variant="secondary" icon={ACTION_ICONS.edit} className="shrink-0 whitespace-nowrap" onClick={() => openEdit(person)}>編輯</Button>
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

      <div>
        <h3 className="mb-3 text-sm font-bold">其他角色與任命</h3>
        {otherRows.length === 0 ? (
          <EmptyState message="尚無管理代表、陪稽或主任稽核員任命；請由「新增人員」建立。" />
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
                    <td className="font-normal">{person.name}</td>
                    <td>{otherRoleSummary(person)}</td>
                    <td className="no-print">
                      <Button variant="secondary" icon={ACTION_ICONS.edit} onClick={() => openEdit(person)}>編輯</Button>
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
            closeForm()
            setPendingCancel(false)
          }}
          onCancel={() => setPendingCancel(false)}
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
            closeForm()
          }}
          onCancel={() => setPendingDeactivate(null)}
        />
      )}
      <MoveToTrashDialog
        target={deleteTarget}
        onConfirm={() => {
          if (deleteTarget) movePersonToTrash(deleteTarget.id)
          setDeleteTarget(null)
          closeForm()
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
