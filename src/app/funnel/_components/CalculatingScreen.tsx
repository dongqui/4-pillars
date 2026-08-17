"use client";

import { CharacterLoadingScreen } from "@/components/CharacterLoading";

/**
 * 퍼널 마지막 화면. 저장 요청이 오가는 동안 서고, 곧바로 /reveal 로 이어진다 —
 * 리빌의 첫 페이즈와 같은 화면이라 라우트가 바뀌는 것이 보이지 않아야 한다.
 */
export function CalculatingScreen({ name }: { name: string }) {
  const who = name.trim() ? `${name.trim()}님의` : "당신의";
  return <CharacterLoadingScreen line={`${who} 사주를 세우고 있어요`} />;
}
