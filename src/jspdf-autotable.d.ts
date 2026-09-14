declare module 'jspdf-autotable' {
  import type { jsPDF } from 'jspdf'

  interface AutoTableOptions {
    head?: string[][]
    body?: string[][]
    startY?: number
    styles?: Record<string, unknown>
    headStyles?: Record<string, unknown>
  }

  export default function autoTable(doc: jsPDF, options: AutoTableOptions): void
}
