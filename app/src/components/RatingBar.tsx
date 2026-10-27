import type { Grade } from 'ts-fsrs'
import { RATING_HINTS, RATING_LABELS } from '../lib/scheduler'
import type { RatingPreview } from '../lib/scheduler'
import { humanizeInterval } from '../lib/dates'

interface RatingBarProps {
  previews: readonly RatingPreview[]
  /** rating pre-selected by the card type (e.g. mcq correctness) */
  suggested: number | null
  onRate: (rating: Grade) => void
  disabled?: boolean
}

/**
 * Four FSRS ratings. The upcoming interval is previewed on every button so the
 * choice is informed rather than guesswork.
 */
export function RatingBar({ previews, suggested, onRate, disabled = false }: RatingBarProps) {
  return (
    <div className="rating-bar" role="group" aria-label="选择记忆程度">
      {previews.map((preview, index) => {
        const label = RATING_LABELS[preview.rating] ?? String(preview.rating)
        const isSuggested = suggested === preview.rating
        return (
          <button
            key={preview.rating}
            type="button"
            className={`rating${isSuggested ? ' is-suggested' : ''}`}
            disabled={disabled}
            onClick={() => onRate(preview.rating as Grade)}
            aria-label={`${label}（${RATING_HINTS[preview.rating]}），${humanizeInterval(preview.minutes)}后再见，快捷键 ${index + 1}`}
            title={RATING_HINTS[preview.rating]}
          >
            <span className="rating__key">{index + 1}</span>
            <span className="rating__label">{label}</span>
            <span className="rating__interval">{humanizeInterval(preview.minutes)}</span>
          </button>
        )
      })}
    </div>
  )
}
