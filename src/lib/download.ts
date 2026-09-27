/** Trigger browser download for a Blob (client-side only). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  try {
    a.click()
  } finally {
    a.remove()
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Sanitize filename segments while keeping Chinese characters. */
export function safeFilename(parts: string[]): string {
  return parts
    .map((p) => p.replace(/[/\\?%*:|"<>]/g, '_').trim())
    .filter(Boolean)
    .join('_')
}
