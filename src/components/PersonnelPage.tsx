import { useEffect, useMemo, useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import type { AnnualPersonnelAssignment, Person, PersonnelRole, QualificationRecord, RoleAppointment, ValidityMode } from '../types'
import { COMPANY_LABELS } from '../types'
import { PERSONNEL_ROLE_LABELS, QUALIFICATION_STATE_LABELS, personRoles, qualificationState } from '../lib/personnel'
import { downloadBlob, safeFilename } from '../lib/download'
import { appendSheet, createSheet, createWorkbook, writeWorkbook } from '../lib/simpleXlsx'
import { Badge, Button, Card, Input, Select } from './ui/Badge'

const ROLES = Object.keys(PERSONNEL_ROLE_LABELS) as PersonnelRole[]
interface FormState {
  id?: string
  name: string
  employeeNumber: string
  type: 'internal' | 'external'
  companyId: '' | 'jiurun' | 'zhenglongxing'
  departmentId: string
  externalOrganization: string
  role: PersonnelRole
  standards: string
  procedures: string
  departments: string
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
  role: 'internal_auditor', standards: '', procedures: '', departments: '', documentTitle: '', documentNumber: '',
  documentLocation: '', assessedBy: '', assessmentDate: '', effectiveFrom: '', affiliationFrom: '', affiliationTo: '', validityMode: 'pending', effectiveTo: '',
  suspendedAt: '', endedAt: '', statusReason: '', notes: '',
})

const split = (value: string) => value.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean)

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

