import { useState, type KeyboardEvent } from 'react'
import { Button } from './Badge'

interface TagInputProps {
  label: string
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
}

export function TagInput({ label, value, onChange, placeholder = '輸入後按 Enter 或加入' }: TagInputProps) {
  const [draft, setDraft] = useState('')

  const addTag = () => {
    const next = draft.trim()
    if (!next || value.includes(next)) {
      setDraft('')
      return
    }
    onChange([...value, next])
    setDraft('')
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      addTag()
    }
  }

  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        />
        <Button type="button" variant="secondary" onClick={addTag}>加入</Button>
      </div>
      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700"
            >
              {tag}
              <button
                type="button"
                className="text-slate-500 hover:text-slate-800"
                aria-label={`移除 ${tag}`}
                onClick={() => onChange(value.filter((item) => item !== tag))}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </label>
  )
}
