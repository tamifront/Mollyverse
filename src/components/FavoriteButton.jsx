import "./FavoriteButton.css"

/**
 * @param {object} props
 * @param {boolean} props.favorited
 * @param {() => void} props.onClick
 * @param {boolean} [props.disabled]
 * @param {number} [props.count]
 * @param {string} [props.className]
 * @param {"feed" | "profile"} [props.variant]
 * @param {string} [props.title]
 */
export default function FavoriteButton({
  favorited,
  onClick,
  disabled = false,
  count,
  className = "",
  variant = "feed",
  title,
}) {
  const showCount = count !== undefined && count !== null

  return (
    <button
      type="button"
      className={[
        "fav-btn",
        `fav-btn--${variant}`,
        favorited ? "fav-btn--faved" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
      disabled={disabled}
      title={title ?? (favorited ? "Убрать из избранного" : "В избранное")}
      aria-pressed={favorited}
    >
      <span className="fav-btn__icon" aria-hidden>
        {favorited ? "★" : "☆"}
      </span>
      {showCount ? (
        <span className="fav-btn__count">{Math.max(Number(count), 0)}</span>
      ) : null}
    </button>
  )
}
