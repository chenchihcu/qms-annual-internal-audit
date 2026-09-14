import type { jsPDF } from 'jspdf'

const NOTO_SANS_TC_URL =
  'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-tc@latest/chinese-traditional-400-normal.ttf'

const FONT_FILE = 'NotoSansTC-Regular.ttf'
const FONT_FAMILY = 'NotoSansTC'

let fontBase64Promise: Promise<string> | null = null

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

async function loadNotoSansTcBase64(): Promise<string> {
  const res = await fetch(NOTO_SANS_TC_URL)
  if (!res.ok) throw new Error(`無法載入 PDF 字型：${res.status}`)
  const buffer = await res.arrayBuffer()
  return bytesToBase64(new Uint8Array(buffer))
}

export async function ensurePdfChineseFont(doc: jsPDF): Promise<void> {
  if (!fontBase64Promise) {
    fontBase64Promise = loadNotoSansTcBase64()
  }
  const base64 = await fontBase64Promise
  doc.addFileToVFS(FONT_FILE, base64)
  doc.addFont(FONT_FILE, FONT_FAMILY, 'normal')
  doc.setFont(FONT_FAMILY, 'normal')
}