export function PersonnelPage({ store }: { store: AuditStore }) {
  const { state, addPerson, updatePerson, deactivatePerson, upsertAnnualPersonnelAssignment } = store
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | PersonnelRole>('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [scopeFilter, setScopeFilter] = useState('')
  const [editing, setEditing] = useState<FormState | null>(null)
  const [dirty, setDirty] = useState(false)
  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const rows = useMemo(() => state.people.filter((person) => {
    const roles = personRoles(person, state.settings.auditYear, state.annualPersonnelAssignments)
    const affiliationText = person.affiliations.map((item) => [item.externalOrganization, item.companyId, item.departmentId].filter(Boolean).join(' ')).join(' ')
    const matchesSearch = `${person.name} ${person.employeeNumber} ${affiliationText}`.toLowerCase().includes(search.toLowerCase())
    const matchesRole = roleFilter === 'all' || roles.includes(roleFilter)
    const status = primaryState(person, today, state.settings.auditYear, state.annualPersonnelAssignments)
    const matchesCompany = companyFilter === 'all' || person.affiliations.some((item) => item.companyId === companyFilter)
    const matchesDepartment = departmentFilter === 'all' || person.affiliations.some((item) => item.departmentId === departmentFilter)
    const scopeText = person.qualifications.map((qualification) => [...qualification.standardVersions, ...qualification.procedureScopes, ...qualification.departmentScopes].join(' ')).join(' ')
    const matchesScope = scopeText.toLowerCase().includes(scopeFilter.toLowerCase())
    return matchesSearch && matchesRole && matchesCompany && matchesDepartment && matchesScope && (statusFilter === 'all' || status === statusFilter)
  }), [state.people, state.settings.auditYear, state.annualPersonnelAssignments, search, roleFilter, statusFilter, companyFilter, departmentFilter, scopeFilter, today])

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
      role, standards: qualification?.standardVersions.join(', ') ?? '',
      procedures: qualification?.procedureScopes.join(', ') ?? '', departments: qualification?.departmentScopes.join(', ') ?? '',
      documentTitle: qualification?.documentTitle ?? appointment?.documentReference ?? '', documentNumber: qualification?.documentNumber ?? '',
      documentLocation: qualification?.documentLocation ?? '', assessedBy: qualification?.assessedBy ?? '',
      assessmentDate: qualification?.assessmentDate ?? '', effectiveFrom: qualification?.effectiveFrom ?? '',
      affiliationFrom: affiliation?.effectiveFrom ?? '', affiliationTo: affiliation?.effectiveTo ?? '',
      validityMode: qualification?.validityMode ?? 'pending', effectiveTo: qualification?.effectiveTo ?? '',
      suspendedAt: qualification?.suspendedAt ?? '', endedAt: qualification?.endedAt ?? '', statusReason: qualification?.statusReason ?? '',
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
      standards: qualification?.standardVersions.join(', ') ?? '',
      procedures: qualification?.procedureScopes.join(', ') ?? '',
      departments: qualification?.departmentScopes.join(', ') ?? appointment?.scope ?? '',
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
    if (dirty && !window.confirm('尚有未儲存變更，確定取消？')) return
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
      effectiveFrom: editing.affiliationFrom || undefined,
      effectiveTo: editing.affiliationTo || undefined,
    }
    const existingQualification = existing?.qualifications.toReversed().find((item) => item.role === editing.role && (!item.supersededAt || item.supersededAt > today) && (
      editing.companyId ? item.companyIds.includes(editing.companyId) : item.companyIds.length === 0
    ))
    const qualification: QualificationRecord | null = editing.role === 'annual_escort' || editing.role === 'management_representative' ? null : {
      id: existingQualification?.id ?? `qual-${crypto.randomUUID()}`,
      role: editing.role as QualificationRecord['role'],
      companyIds: editing.companyId ? [editing.companyId] : [], standardVersions: split(editing.standards),
      procedureScopes: split(editing.procedures), departmentScopes: split(editing.departments),
      documentTitle: editing.documentTitle, documentNumber: editing.documentNumber, documentLocation: editing.documentLocation,
      assessedBy: editing.assessedBy, assessmentDate: editing.assessmentDate, effectiveFrom: editing.effectiveFrom,
      validityMode: editing.validityMode, effectiveTo: editing.effectiveTo || undefined,
      suspendedAt: editing.suspendedAt || undefined, endedAt: editing.endedAt || undefined, statusReason: editing.statusReason || undefined,
    }
    const revisionDate = editing.effectiveFrom || today
    const qualifications = (existing?.qualifications ?? []).map((item) => item.id === existingQualification?.id
      ? { ...item, supersededAt: revisionDate, statusReason: item.statusReason || `由 ${revisionDate} 修訂紀錄取代` }
      : item)
    if (qualification && (existingQualification || editing.documentTitle.trim() || editing.documentNumber.trim() || editing.assessedBy.trim())) qualifications.push({
      ...qualification,
      id: `qual-${crypto.randomUUID()}`,
      revisionOfId: existingQualification?.id,
      revisedAt: new Date().toISOString(),
    })
    const affiliations = [...(existing?.affiliations ?? [])]
    const affiliationIndex = affiliations.findIndex((item) => item.companyId === affiliation.companyId && item.externalOrganization === affiliation.externalOrganization)
    if (affiliationIndex >= 0) affiliations[affiliationIndex] = { ...affiliations[affiliationIndex], ...affiliation }
    else affiliations.push(affiliation)
    const existingAppointment = existing?.appointments.toReversed().find((item) => item.role === editing.role && item.companyId === editing.companyId && (!item.supersededAt || item.supersededAt > today))
    const appointments = (existing?.appointments ?? []).map((item) => item.id === existingAppointment?.id
      ? { ...item, supersededAt: revisionDate }
      : item)
    if ((editing.role === 'management_representative' || editing.role === 'internal_lead_auditor') && editing.companyId) appointments.push({
      id: `appointment-${crypto.randomUUID()}`,
      role: editing.role, companyId: editing.companyId, documentReference: `${editing.documentTitle} ${editing.documentNumber}`.trim(),
      scope: editing.departments, effectiveFrom: editing.effectiveFrom, effectiveTo: editing.effectiveTo || undefined,
      revisionOfId: existingAppointment?.id, revisedAt: new Date().toISOString(),
    })
    const person: Omit<Person, 'id'> = {
      name: editing.name.trim(), employeeNumber: editing.employeeNumber.trim(), type: editing.type,
      affiliations, qualifications, appointments, active: existing?.active ?? true, notes: editing.notes,
    }
    const savedId = existing ? (updatePerson(existing.id, person), existing.id) : addPerson(person)
    if ((editing.role === 'annual_escort' || editing.role === 'internal_lead_auditor' || editing.role === 'management_representative') && editing.companyId) {
      upsertAnnualPersonnelAssignment({ year: state.settings.auditYear, companyId: editing.companyId, personId: savedId,
        role: editing.role, departmentId: editing.departmentId || undefined, scope: editing.departments || undefined })
    }
    setEditing(null)
    setDirty(false)
  }

  const exportExcel = () => {
    const data = rows.map((person) => ({
      姓名: person.name, 編號: person.employeeNumber, 類型: person.type === 'internal' ? '內部' : '外部',
      公司或機構: person.affiliations.map((a) => a.companyId ? COMPANY_LABELS[a.companyId] : a.externalOrganization).filter(Boolean).join('、'),
      責任單位: person.affiliations.map((a) => a.departmentId).filter(Boolean).join('、'),
      角色: personRoles(person, state.settings.auditYear, state.annualPersonnelAssignments).map((r) => PERSONNEL_ROLE_LABELS[r]).join('、'),
      狀態: primaryState(person, today, state.settings.auditYear, state.annualPersonnelAssignments),
      適用範圍: person.qualifications.flatMap((q) => [...q.standardVersions, ...q.procedureScopes, ...q.departmentScopes]).join('、'),
      有效日期: person.qualifications.map((q) => `${q.effectiveFrom || '待確認'}～${q.validityMode === 'no_expiry' ? '正式依據未訂期限' : q.effectiveTo || '待確認'}`).join('；'),
    }))
    const headers = ['姓名', '編號', '類型', '公司或機構', '責任單位', '角色', '狀態', '適用範圍', '有效日期'] as const
    const book = createWorkbook()
    appendSheet(book, createSheet([headers as unknown as string[], ...data.map((item) => headers.map((header) => item[header]))]), '人員合格名單')
    const buffer = writeWorkbook(book)
    downloadBlob(new Blob([buffer.buffer as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), safeFilename([`人員合格名單_${state.settings.auditYear}.xlsx`]))
  }

  return (
    <div className="space-y-6 print-area qr-form">
      <div className="print-only qr-form-header mb-4 text-center">
        <h1 className="text-xl font-bold">人員合格名單</h1>
        <p className="text-sm">{state.settings.auditYear} 年 · {state.company.name}</p>
      </div>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><h2 className="text-lg font-semibold">人員合格名單</h2><p className="text-sm text-slate-500">{state.settings.auditYear} 年 · 資格、任命與陪稽安排共用同一人員主檔</p></div>
          <div className="flex flex-wrap gap-2 no-print"><Button onClick={() => { setEditing(blankForm()); setDirty(false) }}>新增人員</Button><Button variant="secondary" onClick={exportExcel}>匯出名單</Button></div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 no-print">
          <Input label="搜尋姓名／編號／機構" value={search} onChange={setSearch} />
          <Select label="角色" value={roleFilter} onChange={(v) => setRoleFilter(v as typeof roleFilter)} options={[{ value: 'all', label: '全部角色' }, ...ROLES.map((role) => ({ value: role, label: PERSONNEL_ROLE_LABELS[role] }))]} />
          <Select label="資格狀態" value={statusFilter} onChange={setStatusFilter} options={['all', '有效', '待確認', '未生效', '已逾期', '已暫停', '已終止', '已停用'].map((value) => ({ value, label: value === 'all' ? '全部狀態' : value }))} />
          <Select label="所屬公司" value={companyFilter} onChange={setCompanyFilter} options={[{ value: 'all', label: '全部公司' }, ...Object.entries(COMPANY_LABELS).map(([value, label]) => ({ value, label }))]} />
          <Select label="責任單位" value={departmentFilter} onChange={setDepartmentFilter} options={[{ value: 'all', label: '全部責任單位' }, ...state.company.departments.map((department) => ({ value: department.id, label: department.name }))]} />
          <Input label="可稽核程序／範圍" value={scopeFilter} onChange={setScopeFilter} />
        </div>
      </Card>

      {editing && <Card className="border-blue-200">
        <h3 className="mb-4 font-semibold">{editing.id ? '編輯人員與資格' : '新增人員與資格'}</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Input label="姓名 *" value={editing.name} onChange={(v) => patchForm({ name: v })} />
          <Input label="人員編號" value={editing.employeeNumber} onChange={(v) => patchForm({ employeeNumber: v })} />
          <Select label="人員類型" value={editing.type} onChange={(v) => patchForm({ type: v as FormState['type'] })} options={[{ value: 'internal', label: '內部人員' }, { value: 'external', label: '外部人員' }]} />
          <Select label="公司" value={editing.companyId} onChange={(v) => patchForm({ companyId: v as FormState['companyId'] })} options={[{ value: '', label: '不適用／待確認' }, ...Object.entries(COMPANY_LABELS).map(([value, label]) => ({ value, label }))]} />
          <Select label="責任單位" value={editing.departmentId} onChange={(v) => patchForm({ departmentId: v })} options={[{ value: '', label: '待確認' }, ...state.company.departments.map((d) => ({ value: d.id, label: d.name }))]} />
          <Input label="外部機構" value={editing.externalOrganization} onChange={(v) => patchForm({ externalOrganization: v })} />
          <Input label="任職／服務生效日" type="date" value={editing.affiliationFrom} onChange={(v) => patchForm({ affiliationFrom: v })} />
          <Input label="任職／服務終止日" type="date" value={editing.affiliationTo} onChange={(v) => patchForm({ affiliationTo: v })} />
          <Select label="角色／資格類別" value={editing.role} onChange={(v) => selectRole(v as PersonnelRole)} options={ROLES.map((role) => ({ value: role, label: PERSONNEL_ROLE_LABELS[role] }))} />
          <Input label="標準與版本（逗號分隔）" value={editing.standards} onChange={(v) => patchForm({ standards: v })} />
          <Input label="可稽核程序（QP，逗號分隔）" value={editing.procedures} onChange={(v) => patchForm({ procedures: v })} />
          <Input label="可稽核單位／陪同範圍" value={editing.departments} onChange={(v) => patchForm({ departments: v })} />
          <Input label="正式文件名稱" value={editing.documentTitle} onChange={(v) => patchForm({ documentTitle: v })} />
          <Input label="文件編號" value={editing.documentNumber} onChange={(v) => patchForm({ documentNumber: v })} />
          <Input label="文件位置／連結" value={editing.documentLocation} onChange={(v) => patchForm({ documentLocation: v })} />
          <Input label="評定／確認人" value={editing.assessedBy} onChange={(v) => patchForm({ assessedBy: v })} />
          <Input label="評定日期" type="date" value={editing.assessmentDate} onChange={(v) => patchForm({ assessmentDate: v })} />
          <Input label="生效日期" type="date" value={editing.effectiveFrom} onChange={(v) => patchForm({ effectiveFrom: v })} />
          <Select label="有效期間" value={editing.validityMode} onChange={(v) => patchForm({ validityMode: v as ValidityMode })} options={[{ value: 'fixed', label: '固定到期日' }, { value: 'no_expiry', label: '正式依據未訂固定期限' }, { value: 'pending', label: '期限待確認' }]} />
          {editing.validityMode === 'fixed' && <Input label="到期日" type="date" value={editing.effectiveTo} onChange={(v) => patchForm({ effectiveTo: v })} />}
          {editing.role !== 'annual_escort' && editing.role !== 'management_representative' && <Input label="資格暫停日期" type="date" value={editing.suspendedAt} onChange={(v) => patchForm({ suspendedAt: v })} />}
          {editing.role !== 'annual_escort' && editing.role !== 'management_representative' && <Input label="資格終止日期" type="date" value={editing.endedAt} onChange={(v) => patchForm({ endedAt: v })} />}
          {editing.role !== 'annual_escort' && editing.role !== 'management_representative' && <Input label="暫停／終止原因" value={editing.statusReason} onChange={(v) => patchForm({ statusReason: v })} />}
          <Input label="備註" value={editing.notes} onChange={(v) => patchForm({ notes: v })} />
        </div>
        <p className="mt-3 text-xs text-slate-500">系統只登錄正式紀錄的引用；不取代資格評定、核准、登入權限或電子簽章。</p>
        <div className="mt-5 flex gap-2"><Button onClick={save} disabled={!editing.name.trim()}>儲存</Button><Button variant="secondary" onClick={cancel}>取消</Button></div>
      </Card>}

      <Card>
        <div className="space-y-3 lg:hidden">
          {rows.map((person) => <article key={person.id} className="rounded-lg border border-slate-200 p-4"><div className="flex justify-between gap-3"><div><h3 className="font-semibold">{person.name}</h3><p className="text-xs text-slate-500">{person.employeeNumber || '無編號'}</p></div><Badge label={primaryState(person, today, state.settings.auditYear, state.annualPersonnelAssignments)} /></div><p className="mt-2 text-sm">{personRoles(person, state.settings.auditYear, state.annualPersonnelAssignments).map((r) => PERSONNEL_ROLE_LABELS[r]).join('、') || '角色待確認'}</p><div className="mt-3 flex gap-2 no-print"><Button variant="secondary" onClick={() => openEdit(person)}>編輯</Button>{person.active && <Button variant="ghost" onClick={() => window.confirm(`停用 ${person.name}？歷史事件仍會保留快照。`) && deactivatePerson(person.id)}>停用</Button>}</div></article>)}
        </div>
        <div className="hidden overflow-x-auto lg:block"><table className="w-full border-collapse text-sm"><thead><tr className="bg-slate-50 text-left"><th className="border p-2">姓名／編號</th><th className="border p-2">公司或機構</th><th className="border p-2">責任單位</th><th className="border p-2">角色</th><th className="border p-2">狀態</th><th className="border p-2">適用範圍</th><th className="border p-2">有效日期</th><th className="border p-2 no-print">操作</th></tr></thead><tbody>{rows.map((person) => { const affiliation = person.affiliations[0]; const qualification = currentQualification(person, undefined, today); return <tr key={person.id}><td className="border p-2 font-medium">{person.name}<span className="block text-xs font-normal text-slate-500">{person.employeeNumber || '—'}</span></td><td className="border p-2">{affiliation?.companyId ? COMPANY_LABELS[affiliation.companyId] : affiliation?.externalOrganization || '待確認'}</td><td className="border p-2">{state.company.departments.find((d) => d.id === affiliation?.departmentId)?.name ?? affiliation?.departmentId ?? '—'}</td><td className="border p-2">{personRoles(person, state.settings.auditYear, state.annualPersonnelAssignments).map((r) => PERSONNEL_ROLE_LABELS[r]).join('、') || '待確認'}</td><td className="border p-2"><Badge label={primaryState(person, today, state.settings.auditYear, state.annualPersonnelAssignments)} /></td><td className="border p-2 text-xs">{qualification ? [...qualification.standardVersions, ...qualification.procedureScopes, ...qualification.departmentScopes].join('、') || '範圍待確認' : '—'}</td><td className="border p-2 text-xs">{qualification ? `${qualification.effectiveFrom || '待確認'}～${qualification.validityMode === 'no_expiry' ? '無固定期限' : qualification.effectiveTo || '待確認'}` : '—'}</td><td className="border p-2 no-print"><div className="flex gap-1"><Button variant="ghost" onClick={() => openEdit(person)}>編輯</Button>{person.active && <Button variant="ghost" onClick={() => window.confirm(`停用 ${person.name}？`) && deactivatePerson(person.id)}>停用</Button>}</div></td></tr> })}</tbody></table></div>
        {rows.length === 0 && <p className="py-8 text-center text-sm text-slate-500">沒有符合條件的人員</p>}
      </Card>
    </div>
  )
}
