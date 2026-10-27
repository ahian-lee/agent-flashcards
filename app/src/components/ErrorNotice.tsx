interface ErrorNoticeProps {
  message: string
  action?: { label: string; onClick: () => void }
}

/** Inline, non-blocking error surface (DB failures, missing content, …). */
export function ErrorNotice({ message, action }: ErrorNoticeProps) {
  return (
    <div className="notice notice--error" role="alert">
      <span>{message}</span>
      {action && (
        <button type="button" className="btn btn--small" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  )
}
