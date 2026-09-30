import { describe, expect, it } from 'vitest'
import { buildDemoLegacySeed, migrateToV8 } from '../../data/demoData'
import { migrateState } from '../migrate'
import { migrateToSingleWorkspace } from '../singleWorkspaceMigration'
import {
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
})
