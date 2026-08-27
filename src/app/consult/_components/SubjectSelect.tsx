"use client";

import { useRouter } from "next/navigation";
import type { PersonOption } from "@/lib/profiles/option";
import { PersonPicker } from "@/components/PersonPicker";

interface Props {
  people: PersonOption[];
  /** 지금 상담이 근거로 삼는 사람. 서버가 고른 값이라 목록 안에 반드시 있다. */
  selectedId: string;
}

/**
 * 시안의 "상담에 쓰는 사주" 칸.
 *
 * 없어도 상담은 열렸다 — 대신 상담사가 **누구의** 원국을 근거로 말하는지가 화면
 * 어디에도 없었다. 홈에서 프로필을 골라 들어왔는지(`?profile=`) 계정의 "나" 로
 * 떨어졌는지(defaultConsultationSubject)를 구분할 방법도 없어서, 어머니를 보다가
 * 넘어온 사람은 그 상담이 어머니 것인 줄 알았다.
 *
 * 드롭다운의 화면 부분(버튼·패널·바깥 클릭 닫기·Escape·아바타·"새 프로필 추가")은
 * PersonPicker 로 뽑았다 — 이 컴포넌트에 남은 것은 레이블과, 고른 값을 어디에
 * 둘지뿐이다.
 *
 * 고른 값은 URL(`?profile=`)에 산다 — 상담을 실제로 여는 POST 가 읽는 것과 같은
 * 값이어야 화면과 근거가 갈리지 않는다. 별도 상태로 들고 있으면 새로고침 한 번에
 * 둘이 어긋난다.
 */
export function SubjectSelect({ people, selectedId }: Props) {
  const router = useRouter();

  return (
    <div className="mt-4">
      <div className="mb-[7px] text-[11.5px] font-bold tracking-[0.08em] text-slate-400">
        상담에 쓰는 사주
      </div>
      <PersonPicker
        people={people}
        selectedId={selectedId}
        onPick={(id) => {
          // replace 다 — 프로필을 바꾼 것은 새 화면이 아니라 같은 화면의 설정이라,
          // push 로 쌓으면 뒤로가기가 목록을 몇 번이고 되짚는다.
          router.replace(`/consult?profile=${encodeURIComponent(id)}`);
        }}
      />
    </div>
  );
}
