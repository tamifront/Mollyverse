/** Откуда создан пост (для истории), на отображение не влияет */
export const POST_SOURCE_PROFILE = "profile"
export const POST_SOURCE_FEED = "feed"

/** Все посты видны в ленте: и из профиля, и из ленты */
export function isVisibleInFeed(post) {
  return Boolean(post)
}
