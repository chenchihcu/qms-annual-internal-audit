interface PrintDocHeaderProps {
  companyName: string
  auditYear: number
  formTitle: string
  subtitle?: string
  /** 額外列印標頭行（每行獨立段落，例：主要客戶、計畫窗口） */
  detailLines?: string[]
}

export function PrintDocHeader({
  companyName,
  auditYear,
  formTitle,
  subtitle,
  detailLines,
}: PrintDocHeaderProps) {
  return (
    <div className="print-only qr-form-header mb-4 text-center">
      <h1 className="text-xl font-bold">{companyName}</h1>
      <p>
        {auditYear} 年 · {formTitle}
      </p>
      {subtitle && <p className="text-sm">{subtitle}</p>}
      {detailLines?.map((line) => (
        <p key={line} className="text-sm">
          {line}
        </p>
      ))}
    </div>
  )
}
