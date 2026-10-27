import { useEffect, useState } from 'react'

interface StepperProps {
  id: string
  label: string
  hint?: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}

/** Number field with ≥44px −/+ buttons; typing is also supported. */
export function Stepper({ id, label, hint, value, min, max, step, onChange }: StepperProps) {
  const [draft, setDraft] = useState(`${value}`)

  useEffect(() => {
    setDraft(`${value}`)
  }, [value])

  const commit = (raw: string) => {
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) {
      setDraft(`${value}`)
      return
    }
    const next = Math.min(max, Math.max(min, Math.round(parsed)))
    onChange(next)
    setDraft(`${next}`)
  }

  return (
    <div className="setting-row">
      <div className="setting-row__text">
        <label htmlFor={id} className="setting-row__label">
          {label}
        </label>
        {hint && <p className="setting-row__hint">{hint}</p>}
      </div>
      <div className="stepper">
        <button
          type="button"
          className="stepper__btn"
          aria-label={`减少${label}`}
          onClick={() => onChange(Math.max(min, value - step))}
          disabled={value <= min}
        >
          −
        </button>
        <input
          id={id}
          className="stepper__input"
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={step}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit((event.target as HTMLInputElement).value)
          }}
          aria-label={label}
        />
        <button
          type="button"
          className="stepper__btn"
          aria-label={`增加${label}`}
          onClick={() => onChange(Math.min(max, value + step))}
          disabled={value >= max}
        >
          +
        </button>
      </div>
    </div>
  )
}
