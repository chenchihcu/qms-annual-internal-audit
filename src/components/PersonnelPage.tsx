import { useEffect, useMemo, useRef, useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import type { AnnualPersonnelAssignment, Person, PersonnelRole, QualificationRecord, RoleAppointment, ValidityMode } from '../types'
import { PROCEDURE_PLAN_TEMPLATE } from '../data/procedurePlan'
import {
  formatQualificationScopeSummary,
  PERSONNEL_ROLE_LABELS,
  QUALIFICATION_SCOPE_ALL,
  QUALIFICATION_STATE_LABELS,
  personRoles,
  qualificationState,
  verifierCandidates,
} from '../lib/personnel'
import { exportPersonnelExcel } from '../lib/formExport'
import { ACTION_ICONS } from '../lib/uiIcons'
import { Badge, Button, Card, Input, Select } from './ui/Badge'
import { PersonNameSelect } from './ui/PersonNameSelect'
import { CheckboxList } from './ui/CheckboxList'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { MoveToTrashDialog, type TrashDeleteTarget } from './ui/MoveToTrashDialog'
import { EmptyState } from './ui/EmptyState'
import { PageToolbar } from './ui/PageToolbar'
import { PrintDocHeader } from './ui/PrintDocHeader'
import { ScrollRegion } from './ui/ScrollRegion'
import { useTablePagination } from '../hooks/useTablePagination'
import { TablePagination } from './ui/TablePagination'

const ROLES = Object.keys(PERSONNEL_ROLE_LABELS) as PersonnelRole[]

const isAuditorRole = (role: PersonnelRole) => role === 'internal_auditor' || role === 'internal_lead_auditor'
const isThirdPartyRole = (role: PersonnelRole) => role === 'third_party_lead_auditor' || role === 'third_party_auditor'
const isEscortRole = (role: PersonnelRole) => role === 'annual_escort'
const isManagementRepRole = (role: PersonnelRole) => role === 'management_representative'
const skipsQualification = (role: PersonnelRole) => isEscortRole(role) || isManagementRepRole(role) || isThirdPartyRole(role)

const UNIQUE_QP_CODES = [...new Set(PROCEDURE_PLAN_TEMPLATE.map((entry) => entry.qpCode))].sort()

interface FormState {
  id?: string
  name: string
  employeeNumber: string
  type: 'internal' | 'external'
  companyId: '' | 'jiurun' | 'zhenglongxing'
  departmentId: string
  externalOrganization: string
  role: PersonnelRole
  standards: string[]
  procedures: string[]
  departments: string[]
  documentTitle: string
  documentNumber: string
  documentLocation: string
  assessedBy: string
  assessmentDate: string
  effectiveFrom: string
  affiliationFrom: string
  affiliationTo: string
  validityMode: ValidityMode
  effectiveTo: string
  suspendedAt: string
  endedAt: string
  statusReason: string
  notes: string
}

const blankForm = (): FormState => ({
  name: '', employeeNumber: '', type: 'internal', companyId: 'jiurun', departmentId: '', externalOrganization: '',
  role: 'internal_auditor', standards: [], procedures: [], departments: [],
  documentTitle: '', documentNumber: '', documentLocation: '', assessedBy: '', assessmentDate: '',
  effectiveFrom: '', affiliationFrom: '', affiliationTo: '', validityMode: 'pending', effectiveTo: '',
  suspendedAt: '', endedAt: '', statusReason: '', notes: '',
})

function parseScopeField(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return [...value]
  if (!value?.trim()) return []
  return value.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean)
}

function appointmentState(appointment: RoleAppointment, date: string) {
  if (!appointment.documentReference || !appointment.effectiveFrom) return 'pending'
  if (appointment.effectiveFrom > date) return 'not_effective'
  if ((appointment.supersededAt && appointment.supersededAt <= date) || (appointment.effectiveTo && appointment.effectiveTo < date)) return 'ended'
  return 'effective'
}

