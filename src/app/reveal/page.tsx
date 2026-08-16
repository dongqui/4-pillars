import { redirect } from "next/navigation";
import { readAnonCharacter } from "@/lib/characters/anon";
import { Reveal } from "./_components/Reveal";

/**
 * 캐릭터 공개 화면. 결과가 확정되기 전에는 캐릭터 색을 쓰지 않는다 —
 * 중립 배경으로 두었다가 카드가 뜰 때 처음 색이 나온다.
 *
 * 계산은 /start 의 서버 액션에서 이미 끝났다. 여기 남은 2.2초는 "최소 노출"이지
 * 대기가 아니다 — 계산이 더 걸리는 구조가 되면 그때 기다림을 여기로 옮긴다.
 */
export default async function RevealPage() {
  const anon = await readAnonCharacter();
  // 직접 URL 로 들어왔거나 쿠키가 만료된 경우
  if (!anon) redirect("/start");

  return <Reveal character={anon.character} name={anon.birth.name} />;
}
