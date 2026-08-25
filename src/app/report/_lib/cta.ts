/**
 * 로그인이 필요한 화면으로 보내는 링크.
 *
 * /map·/match 둘 다 서버에서 비로그인을 로그인으로 넘기지만, 링크를 눌러 한 번
 * 튕기게 두는 것보다 처음부터 맞는 곳으로 보낸다. LockedSections 가 쓰는 형태와 같다.
 */
export function ctaHref(path: string, isLoggedIn: boolean): string {
  return isLoggedIn ? path : `/login?next=${encodeURIComponent(path)}`;
}
