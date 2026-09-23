import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Input, Select } from './Badge'

describe('共用表單元件必填標記', () => {
  it('顯示 * 並保留螢幕閱讀器可讀的必填文字', () => {
    render(
      <>
        <Input id="required-input" label="描述" value="" onChange={() => {}} required />
        <Select
          id="required-select"
          label="程序"
          value="qp-01"
          onChange={() => {}}
          options={[{ value: 'qp-01', label: 'QP-01' }]}
          required
        />
      </>,
    )

    expect(screen.getAllByText('*')).toHaveLength(2)
    expect(screen.getAllByText('必填')).toHaveLength(2)
    expect(screen.queryByText('（必填）')).toBeNull()
    expect(screen.getByRole('textbox', { name: /描述/ }).hasAttribute('required')).toBe(true)
    expect(screen.getByRole('combobox', { name: /程序/ }).hasAttribute('required')).toBe(true)
  })
})
