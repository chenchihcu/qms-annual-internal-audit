import { describe, expect, it } from 'vitest'
import type { Person } from '../../types'
import {
  auditorNamesFromPersonIds,
  joinAuditorNames,
  personIdsFromAuditorNames,
  personNameSelectOptions,
  splitAuditorNames,
} from '../personPicker'

const people: Person[] = [
  {
    id: 'p1',
    name: '王稽核',
    employeeNumber: '',
    type: 'internal',
    active: true,
    notes: '',
    affiliations: [],
    qualifications: [],
    appointments: [],
  },
  {
    id: 'p2',
    name: '李稽核',
    employeeNumber: '',
    type: 'internal',
    active: true,
    notes: '',
    affiliations: [],
    qualifications: [],
    appointments: [],
  },
]

describe('personPicker', () => {
  it('joins and splits auditor names with Chinese separator', () => {
    expect(joinAuditorNames(['王稽核', '李稽核'])).toBe('王稽核、李稽核')
    expect(splitAuditorNames('王稽核、李稽核')).toEqual(['王稽核', '李稽核'])
    expect(splitAuditorNames('王稽核, 李稽核')).toEqual(['王稽核', '李稽核'])
  })

  it('maps auditor names to person ids and back', () => {
    expect(personIdsFromAuditorNames(people, '王稽核、李稽核')).toEqual(['p1', 'p2'])
    expect(auditorNamesFromPersonIds(people, ['p2', 'p1'])).toBe('李稽核、王稽核')
  })

  it('keeps legacy values in select options when not in candidates', () => {
    const options = personNameSelectOptions([people[0]], '品保部經理')
    expect(options.some((option) => option.value === '品保部經理' && option.label.includes('目前值'))).toBe(true)
    expect(options.some((option) => option.value === '__custom__')).toBe(true)
  })
})
