import { OTHER_REASON, joinReason, splitReason } from '../../lib/reasonOptions'
import { Input, Select } from './Badge'

/** 理由選單：固定選項，選「其他」才顯示一行說明。 */
export function ReasonSelect({
  label,
  options,
  value,
  onChange,
  required,
  className = '',
}: {
  label: string
  options: readonly string[]
  value: string | undefined
  onChange: (value: string) => void
  required?: boolean
  className?: string
}) {
  const { option, detail } = splitReason(value, options)
  return (
    <div className={`space-y-1 ${className}`}>
      <Select
        label={label}
        required={required}
        value={option}
        onChange={(next) => onChange(joinReason(next, next === OTHER_REASON ? detail : ''))}
        options={[{ value: '', label: '請選擇' }, ...options.map((item) => ({ value: item, label: item }))]}
      />
      {option === OTHER_REASON && (
        <Input
          ariaLabel={`${label}：其他說明`}
          value={detail}
          onChange={(text) => onChange(joinReason(OTHER_REASON, text))}
        />
      )}
    </div>
  )
}
