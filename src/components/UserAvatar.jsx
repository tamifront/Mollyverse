import { useState } from "react"
import { getAvatarLetter } from "../utils/profiles"
import "./UserAvatar.css"

/**
 * Единый аватар: фото из profiles.avatar_url или буква ника.
 * @param {"xs" | "sm" | "md" | "lg" | "xl"} [size]
 */
export default function UserAvatar({
  nickname,
  avatarUrl,
  size = "md",
  className = "",
  title,
}) {
  const [broken, setBroken] = useState(false)
  const letter = getAvatarLetter(nickname)
  const showImage = Boolean(avatarUrl?.trim()) && !broken
  const classes = `user-avatar user-avatar--${size}${className ? ` ${className}` : ""}`

  if (showImage) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className={`${classes} user-avatar--img`}
        title={title}
        loading="lazy"
        decoding="async"
        onError={() => setBroken(true)}
      />
    )
  }

  return (
    <span className={`${classes} user-avatar--letter`} title={title} aria-hidden="true">
      {letter}
    </span>
  )
}
