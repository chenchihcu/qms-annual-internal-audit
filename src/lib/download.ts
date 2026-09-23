/** Trigger browser download for a Blob (client-side only). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Sanitize filename segments while keeping Chinese characters. */
export function safeFilename(parts: string[]): string {
  return parts
    .map((p) => p.replace(/[/\\?%*:|"<>]/g, '_').trim())
    .filter(Boolean)
    .join('_')
}
