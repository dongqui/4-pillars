import { readAnonBirth } from "@/lib/characters/anon";
import { FunnelClient } from "./_components/FunnelClient";
import { fromAnonBirth } from "./_lib/fromAnonBirth";

/**
 * 다섯 스텝 퍼널. 시각·출생지·성별까지 받아 리포트를 만든다.
 *
 * `?from=character` 로 들어오면 라이트 퍼널에서 받은 생년월일을 미리 채운다. 홈의
 * 리포트 카드가 이 주소를 쓴다 — 캐릭터를 만들 때 이미 준 값을 다시 묻지 않기 위해서다.
 * 프로필 추가는 이 파라미터 없이 들어오므로 빈 퍼널로 시작한다(다른 사람을 넣는 자리다).
 */
export default async function FunnelPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const from = Array.isArray(sp.from) ? sp.from[0] : sp.from;
  const anon = from === "character" ? await readAnonBirth() : null;

  return <FunnelClient initial={anon ? fromAnonBirth(anon) : undefined} />;
}
