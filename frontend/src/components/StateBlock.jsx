import { AlertIcon, InboxIcon } from './icons'

// The three things a panel can have instead of content, said the way the list
// screens already say them: a skeleton while the answer is on its way, a
// sentence about the data when there is none, and a sentence about the failure
// when the request did not arrive.
//
// Kept in one component because the report, dynamic-report and audit screens
// were each writing their own, and "Building the financial report..." in a
// bare card is not the same design as the one the tables use.
export default function StateBlock({
  variant = 'empty',
  title,
  text,
  actions = null,
  lines = 5,
}) {
  if (variant === 'loading') {
    return (
      <div className="skeleton-rows" aria-busy="true">
        {Array.from({ length: lines }, (_, index) => (
          <div
            key={index}
            className="skeleton skeleton-line"
            style={{ width: index === 0 ? '34%' : `${94 - (index % 4) * 13}%` }}
          />
        ))}
        <span className="visually-hidden">{title || 'Loading'}</span>
      </div>
    )
  }

  const isError = variant === 'error'

  return (
    <div className="state-block">
      <span className={isError ? 'state-icon state-icon-danger' : 'state-icon'}>
        {isError ? <AlertIcon size={20} /> : <InboxIcon size={20} />}
      </span>
      {title ? <p className="state-title">{title}</p> : null}
      {text ? <p className="state-text">{text}</p> : null}
      {actions ? <div className="state-actions">{actions}</div> : null}
    </div>
  )
}
