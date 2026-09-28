import { useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import type { TrashEntry } from '../types'
import { TRASH_KIND_LABELS, trashEntrySummary } from '../lib/trash'
import { Badge, Button, Card } from './ui/Badge'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { EmptyState } from './ui/EmptyState'
import { ScrollRegion } from './ui/ScrollRegion'
import { useTablePagination } from '../hooks/useTablePagination'
import { TablePagination } from './ui/TablePagination'

function trashContext(entry: TrashEntry): string {
  if (entry.kind === 'person') return '人員名冊'
  if (entry.kind === 'onsite_slot') return `外稽準備 · ${entry.location.prepYear} 年`
  if (entry.kind === 'checklist_item') return `${entry.location.year} 年查檢表`
  return `${entry.location.year} 年`
}

function deletedAtLabel(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-TW')
}

export function TrashPanel({ store }: { store: AuditStore }) {
  const { state, restoreFromTrash, permanentlyDeleteFromTrash } = store
  const entries = [...(state.trash ?? [])].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
  const pagination = useTablePagination(entries.length)
  const [permanentTarget, setPermanentTarget] = useState<TrashEntry | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const handleRestore = (entry: TrashEntry) => {
    const result = restoreFromTrash(entry.id)
    if (result.ok) {
      setFeedback('已還原至原年度與清單位置。')
    } else if (result.reason === 'source_missing') {
      setFeedback('找不到原始年度或清單；資料仍保留在回收區。')
    } else if (result.reason === 'conflict') {
      setFeedback('原位置已有相同識別資料，請先確認後再還原。資料仍保留在回收區。')
    } else {
      setFeedback('找不到這筆回收資料。')
    }
  }

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">回收區</h2>
        <Badge label={`${entries.length} 筆`} />
      </div>
      <p className="mb-4 text-sm text-muted">刪除的自建資料會先移至此處。還原會回到原年度或查檢表位置；永久清除後無法復原。</p>
      {feedback && <p className="mb-3 text-sm text-slate-700" role="status">{feedback}</p>}
      {entries.length === 0 ? (
        <EmptyState message="回收區目前是空的。" />
      ) : (
        <>
        <ScrollRegion ariaLabel="回收區資料清單">
          <table className="worksheet-table min-w-[40.5rem]">
            <colgroup>
              <col className="col-status" />
              <col />
              <col />
              <col className="col-datetime" />
              <col className="col-action no-print" />
            </colgroup>
            <thead>
              <tr>
                <th >類型</th>
                <th >資料</th>
                <th >原位置</th>
                <th >移除時間</th>
                <th className="no-print">操作</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => {
                const summary = trashEntrySummary(entry)
                return (
                  <tr key={entry.id} className={!pagination.isVisible(index) ? 'pagination-hidden-row' : undefined}>
                    <td >{TRASH_KIND_LABELS[entry.kind]}</td>
                    <td >{summary || '—'}</td>
                    <td >{trashContext(entry)}</td>
                    <td>{deletedAtLabel(entry.deletedAt)}</td>
                    <td className="no-print">
                      <div className="flex flex-wrap gap-1">
                        <Button variant="secondary" onClick={() => handleRestore(entry)} aria-label={`還原：${summary}`}>
                          還原
                        </Button>
                        <Button
                          variant="ghost"
                          className="text-red-700"
                          onClick={() => setPermanentTarget(entry)}
                          aria-label={`永久清除：${summary}`}
                        >
                          永久清除
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </ScrollRegion>
        <TablePagination pagination={pagination} label="回收區" />
        </>
      )}
      {permanentTarget && (
        <ConfirmDialog
          open
          title="永久清除這筆資料？"
          description={`${trashEntrySummary(permanentTarget)}\n\n永久清除後無法還原。`}
          confirmLabel="永久清除"
          variant="danger"
          onConfirm={() => {
            permanentlyDeleteFromTrash(permanentTarget.id)
            setPermanentTarget(null)
            setFeedback('已永久清除。')
          }}
          onCancel={() => setPermanentTarget(null)}
        />
      )}
    </Card>
  )
}
