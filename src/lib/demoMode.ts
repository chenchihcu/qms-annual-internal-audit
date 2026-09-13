import type { AppState, DataSource } from '../types'

export function resolveDataSource(state: AppState): DataSource {
  return state.dataSource === 'user' ? 'user' : 'demo'
}

export function shouldShowDemoBanner(state: AppState): boolean {
  return resolveDataSource(state) === 'demo'
}
