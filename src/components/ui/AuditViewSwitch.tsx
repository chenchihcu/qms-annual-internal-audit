import { ViewSwitch } from './ViewSwitch'

export type AuditView = 'audit' | 'prep'

/** 查檢表單一入口：查檢與外稽準備兩種檢視，資料各自保存、互不覆寫。 */
export function AuditViewSwitch({
  current,
  onChange,
  prepProgress,
}: {
  current: AuditView
  onChange: (view: AuditView) => void
  prepProgress?: string
}) {
  return (
    <ViewSwitch
      current={current}
      ariaLabel="查檢表檢視"
      views={[
        { value: 'audit', label: '查檢' },
        { value: 'prep', label: prepProgress ? `外稽準備 ${prepProgress}` : '外稽準備' },
      ]}
      onChange={onChange}
    />
  )
}
