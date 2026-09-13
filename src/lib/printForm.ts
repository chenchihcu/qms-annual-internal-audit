const PRINT_BODY_CLASS = 'printing-qr-form'

/** 觸發 QR 表單列印（僅 .print-area 內容可見） */
export function triggerFormPrint(): void {
  document.body.classList.add(PRINT_BODY_CLASS)
  const cleanup = () => {
    document.body.classList.remove(PRINT_BODY_CLASS)
  }
  window.addEventListener('afterprint', cleanup, { once: true })
  window.print()
}
