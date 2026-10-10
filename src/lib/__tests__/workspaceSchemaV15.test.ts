import { describe, expect, it } from 'vitest'
import { buildDemoLegacySeed, migrateToV8 } from '../../data/demoData'
import { migrateState } from '../migrate'
import { migrateToSingleWorkspace } from '../singleWorkspaceMigration'
import {
  dropRetiredWorkspaceFields,
  migrateV14ToV15,
  SINGLE_WORKSPACE_STORAGE_VERSION,
  validateV15State,
} from '../workspaceSchemaV15'

describe('workspaceSchemaV15', () => {
  it('migrates v14 single-workspace state to v15 with workspace/settings archives', () => {
    const v14 = migrateToSingleWorkspace(migrateState(migrateToV8(buildDemoLegacySeed())))
    const v15 = migrateV14ToV15(v14)

    expect(v15.version).toBe(SINGLE_WORKSPACE_STORAGE_VERSION)
    expect(validateV15State(v15)).toBe(true)
    expect(v15.workspace).toBeDefined()
    expect(v15.settings).toBeDefined()
    expect(v15.auditProfile).toBeDefined()
    expect('companies' in v15).toBe(false)

    for (const archive of Object.values(v15.yearArchives)) {
      expect(archive.workspace).toBeDefined()
      expect(archive.settings).toBeDefined()
      expect('companies' in archive).toBe(false)
    }
  })

  it('drops the retired procedureProcessTypes field from workspace and year archives', () => {
    const v15 = migrateV14ToV15(migrateToSingleWorkspace(migrateState(migrateToV8(buildDemoLegacySeed()))))
    expect(dropRetiredWorkspaceFields(v15)).toBe(v15)

    const legacy = { 'QP-21|dept-prod': 'production' }
    const [year] = Object.keys(v15.yearArchives)
    const withLegacy = {
      ...v15,
      workspace: { ...v15.workspace, procedureProcessTypes: legacy },
      yearArchives: year
        ? { ...v15.yearArchives, [year]: { ...v15.yearArchives[year], workspace: { ...v15.yearArchives[year].workspace, procedureProcessTypes: legacy } } }
        : v15.yearArchives,
    } as typeof v15
    const cleaned = dropRetiredWorkspaceFields(withLegacy)

    expect('procedureProcessTypes' in cleaned.workspace).toBe(false)
    for (const archive of Object.values(cleaned.yearArchives)) expect('procedureProcessTypes' in archive.workspace).toBe(false)
    expect(cleaned.workspace.planRows).toBe(v15.workspace.planRows)
    expect(validateV15State(cleaned)).toBe(true)
  })
})