function currentQualification(person: Person, role?: PersonnelRole, date?: string) {
  return person.qualifications.toReversed().find((item) => (
    (!role || item.role === role)
    && (!date || !item.supersededAt || item.supersededAt > date)
  ))
}

function primaryState(person: Person, date: string, year: number, assignments: AnnualPersonnelAssignment[]) {
  if (!person.active) return '已停用'
  const states = [
    ...person.qualifications.map((item) => qualificationState(item, date)),
    ...person.appointments.map((item) => appointmentState(item, date)),
  ]
  if (assignments.some((item) => item.personId === person.id && item.year === year)) states.push('effective')
  if (!states.length) return '待確認'
  if (states.includes('effective')) return '有效'
  return QUALIFICATION_STATE_LABELS[states[0]]
}

function ScopeCheckboxGroup({
  label,
  allLabel,
  options,
  value,
  onChange,
}: {
  label: string
  allLabel: string
  options: { value: string; label: string }[]
  value: string[]
  onChange: (next: string[]) => void
}) {
  const isAll = value.includes(QUALIFICATION_SCOPE_ALL)
  const selected = isAll ? [] : value
  return (
    <div className="sm:col-span-2 lg:col-span-3">
      <CheckboxList
        label={label}
        allLabel={allLabel}
        allSelected={isAll}
        onToggleAll={(checked) => onChange(checked ? [QUALIFICATION_SCOPE_ALL] : [])}
        options={options}
        selected={selected}
        disabled={isAll}
        onChange={(next) => onChange(next)}
      />
    </div>
  )
}

