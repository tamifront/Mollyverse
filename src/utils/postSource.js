/** Пост из профиля — виден в ленте и в профиле */
export const POST_SOURCE_PROFILE = "profile"

/** Пост из ленты — только в профиле автора */
export const POST_SOURCE_FEED = "feed"

export function isVisibleInFeed(post) {
  if (!post) return false
  if (post.post_source === POST_SOURCE_PROFILE) return true
  if (post.in_feed === true) return true
  return false
}
