import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { characterOfBirth } from "@/lib/characters/of-birth";
import { readCurrentDraft } from "@/lib/drafts/current";
import { getProfile } from "@/lib/profiles/store";
import { parseProfileParam, type ProfileParam, type SearchParams } from "@/lib/profiles/param";
import { Reveal } from "./_components/Reveal";

/**
 * 캐릭터 공개 화면. 퍼널이 저장을 끝내고 넘어오는 자리다.
 *
 * 입력을 URL 로 나르지 않는다 — 생년월일이 리퍼러·브라우저 기록·서버 로그에 남는다.
 * 대신 방금 저장된 것을 서버에서 다시 읽는다: 로그인이면 프로필(`?profile=`),
 * 비로그인이면 익명 드래프트. 둘 다 없으면 보여줄 캐릭터가 없으므로 홈으로 보낸다.
 */
export default async function RevealPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const param = parseProfileParam(await searchParams);

  const source = await readSource(param);
  if (!source) redirect("/home");

  const character = characterOfBirth(source);
  // 만세력이 못 세우는 값이면 리빌에 세울 것이 없다. 홈이 같은 판정을 하고 안내한다.
  if (!character) redirect("/home");

  return <Reveal character={character} name={source.name} />;
}

async function readSource(param: ProfileParam) {
  // 형식이 깨진 ?profile 은 드래프트로 물러서지 않는다 — URL 이 가리킨 것과 다른
  // 사람의 캐릭터가 서게 된다. 보여줄 것이 없다는 뜻이므로 홈으로 보낸다.
  if (param.kind === "invalid") return null;
  if (param.kind === "absent") return await readCurrentDraft();

  const session = await getSession();
  // 없는 프로필과 남의 프로필을 구분하지 않는다 — 구분하면 id 로 존재 여부를 훑을 수 있다.
  if (session) return await getProfile(session.userId, param.id);
  return null;
}
