import type { EvidenceAttachment } from '../types'

/** 單檔上限（解碼後位元組） */
export const MAX_ATTACHMENT_BYTES = 512 * 1024

/** 每個查檢項或 NCR 最多附件數 */
export const MAX_ATTACHMENTS_PER_TARGET = 5

export interface AttachmentValidationResult {
  ok: boolean
  error?: string
}

export function validateAttachmentSize(sizeBytes: number): AttachmentValidationResult {
  if (sizeBytes <= 0) {
    return { ok: false, error: '檔案大小無效' }
  }
  if (sizeBytes > MAX_ATTACHMENT_BYTES) {
    return {
      ok: false,
      error: `檔案超過 ${Math.round(MAX_ATTACHMENT_BYTES / 1024)} KB 上限`,
    }
  }
  return { ok: true }
}

export function canAddAttachment(
  existing: EvidenceAttachment[] | undefined,
): AttachmentValidationResult {
  const count = existing?.length ?? 0
  if (count >= MAX_ATTACHMENTS_PER_TARGET) {
    return { ok: false, error: `最多 ${MAX_ATTACHMENTS_PER_TARGET} 個附件` }
  }
  return { ok: true }
}

export function createAttachmentFromDataUrl(
  fileName: string,
  mimeType: string,
  sizeBytes: number,
  dataUrl: string,
): EvidenceAttachment {
  return {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fileName,
    mimeType,
    sizeBytes,
    dataUrl,
    addedAt: new Date().toISOString(),
  }
}

export async function readFileAsAttachment(file: File): Promise<{
  attachment?: EvidenceAttachment
  error?: string
}> {
  const sizeCheck = validateAttachmentSize(file.size)
  if (!sizeCheck.ok) return { error: sizeCheck.error }

  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      resolve({
        attachment: createAttachmentFromDataUrl(
          file.name,
          file.type || 'application/octet-stream',
          file.size,
          dataUrl,
        ),
      })
    }
    reader.onerror = () => resolve({ error: '讀取檔案失敗' })
    reader.readAsDataURL(file)
  })
}

export function formatAttachmentNamesForPrint(attachments: EvidenceAttachment[] | undefined): string {
  if (!attachments?.length) return ''
  return attachments.map((a) => a.fileName).join('、')
}

export function normalizeAttachments(
  attachments: EvidenceAttachment[] | undefined,
): EvidenceAttachment[] {
  return attachments ?? []
}
