import type { Metadata } from "next";
import { FRIENDS, SELF } from "./_data/mock-people";
import { MapShell } from "./_components/MapShell";

export const metadata: Metadata = {
  title: "관계 지도",
  robots: { index: false, follow: false },
};

// TASK 7 이 이 파일을 리다이렉트 전용 서버 컴포넌트로 대체한다.
export default function MapPage() {
  return (
    <MapShell
      people={FRIENDS.map((p) => ({ ...p, sameDayPillar: false }))}
      center={{ name: SELF.name, pillarKey: SELF.pillarKey, sceneName: SELF.sceneName }}
      isOwner
      shareId="preview"
    />
  );
}
