export function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-dashed border-line bg-page/50 px-4 py-6 text-center text-sm text-muted">
      {message}
    </p>
  )
}
