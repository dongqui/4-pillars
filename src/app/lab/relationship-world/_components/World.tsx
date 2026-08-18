"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { FRIENDS } from "../_data/mock-people";
import { placePeople } from "../_lib/layout";
import { ConnectionLines } from "./ConnectionLines";
import { SelfCore } from "./SelfCore";
import { PersonMarker } from "./PersonMarker";
import { CameraRig } from "./CameraRig";
import { RelationThread } from "./RelationThread";
import { CAMERA_FOV, DEFAULT_CAMERA_POSITION, type CameraMode } from "../_lib/camera";

export function World({
  selectedId,
  onSelect,
  mode,
  resetSignal,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  mode: CameraMode;
  resetSignal: number;
}) {
  const placed = useMemo(() => placePeople(FRIENDS), []);
  // ConnectionLines 는 이 배열이 바뀔 때만 지오메트리를 다시 만든다. placed 가
  // 고정이므로 이것도 고정이다 — 선택을 바꿔도 재생성되지 않는다.
  const targets = useMemo(() => FRIENDS.map((p) => placed.get(p.id)!), [placed]);
  const roles = useMemo(() => FRIENDS.map((p) => p.role), []);
  const selected = FRIENDS.find((p) => p.id === selectedId) ?? null;

  return (
    <Canvas
      camera={{ position: DEFAULT_CAMERA_POSITION, fov: CAMERA_FOV }}
      gl={{ antialias: true }}
      dpr={[1, 2]}
      /*
        빈 곳을 탭했을 때만 선택을 푼다.

        r3f 는 3D 오브젝트에 맞지 않은 클릭이면 무조건 onPointerMissed 를 부르는데,
        drei <Html> 은 r3f 가 리스너를 붙인 그 div 안으로 portal 한다
        (drei/web/Html.js 의 target = events.connected). 이 라우트에는 포인터
        핸들러를 가진 3D 오브젝트가 하나도 없으므로 hits 는 언제나 비고, 결국
        **명패를 탭해도 miss 가 발동해** 선택이 즉시 풀렸다. 실측: 명패 클릭 후
        시트의 aria-hidden 이 한 번도 false 가 되지 못하고 lastShown 만 갱신됐다.

        React 쪽에서 stopPropagation 으로는 못 막는다 — 네이티브 이벤트는 이미
        이 div 를 지난 뒤에야 document 의 위임 핸들러로 전달되기 때문이다.
        그래서 원인 지점에서 대상을 본다: 진짜 배경(캔버스) 클릭만 해제로 친다.
      */
      onPointerMissed={(event) => {
        if (event.target === event.currentTarget || event.target instanceof HTMLCanvasElement) {
          onSelect(null);
        }
      }}
    >
      <color attach="background" args={["#0F172A"]} />
      {/*
        안개는 카메라 기준 깊이의 함수라 카메라 거리와 같은 배율로 민다.
        55/160 은 DEFAULT_BASE_Z 가 40 이던 시절(×3.077)에 잡은 값이라, 26 으로
        내려온 지금은 C 최대 줌아웃(65)에서 3~13% 밖에 안 껴 대역이 사실상 죽어
        있었다. 같은 26/40 배율로 되돌린다(→ 35.8/104).
        기본 진입에서 사람의 깊이는 19.6~33.6 이라 전부 near(35.8)
        앞이다 — 판단해야 할 것이 안개에 묻히지 않는다. C 최대 줌아웃(65)에서
        깊이 57.9~71.7 이 32~53% 로 껴서 예전의 깊이감(22~51%)을 잇는다.
      */}
      <fog attach="fog" args={["#0F172A", 35.8, 104]} />

      <CameraRig
        mode={mode}
        resetSignal={resetSignal}
        focusOn={selected ? placed.get(selected.id)! : null}
      />

      {/*
        나와 모든 사람을 잇는 기본 구조선. 선택했을 때만 뜨는 RelationThread 와
        역할이 다르다 — 이건 항상 떠 있고, 알파는 전원 동일하다. 색만은 그
        사람의 Role 을 담아 다섯 갈래 구역을 드러낸다.
      */}
      <ConnectionLines targets={targets} roles={roles} />
      <SelfCore />

      {/*
        dim 은 '다른 role 그룹'에만 건다. 같은 그룹 사람까지 흐리면 boosted 로 한
        단계 올린 명패가 흐려진 채 커지기만 해서, 선택했을 때 오히려 더 어지럽고
        덜 읽힌다.
      */}
      {FRIENDS.map((person) => (
        <PersonMarker
          key={person.id}
          person={person}
          position={placed.get(person.id)!}
          selected={selected?.id === person.id}
          dimmed={
            selected !== null && selected.id !== person.id && selected.role !== person.role
          }
          boosted={selected !== null && selected.role === person.role}
          onSelect={onSelect}
        />
      ))}

      {selected && (
        <RelationThread to={placed.get(selected.id)!} feature={selected.feature} />
      )}
    </Canvas>
  );
}
