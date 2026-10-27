interface ProgressRingProps {
  /** 0..1 */
  value: number
  /** big centred value */
  label: string
  /** small caption under the value */
  caption?: string
  size?: number
  ariaLabel?: string
}

/** Today's progress ring (pure SVG, no dependency). */
export function ProgressRing({ value, label, caption, size = 132, ariaLabel }: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
  const stroke = 11
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius

  return (
    <div
      className="ring"
      style={{ width: size, height: size }}
      role="img"
      aria-label={ariaLabel ?? `${label} ${caption ?? ''}`.trim()}
    >
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
        <circle className="ring__track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} />
        <circle
          className="ring__value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring__center">
        <strong className="ring__label">{label}</strong>
        {caption && <span className="ring__caption">{caption}</span>}
      </div>
    </div>
  )
}
