import { parseAuditorNames } from './impartiality'
import type { Person } from '../types'

export const AUDITOR_NAME_SEPARATOR = '、'

export function joinAuditorNames(names: string[]): string {
  return names.map((name) => name.trim()).filter(Boolean).join(AUDITOR_NAME_SEPARATOR)
}

export function splitAuditorNames(auditors: string): string[] {
  return parseAuditorNames(auditors)
}

export function personNameMatches(a: string, b: string): boolean {
  const left = a.trim()
  const right = b.trim()
  if (!left || !right) return false
  if (left === right) return true
  return left.includes(right) || right.includes(left)
}

export function personIdsFromAuditorNames(people: Person[], auditors: string): string[] {
  const ids: string[] = []
  splitAuditorNames(auditors).forEach((name) => {
    const person = people.find((candidate) => personNameMatches(candidate.name, name))
    if (person && !ids.includes(person.id)) ids.push(person.id)
  })
  return ids
}

export function auditorNamesFromPersonIds(people: Person[], personIds: string[]): string {
  return joinAuditorNames(
    personIds
      .map((id) => people.find((person) => person.id === id)?.name ?? '')
      .filter(Boolean),
  )
}

export function personNameSelectOptions(
  candidates: Person[],
  currentValue: string,
): { value: string; label: string }[] {
  const names = new Set(candidates.map((person) => person.name))
  const options = candidates.map((person) => ({ value: person.name, label: person.name }))
  const trimmed = currentValue.trim()
  if (trimmed && !names.has(trimmed)) {
    options.unshift({ value: trimmed, label: `${trimmed}（目前值）` })
  }
  return [
    { value: '', label: '請選擇' },
    ...options,
    { value: '__custom__', label: '其他（手填）' },
  ]
}
