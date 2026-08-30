"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { Element } from "@/lib/saju-core";
import type { MapPerson } from "../_data/person";
import { PeopleList } from "./PeopleList";
import { AddPersonModal } from "./AddPersonModal";
import { MapHeader } from "./MapHeader";

const World = dynamic(() => import("./World").then((m) => m.World), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center text-sm text-slate-500">
      관계 지도를 여는 중
    </div>
  ),
});

export function MapShell({
  people,
  centerElement,
  isOwner,
  shareId,
  loggedIn,
}: {
  people: readonly MapPerson[];
  /** 중심(나)의 일간 오행. PeopleList 의 궁합 단락이 쓴다. */
  centerElement: Element;
  isOwner: boolean;
  shareId: string;
  loggedIn: boolean;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(true);
  const [adding, setAdding] = useState(false);

  // 토스트는 여기가 갖는다. 공유(MapHeader)와 삭제 실패(handleDelete) 둘 다
  // 같은 자리에 떠야 하는데, 헤더 안에 두면 삭제 쪽에서 닿을 수 없다.
  const [toast, setToast] = useState<string | null>(null);
  // 두 번째 메시지가 1800ms 안에 들어오면 새 토스트가 이전 타이머에 맞아 일찍
  // 지워진다. 타이머를 쥐고 있다가 새로 걸기 전에 먼저 지운다.
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(message: string) {
    if (toastTimer.current !== null) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 1800);
  }

  useEffect(() => {
    return () => {
      if (toastTimer.current !== null) clearTimeout(toastTimer.current);
    };
  }, []);

  // 3D 노드를 탭하면 목록의 그 행이 답이다 — 패널이 접혀 있으면 펼친다.
  // (목록 행을 탭한 경우에도 같은 경로로 오지만, 이미 열려 있으니 no-op 다.)
  function selectPerson(id: string | null) {
    setSelectedId(id);
    if (id !== null) setListOpen(true);
  }

  /**
   * 실패를 조용히 삼키지 않는다. 지우기는 남이 채워 넣은 쓰레기에 대한 소유자의
   * 유일한 대응 수단이라, 403 도 500 도 오프라인도 "아무 일 없음" 으로 보이면
   * 사용자는 같은 버튼을 계속 누르면서 지도가 왜 그대로인지 알 수 없다.
   */
  async function handleDelete(id: string) {
    let res: Response;
    try {
      res = await fetch(`/api/maps/${shareId}/people/${id}`, { method: "DELETE" });
    } catch {
      // fetch 가 던지는 것은 네트워크가 끊긴 경우다 — 상태 코드가 아예 없다.
      showToast("연결이 끊겼어요. 잠시 뒤 다시 시도해 주세요");
      return;
    }

    if (res.status === 404) {
      // 이미 없는 사람이다. 실패로 알리되 목록은 새로고침한다 — 화면에만 남아 있던
      // 유령이 사라지는 것이 사용자가 원한 결과다.
      showToast("이미 지워진 사람이에요");
    } else if (res.status === 403) {
      showToast("지도 주인만 지울 수 있어요");
      return;
    } else if (!res.ok) {
      showToast("지우지 못했어요. 잠시 뒤 다시 시도해 주세요");
      return;
    }

    // 서버 컴포넌트가 목록의 진실이다. 로컬 상태로 낙관적 갱신을 하면 두 벌이 된다.
    if (selectedId === id) setSelectedId(null);
    router.refresh();
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white text-slate-900">
      {/* 추가 모달이 떠 있는 동안 뒤 콘텐츠 전체(헤더 포함)를 포커스·클릭에서
          뺀다 — 오버레이가 시각적으로 덮어도 Tab 은 뚫고 들어간다. 헤더까지
          한 wrapper 로 묶는 것은, 헤더만 따로 inert 를 걸면 그 사이 Tab
          순서에 wrapper 경계가 하나 더 생겨 레이아웃과 무관하게 코드만
          복잡해지기 때문이다 — 이 wrapper 는 기존 바깥 div 와 같은
          flex-col/flex-1 이라 자식들의 배치는 그대로다. */}
      <div inert={adding} className="flex min-h-0 flex-1 flex-col">
        <MapHeader shareId={shareId} loggedIn={loggedIn} onToast={showToast} />

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="relative min-h-0 flex-1">
            {/*
              isolate 가 필수다. drei <Html> 은 카메라 거리로 z-index 를 계산해
              zIndexRange 안의 값을 마커마다 찍는데, R3F 가 만드는 Html 컨테이너는
              position:relative + z-index auto 라 쌓임 맥락을 만들지 않는다. 여기서
              맥락을 끊으면 마커의 z 는 이 div 안에서만 유효해지고, div 자체는
              z-auto 라 패널·모달이 항상 위다.
            */}
            <div className="absolute inset-0 isolate">
              <World people={people} selectedId={selectedId} onSelect={selectPerson} />
            </div>

            {/* 소유자가 아니어도 보인다 — 링크를 받은 사람이 자기를 넣는 것이 이 기능의 전부다. */}
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="absolute right-4 bottom-4 z-10 rounded-full bg-blue-600 px-[18px] py-3 text-[14px] font-bold text-white shadow-elevated hover:bg-blue-700"
            >
              + 나도 추가하기
            </button>
          </div>

          {/*
            사이드 패널. 데스크톱은 우측 400px 고정 컬럼, 모바일은 하단 판이다.
            모바일에서 접으면 헤더 행만 남고, 펼치면 최대 58vh 까지 (시안).
          */}
          <div
            className={`
              flex flex-col shrink-0 bg-white
              border-t border-slate-100 md:border-t-0 md:border-l
              md:w-[400px] md:max-h-none
              ${listOpen ? "max-h-[58vh]" : ""}
            `}
          >
            <PeopleList
              people={people}
              centerElement={centerElement}
              open={listOpen}
              onToggle={() => setListOpen((v) => !v)}
              selectedId={selectedId}
              onSelect={selectPerson}
              isOwner={isOwner}
              onDelete={handleDelete}
            />
          </div>
        </div>
      </div>

      {/* open prop 이 아니라 마운트 자체로 연다 — AddPersonModal 은 내부에
          draft/error state 를 갖는데, 이걸 항상 마운트해 두고 open 으로만
          가리면 닫았다 다시 열어도 그 state 가 안 지워진다(모달 자신의
          docstring이 "닫으면 언마운트라 지워진다"고 약속한 바로 그 동작). */}
      {adding && (
        <AddPersonModal
          shareId={shareId}
          onClose={() => setAdding(false)}
          onAdded={(id) => {
            setAdding(false);
            // 서버가 목록의 진실이다. refresh 로 새 사람을 받아오고, 도착하면
            // selectedId 가 그를 가리켜 카메라가 날아가고 행이 하이라이트된다.
            setSelectedId(id);
            router.refresh();
          }}
        />
      )}

      {/* z-40 — 패널(z-10)보다 위다. 목록에서 지운 결과를 목록이 가리면 안 된다. */}
      {toast && (
        <p
          role="status"
          className="fixed left-1/2 top-[72px] z-40 -translate-x-1/2 rounded-full bg-slate-800/95 px-4 py-2 text-[13px] text-slate-100"
        >
          {toast}
        </p>
      )}
    </div>
  );
}
