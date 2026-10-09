interface PrintDocHeaderProps {
  companyName: string
  auditYear: number
  formTitle: string
  formId?: string
  subtitle?: string
  /** 額外列印標頭行（每行獨立段落，例：主要客戶、計畫窗口） */
  detailLines?: string[]
}

export function PrintDocHeader({
  companyName,
  auditYear,
  formTitle,
  formId,
  subtitle,
  detailLines,
}: PrintDocHeaderProps) {
  return (
    <div className="print-only qr-form-header mb-4 text-center relative">
      {formId && (
        <div className="absolute top-0 right-0 text-sm font-medium">
          {formId}
        </div>
      )}
      <h1 className="text-xl font-bold">{companyName}</h1>
      <h2 className="text-2xl font-bold mt-2">
        {auditYear} 年 · {formTitle}
      </h2>
      {subtitle && <p className="text-base mt-2">{subtitle}</p>}
      {detailLines?.map((line) => (
        <p key={line} className="text-sm mt-1">
          {line}
        </p>
      ))}
    </div>
  )
}
