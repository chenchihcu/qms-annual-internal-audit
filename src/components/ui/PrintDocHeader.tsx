interface PrintDocHeaderProps {
  companyName: string
  auditYear: number
  formTitle: string
  subtitle?: string
}

export function PrintDocHeader({
  companyName,
  auditYear,
  formTitle,
  subtitle,
}: PrintDocHeaderProps) {
  return (
    <div className="print-only qr-form-header mb-4 text-center">
      <h1 className="text-xl font-bold">{companyName}</h1>
      <p>{auditYear} 年 · {formTitle}</p>
      {subtitle && <p className="text-sm">{subtitle}</p>}
    </div>
  )
}
