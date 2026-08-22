import { getUser } from "@/lib/auth/users";
import { listProfiles, type ProfileRow } from "@/lib/profiles/store";

/**
 * 프로필을 지정하지 않고 상담을 열었을 때의 대상 — "나" 다.
 *
 * 예전에는 `listProfiles(userId, "self")[0]`, 즉 **가장 최근에 저장한 프로필**이었다.
 * self 가 20개까지 있을 수 있으니 그건 "나" 가 아니라 "마지막으로 손댄 사람" 이었고,
 * 홈에서 어머니를 저장하면 상담사가 어머니의 원국을 근거로 나에게 말하기 시작했다.
 * 같은 질문에 지도는 "가장 오래된 것" 이라고 답하고 있어서, 한 계정 안에서 두 화면이
 * 서로 다른 사람을 나로 여기기까지 했다.
 *
 * 이제 users.primary_profile_id 가 답하고, 두 화면이 같은 것을 본다.
 *
 * primary 가 null 인 경우(계정이 생기기 전에 만들어진 행, 또는 그 프로필이 지워진
 * 경우)에는 **가장 오래된** 저장 프로필로 물러선다 — 퍼널을 처음 끝냈을 때 만들어진
 * 것이 그 계정의 첫 프로필이고, 그게 나일 확률이 가장 높다. 최신으로 물러서면
 * 고치려던 바로 그 증상이 되돌아온다.
 */
export async function defaultConsultationSubject(userId: string): Promise<ProfileRow | undefined> {
  const [profiles, user] = await Promise.all([listProfiles(userId), getUser(userId)]);
  const primary = profiles.find((p) => p.id === user?.primaryProfileId);
  // listProfiles 는 최신순(created_at DESC)이라 가장 오래된 것은 마지막이다.
  return primary ?? profiles[profiles.length - 1];
}
