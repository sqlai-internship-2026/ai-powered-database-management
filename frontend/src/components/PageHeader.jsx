// The heading of a screen, and the only place the screen says its own name.
//
// Four parts, three of them optional: a small eyebrow naming the part of the
// console this belongs to, the title, a sentence about what the screen is for,
// and whatever the screen wants offered beside it. Called with just a title
// and a description on most screens, which is the shape it had before the
// eyebrow and the actions existed.
export default function PageHeader({ title, description, eyebrow, actions }) {
  return (
    <div className="page-header">
      <div className="page-header-text">
        {eyebrow ? <span className="page-eyebrow">{eyebrow}</span> : null}
        <h1 className="page-title">{title}</h1>
        {description ? <p className="page-description">{description}</p> : null}
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </div>
  )
}
