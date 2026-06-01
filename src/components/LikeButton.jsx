import { useEffect, useRef, useState } from "react"
import "./LikeButton.css"

const PARTICLE_COUNT = 14
const BURST_MS = 620

function HeartIcon() {
  return (
    <svg
      className="like-btn__heart"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  )
}

/**
 * @param {object} props
 * @param {boolean} props.liked
 * @param {() => void} props.onClick
 * @param {boolean} [props.disabled]
 * @param {number} [props.count]
 * @param {(e: React.MouseEvent) => void} [props.onCountClick]
 * @param {string} [props.className]
 * @param {"feed" | "profile"} [props.variant]
 * @param {string} [props.title]
 */
export default function LikeButton({
  liked,
  onClick,
  disabled = false,
  count,
  onCountClick,
  className = "",
  variant = "feed",
  title,
}) {
  const [burst, setBurst] = useState(false)
  const prevLikedRef = useRef(liked)

  useEffect(() => {
    if (liked && !prevLikedRef.current) {
      setBurst(true)
      const timer = window.setTimeout(() => setBurst(false), BURST_MS)
      prevLikedRef.current = liked
      return () => window.clearTimeout(timer)
    }
    prevLikedRef.current = liked
  }, [liked])

  const showCount = count !== undefined && count !== null

  return (
    <button
      type="button"
      className={[
        "like-btn",
        `like-btn--${variant}`,
        liked ? "like-btn--liked" : "",
        burst ? "like-btn--burst" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
      disabled={disabled}
      title={title ?? (liked ? "Убрать лайк" : "Поставить лайк")}
      aria-pressed={liked}
    >
      <span className="like-btn__wrap">
        <HeartIcon />
        <span className="like-btn__particles" aria-hidden="true">
          {Array.from({ length: PARTICLE_COUNT }, (_, i) => (
            <span key={i} className="like-btn__particle" />
          ))}
        </span>
      </span>
      {showCount ? (
        <span
          className={
            onCountClick ? "like-btn__count like-btn__count--clickable" : "like-btn__count"
          }
          onClick={
            onCountClick
              ? (e) => {
                  e.stopPropagation()
                  onCountClick(e)
                }
              : undefined
          }
          title={onCountClick ? "Показать, кто лайкнул" : undefined}
          role={onCountClick ? "button" : undefined}
        >
          {Math.max(Number(count), 0)}
        </span>
      ) : null}
    </button>
  )
}