export function PersonnelPage({ store }: { store: AuditStore }) {
  const { state, addPerson, updatePerson, deactivatePerson, movePersonToTrash, upsertAnnualPersonnelAssignment } = store
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | PersonnelRole>('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [scopeFilter, setScopeFilter] = useState('')
  const [editing, setEditing] = useState<FormState | null>(null)
  const [dirty, setDirty] = useState(false)
  const [pendingCancel, setPendingCancel] = useState(false)
  const [pendingDeactivate, setPendingDeactivate] = useState<Person | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TrashDeleteTarget | null>(null)
  const [saveMessage, setSaveMessage] = useState(false)
  const editCardRef = useRef<HTMLDivElement>(null)
  const today = new Date().toISOString().slice(0, 10)

  const standardOptions = useMemo(
    () => state.companyAuditProfiles[state.activeCompanyId].applicableStandards.map((standard) => ({
      value: `${standard.name}:${standard.version}`,
      label: `${standard.name} ${standard.version}`,
    })),
    [state.companyAuditProfiles, state.activeCompanyId],
  )

  const procedureOptions = useMemo(
    () => UNIQUE_QP_CODES.map((code) => ({ value: code, label: code })),
    [],
  )

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

  const editingId = editing?.id
  useEffect(() => {
    if (editingId && editCardRef.current) {
      editCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [editingId])

  const rows = useMemo(() => state.people.filter((person) => {
    const roles = personRoles(person, state.settings.auditYear, state.annualPersonnelAssignments)
    const affiliationText = person.affiliations.map((item) => [item.externalOrganization, item.departmentId].filter(Boolean).join(' ')).join(' ')
    const matchesSearch = `${person.name} ${person.employeeNumber} ${affiliationText}`.toLowerCase().includes(search.toLowerCase())
    const matchesRole = roleFilter === 'all' || roles.includes(roleFilter)
    const status = primaryState(person, today, state.settings.auditYear, state.annualPersonnelAssignments)
    const matchesDepartment = departmentFilter === 'all' || person.affiliations.some((item) => item.departmentId === departmentFilter)
    const scopeText = person.qualifications.map((qualification) => formatQualificationScopeSummary(qualification)).join(' ')
    const matchesScope = scopeText.toLowerCase().includes(scopeFilter.toLowerCase())
    return matchesSearch && matchesRole && matchesDepartment && matchesScope && (statusFilter === 'all' || status === statusFilter)
  }), [state.people, state.settings.auditYear, state.annualPersonnelAssignments, search, roleFilter, statusFilter, departmentFilter, scopeFilter, today])

  const patchForm = (patch: Partial<FormState>) => {
    setEditing((current) => current ? { ...current, ...patch } : current)
    setDirty(true)
  }

  const openEdit = (person: Person) => {
    const affiliation = person.affiliations[0]
    const roles = personRoles(person, state.settings.auditYear, state.annualPersonnelAssignments)
    const role = roles[0] ?? 'internal_auditor'
    const qualification = currentQualification(person, role, today)
    const appointment = person.appointments.find((item) => item.role === role && item.companyId === affiliation?.companyId)
    setEditing({
      ...blankForm(), id: person.id, name: person.name, employeeNumber: person.employeeNumber, type: person.type,
      companyId: affiliation?.companyId ?? '', departmentId: affiliation?.departmentId ?? '', externalOrganization: affiliation?.externalOrganization ?? '',
      role,
      standards: qualification?.standardVersions ?? [],
      procedures: qualification?.procedureScopes ?? [],
      departments: qualification?.departmentScopes.length
        ? qualification.departmentScopes
        : parseScopeField(appointment?.scope),
      documentTitle: qualification?.documentTitle ?? appointment?.documentReference ?? '',
      documentNumber: qualification?.documentNumber ?? '',
      documentLocation: qualification?.documentLocation ?? '',
      assessedBy: qualification?.assessedBy ?? '',
      assessmentDate: qualification?.assessmentDate ?? '',
      effectiveFrom: qualification?.effectiveFrom ?? appointment?.effectiveFrom ?? '',
      affiliationFrom: affiliation?.effectiveFrom ?? '',
      affiliationTo: affiliation?.effectiveTo ?? '',
      validityMode: qualification?.validityMode ?? 'pending',
      effectiveTo: qualification?.effectiveTo ?? appointment?.effectiveTo ?? '',
      suspendedAt: qualification?.suspendedAt ?? '',
      endedAt: qualification?.endedAt ?? '',
      statusReason: qualification?.statusReason ?? '',
      notes: person.notes,
    })
    setDirty(false)
  }

  const selectRole = (role: PersonnelRole) => {
    if (!editing) return
    const person = state.people.find((item) => item.id === editing.id)
    const qualification = person ? currentQualification(person, role, today) : undefined
    const appointment = person?.appointments.find((item) => item.role === role && item.companyId === editing.companyId)
    patchForm({
      role,
      standards: qualification?.standardVersions ?? [],
      procedures: qualification?.procedureScopes ?? [],
      departments: qualification?.departmentScopes.length
        ? qualification.departmentScopes
        : parseScopeField(appointment?.scope),
      documentTitle: qualification?.documentTitle ?? appointment?.documentReference ?? '',
      documentNumber: qualification?.documentNumber ?? '',
      documentLocation: qualification?.documentLocation ?? '',
      assessedBy: qualification?.assessedBy ?? '',
      assessmentDate: qualification?.assessmentDate ?? '',
      effectiveFrom: qualification?.effectiveFrom ?? appointment?.effectiveFrom ?? '',
      effectiveTo: qualification?.effectiveTo ?? appointment?.effectiveTo ?? '',
      validityMode: qualification?.validityMode ?? 'pending',
      suspendedAt: qualification?.suspendedAt ?? '',
      endedAt: qualification?.endedAt ?? '',
      statusReason: qualification?.statusReason ?? '',
    })
  }

  const cancel = () => {
    if (dirty) {
      setPendingCancel(true)
      return
    }
    setEditing(null)
    setDirty(false)
  }

  const confirmCancel = () => {
    setPendingCancel(false)
    setEditing(null)
    setDirty(false)
  }

  const save = () => {
    if (!editing?.name.trim()) return
    const existing = state.people.find((person) => person.id === editing.id)
    const affiliation = {
      id: existing?.affiliations.find((item) => item.companyId === editing.companyId && item.externalOrganization === (editing.externalOrganization || undefined))?.id ?? `aff-${crypto.randomUUID()}`,
      companyId: editing.companyId || undefined,
      departmentId: editing.departmentId || undefined,
      externalOrganization: editing.externalOrganization || undefined,
      effectiveFrom: editing.affiliationFrom || existing?.affiliations.find((item) => item.companyId === editing.companyId)?.effectiveFrom || undefined,
      effectiveTo: editing.affiliationTo || existing?.affiliations.find((item) => item.companyId === editing.companyId)?.effectiveTo || undefined,
    }
    const existingQualification = existing?.qualifications.toReversed().find((item) => item.role === editing.role && (!item.supersededAt || item.supersededAt > today) && (
      editing.companyId ? item.companyIds.includes(editing.companyId) : item.companyIds.length === 0
    ))
    const preservedHidden = {
      documentLocation: editing.documentLocation || existingQualification?.documentLocation || '',
      assessmentDate: editing.assessmentDate || existingQualification?.assessmentDate || '',
      suspendedAt: editing.suspendedAt || existingQualification?.suspendedAt,
      endedAt: editing.endedAt || existingQualification?.endedAt,
      statusReason: editing.statusReason || existingQualification?.statusReason,
    }
    const qualification: QualificationRecord | null = skipsQualification(editing.role) ? null : {
      id: existingQualification?.id ?? `qual-${crypto.randomUUID()}`,
      role: editing.role as QualificationRecord['role'],
      companyIds: editing.companyId ? [editing.companyId] : [],
      standardVersions: [...editing.standards],
      procedureScopes: [...editing.procedures],
      departmentScopes: [...editing.departments],
      documentTitle: editing.documentTitle,
      documentNumber: editing.documentNumber,
      documentLocation: preservedHidden.documentLocation,
      assessedBy: editing.assessedBy,
      assessmentDate: preservedHidden.assessmentDate,
      effectiveFrom: editing.effectiveFrom,
      validityMode: editing.validityMode,
      effectiveTo: editing.effectiveTo || undefined,
      suspendedAt: preservedHidden.suspendedAt,
      endedAt: preservedHidden.endedAt,
      statusReason: preservedHidden.statusReason,
    }
    const revisionDate = editing.effectiveFrom || today
    const qualifications = skipsQualification(editing.role)
      ? [...(existing?.qualifications ?? [])]
      : (existing?.qualifications ?? []).map((item) => item.id === existingQualification?.id
        ? { ...item, supersededAt: revisionDate, statusReason: item.statusReason || `由 ${revisionDate} 修訂紀錄取代` }
        : item)
    if (qualification && (existingQualification || editing.documentTitle.trim() || editing.documentNumber.trim() || editing.assessedBy.trim())) {
      qualifications.push({
        ...qualification,
        id: `qual-${crypto.randomUUID()}`,
        revisionOfId: existingQualification?.id,
        revisedAt: new Date().toISOString(),
      })
    }
    const affiliations = [...(existing?.affiliations ?? [])]
    const affiliationIndex = affiliations.findIndex((item) => item.companyId === affiliation.companyId && item.externalOrganization === affiliation.externalOrganization)
    if (affiliationIndex >= 0) affiliations[affiliationIndex] = { ...affiliations[affiliationIndex], ...affiliation }
    else affiliations.push(affiliation)
    const appointmentScope = editing.departments.length > 0 ? editing.departments.join('、') : undefined
    const existingAppointment = existing?.appointments.toReversed().find((item) => item.role === editing.role && item.companyId === editing.companyId && (!item.supersededAt || item.supersededAt > today))
    const appointments = (existing?.appointments ?? []).map((item) => item.id === existingAppointment?.id
      ? { ...item, supersededAt: revisionDate }
      : item)
    if ((isManagementRepRole(editing.role) || editing.role === 'internal_lead_auditor') && editing.companyId) {
      appointments.push({
        id: `appointment-${crypto.randomUUID()}`,
        role: editing.role as 'internal_lead_auditor' | 'management_representative',
        companyId: editing.companyId,
        documentReference: `${editing.documentTitle} ${editing.documentNumber}`.trim(),
        scope: appointmentScope ?? '',
        effectiveFrom: editing.effectiveFrom,
        effectiveTo: editing.effectiveTo || undefined,
        revisionOfId: existingAppointment?.id,
        revisedAt: new Date().toISOString(),
      })
    }
    const person: Omit<Person, 'id'> = {
      name: editing.name.trim(),
      employeeNumber: (editing.employeeNumber || existing?.employeeNumber || '').trim(),
      type: editing.type,
      affiliations,
      qualifications,
      appointments,
      active: existing?.active ?? true,
      notes: editing.notes || existing?.notes || '',
    }
    const savedId = existing ? (updatePerson(existing.id, person), existing.id) : addPerson(person)
    if ((isEscortRole(editing.role) || editing.role === 'internal_lead_auditor' || isManagementRepRole(editing.role)) && editing.companyId) {
      upsertAnnualPersonnelAssignment({
        year: state.settings.auditYear,
        companyId: editing.companyId,
        personId: savedId,
        role: editing.role as AnnualPersonnelAssignment['role'],
        departmentId: editing.departmentId || undefined,
        scope: appointmentScope,
      })
    }
    setEditing(null)
    setDirty(false)
    setSaveMessage(true)
  }

  const exportExcel = () => {
    exportPersonnelExcel(state, state.activeCompanyId)
  }

  const showExternalOrg = editing?.type === 'external'
  const showDepartment = editing && (editing.type === 'internal' || isEscortRole(editing.role))
  const showAuditorScopes = editing && isAuditorRole(editing.role)
  const showAuditorValidity = editing && isAuditorRole(editing.role)
  const showAppointmentDocs = editing && (isAuditorRole(editing.role) || isManagementRepRole(editing.role))

  const verifierPeople = useMemo(
    () => verifierCandidates(
      state.people,
      state.activeCompanyId,
      state.settings.auditYear,
      state.annualPersonnelAssignments,
      editing?.effectiveFrom || `${state.settings.auditYear}-12-31`,
    ),
    [state.people, state.activeCompanyId, state.settings.auditYear, state.annualPersonnelAssignments, editing?.effectiveFrom],
  )

  const filterFields = (
    <>
      <Input label="搜尋姓名／編號／機構" value={search} onChange={setSearch} />
      <Select label="角色" value={roleFilter} onChange={(v) => setRoleFilter(v as typeof roleFilter)} options={[{ value: 'all', label: '全部角色' }, ...ROLES.map((role) => ({ value: role, label: PERSONNEL_ROLE_LABELS[role] }))]} />
      <Select label="資格狀態" value={statusFilter} onChange={setStatusFilter} options={['all', '有效', '待確認', '未生效', '已逾期', '已暫停', '已終止', '已停用'].map((value) => ({ value, label: value === 'all' ? '全部狀態' : value }))} />
      <Select label="責任單位" value={departmentFilter} onChange={setDepartmentFilter} options={[{ value: 'all', label: '全部責任單位' }, ...state.company.departments.map((department) => ({ value: department.id, label: department.name }))]} />
      <Input label="可稽核程序／範圍" value={scopeFilter} onChange={setScopeFilter} />
    </>
  )
  const pagination = useTablePagination(
    rows.length,
    10,
    undefined,
    JSON.stringify([search, roleFilter, statusFilter, departmentFilter, scopeFilter, state.settings.auditYear]),
  )

  return (
    <div className="space-y-6 print-area qr-form">
      <PrintDocHeader
        companyName={state.company.name}
        auditYear={state.settings.auditYear}
        formTitle="人員合格名單"
      />
      <div>
        <PageToolbar
          title="人員合格名單"
          actions={(
            <>
              <Button icon={ACTION_ICONS.add} onClick={() => { setEditing(blankForm()); setDirty(false); setSaveMessage(false) }}>新增人員</Button>
              <Button variant="secondary" icon={ACTION_ICONS.exportExcel} onClick={exportExcel}>匯出名單</Button>
            </>
          )}
        />
        {saveMessage && !editing && (
          <p className="mb-3 text-sm text-green-700" role="status">已儲存</p>
        )}
        <details className="mt-2 no-print">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">篩選條件</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{filterFields}</div>
        </details>
        <details className="mt-4 no-print">
          <summary className="cursor-pointer text-xs text-slate-500">使用說明</summary>
          <p className="mt-2 text-xs text-slate-500">
            系統只登錄正式紀錄的引用；不取代資格評定、核准、登入權限或電子簽章。空白範圍不算「全部」，開始稽核時仍須符合當次 QP 與單位。
          </p>
        </details>
      </div>

      {editing && (
      <div ref={editCardRef}>
      <Card className="border-blue-200">
        <h3 className="mb-4 font-semibold">{editing.id ? '編輯人員與資格' : '新增人員與資格'}</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Input label="姓名 *" value={editing.name} onChange={(v) => patchForm({ name: v })} />
          <Select label="人員類型" value={editing.type} onChange={(v) => patchForm({ type: v as FormState['type'] })} options={[{ value: 'internal', label: '內部人員' }, { value: 'external', label: '外部人員' }]} />
          {showExternalOrg && <Input label="外部機構" value={editing.externalOrganization} onChange={(v) => patchForm({ externalOrganization: v })} />}
          {showDepartment && (
            <Select label="責任單位" value={editing.departmentId} onChange={(v) => patchForm({ departmentId: v })} options={[{ value: '', label: '待確認' }, ...state.company.departments.map((d) => ({ value: d.id, label: d.name }))]} />
          )}
          <Select label="角色／資格類別" value={editing.role} onChange={(v) => selectRole(v as PersonnelRole)} options={ROLES.map((role) => ({ value: role, label: PERSONNEL_ROLE_LABELS[role] }))} />
          {showAuditorScopes && (
            <>
              <ScopeCheckboxGroup
                label="標準與版本"
                allLabel="全部已確認標準"
                options={standardOptions}
                value={editing.standards}
                onChange={(standards) => patchForm({ standards })}
              />
              <ScopeCheckboxGroup
                label="可稽核程序（QP）"
                allLabel="全部程序"
                options={procedureOptions}
                value={editing.procedures}
                onChange={(procedures) => patchForm({ procedures })}
              />
              <ScopeCheckboxGroup
                label="可稽核單位"
                allLabel="全部責任單位"
                options={departmentOptions}
                value={editing.departments}
                onChange={(departments) => patchForm({ departments })}
              />
            </>
          )}
          {showAppointmentDocs && (
            <>
              <Input label="正式文件名稱" value={editing.documentTitle} onChange={(v) => patchForm({ documentTitle: v })} />
              <Input label="文件編號" value={editing.documentNumber} onChange={(v) => patchForm({ documentNumber: v })} />
            </>
          )}
          {showAuditorScopes && (
            <PersonNameSelect
              label="評定／確認人"
              value={editing.assessedBy}
              onChange={(v) => patchForm({ assessedBy: v })}
              candidates={verifierPeople}
            />
          )}
          {(showAppointmentDocs || showAuditorScopes) && (
            <Input label="生效日期" type="date" value={editing.effectiveFrom} onChange={(v) => patchForm({ effectiveFrom: v })} />
          )}
          {showAuditorValidity && (
            <>
              <Select label="有效期間" value={editing.validityMode} onChange={(v) => patchForm({ validityMode: v as ValidityMode })} options={[{ value: 'fixed', label: '固定到期日' }, { value: 'no_expiry', label: '正式依據未訂固定期限' }, { value: 'pending', label: '期限待確認' }]} />
              {editing.validityMode === 'fixed' && <Input label="到期日" type="date" value={editing.effectiveTo} onChange={(v) => patchForm({ effectiveTo: v })} />}
            </>
          )}
        </div>
        <div className="mt-5 flex gap-2"><Button onClick={save} disabled={!editing.name.trim()}>儲存</Button><Button variant="secondary" onClick={cancel}>取消</Button></div>
      </Card>
      </div>)}

      <div>
        {rows.length === 0 ? (
          <EmptyState message="目前沒有人員。" />
        ) : (
          <>
          <ScrollRegion ariaLabel="人員合格名單工作表">
            <table className="w-full min-w-[960px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="border p-2">姓名／編號</th>
                  <th className="border p-2">所屬單位</th>
                  <th className="border p-2">責任單位</th>
                  <th className="border p-2">角色</th>
                  <th className="border p-2">狀態</th>
                  <th className="border p-2">適用範圍</th>
                  <th className="border p-2">有效日期</th>
                  <th className="border p-2 no-print">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((person, index) => {
                  const affiliation = person.affiliations[0]
                  const qualification = currentQualification(person, undefined, today)
                  return (
                    <tr key={person.id} className={!pagination.isVisible(index) ? 'pagination-hidden-row' : undefined}>
                      <td className="border p-2 font-medium">
                        {person.name}
                        <span className="block text-xs font-normal text-slate-500">{person.employeeNumber || '—'}</span>
                      </td>
                      <td className="border p-2">
                        {affiliation?.externalOrganization || (person.type === 'internal' ? '公司內部' : '待確認')}
                      </td>
                      <td className="border p-2">
                        {state.company.departments.find((d) => d.id === affiliation?.departmentId)?.name ?? affiliation?.departmentId ?? '—'}
                      </td>
                      <td className="border p-2">
                        {personRoles(person, state.settings.auditYear, state.annualPersonnelAssignments).map((r) => PERSONNEL_ROLE_LABELS[r]).join('、') || '待確認'}
                      </td>
                      <td className="border p-2">
                        <Badge label={primaryState(person, today, state.settings.auditYear, state.annualPersonnelAssignments)} />
                      </td>
                      <td className="border p-2 text-xs">{qualification ? formatQualificationScopeSummary(qualification) : '—'}</td>
                      <td className="border p-2 text-xs">
                        {qualification
                          ? `${qualification.effectiveFrom || '待確認'}～${qualification.validityMode === 'no_expiry' ? '無固定期限' : qualification.effectiveTo || '待確認'}`
                          : '—'}
                      </td>
                      <td className="border p-2 no-print">
                        <div className="flex gap-1">
                          <Button variant="ghost" icon={ACTION_ICONS.edit} onClick={() => openEdit(person)}>編輯</Button>
                          {person.active && (
                            <Button variant="ghost" icon="minusCircle" onClick={() => setPendingDeactivate(person)}>停用</Button>
                          )}
                          <Button
                            variant="ghost"
                            icon={ACTION_ICONS.delete}
                            className="text-red-700"
                            aria-label={`移至回收區：${person.name}`}
                            onClick={() => setDeleteTarget({ id: person.id, label: `${person.name}${person.employeeNumber ? ` · ${person.employeeNumber}` : ''}` })}
                          >
                            移至回收區
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </ScrollRegion>
          <TablePagination pagination={pagination} label="人員合格名單" />
          </>
        )}
      </div>
      {pendingCancel && (
        <ConfirmDialog
          open
          title="放棄未儲存變更？"
          description="尚有未儲存變更，確定取消編輯？"
          confirmLabel="放棄變更"
          variant="danger"
          onConfirm={confirmCancel}
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
