# 관계 Field 재설계 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/lab/relationship-world` 의 5개 성운을 형태와 공간의 성질이 서로 다른 5개 관계 Field 로 바꿔, 폰에서 실제로 다른 공간처럼 느껴지게 한다.

**Architecture:** `Nebula.tsx` 하나를 숫자만 바꿔 다섯 번 렌더하던 구조를 버리고, Field 마다 자기 컴포넌트와 자기 기하 전략을 준다. 재질은 drei 의 `shaderMaterial` 로 만든 커스텀 GLSL 이며, 다섯 재료가 같은 등록 패턴을 공유한다. 사람은 3D 발광 노드(깊이 담당)와 DOM 이름표(가독성 담당)로 분리한다.

**Tech Stack:** Next 16.2.10 App Router, React 19.2.4, TypeScript strict, Tailwind 4, three 0.185, @react-three/fiber 9.7, @react-three/drei 10.7, vitest (environment: node)

## Global Constraints

이 절의 규칙은 **모든 태스크의 요구사항에 암묵적으로 포함된다.**

- **형태가 구분을 진다.** 색을 흑백으로 바꿔놓고 봐도 다섯 Field 가 구분되어야 한다. 색은 보조일 뿐이다.
- **색은 미묘한 색온 차이만.** 전부 채도 26% 이하의 좁은 대역 안에 머문다. 어떤 Field 도 오행을 지시하지 않는다.
- **레이마칭 금지.** 볼륨은 겹친 셸 + 노이즈로 흉내 낸다. 프래그먼트 셰이더에 픽셀당 루프를 넣지 않는다.
- **노이즈는 저주파 2옥타브까지.** 프랙탈 다층 노이즈를 쓰지 않는다.
- **포스트프로세싱 금지.** bloom, DOF 등 풀스크린 패스를 추가하지 않는다.
- **큰 반투명 면의 겹침을 제한한다.** 오버드로가 폰에서 가장 비싸다.
- **Role = 공간 / Feature = 현상.** `feature`(六合/沖)는 Field 를 만드는 데 일절 쓰지 않는다. 사람을 선택했을 때 나 ↔ 상대 사이 현상으로만 나타난다.
- **거리는 궁합이 아니다.** `positionFor` 는 `feature` 를 받지 않고, `placePeople` 의 `Placeable` 에는 `feature` 필드가 없다.
- **六合과 沖은 같은 색, 같은 렌더 불투명도.** 움직임의 질로만 다르다.
- **`feature: "none"` 은 완전히 침묵한다.** 배지도 라벨도 "중립" 개념도 없다.
- **한글은 WebGL 안에 넣지 않는다.** 이름·설명은 전부 DOM.
- **`src/app/globals.css` 를 수정하지 않는다.**
- **`Math.random()` 을 쓰지 않는다.** 시드 해시(`hash01`)만.
- **전역 상태 라이브러리를 추가하지 않는다.**
- **`src/app/lab/relationship-world/` 밖을 건드리지 않는다.** 예외는 읽기 전용 재사용(`@/components/SegmentedControl`, `@/components/Badge`).
- 모든 UI 텍스트는 한국어.
- 배경 베이스 `#0F172A`, 나 코어 accent `#2563EB`/`#60A5FA`.

### Field 틴트 (§ 색온)

| Role | hex | 채도 | 성격 |
| --- | --- | --- | --- |
| `fill` | `#d2cec7` | 11% | 가장 따뜻함 (안개) |
| `beside` | `#c9cdd2` | 9% | 중립 |
| `express` | `#c2cbd6` | 20% | 살짝 차가움 |
| `move` | `#bac6d6` | 25% | 차가움 |
| `refine` | `#b6c2d4` | 26% | 가장 차가움 (결정) |

---

## File Structure

| 파일 | 책임 |
| --- | --- |
| `_lib/layout.ts` | `FIELD_CENTERS`/`FIELD_EXTENT` (기존 `NEBULA_*` 개명) + `positionFor`/`placePeople` |
| `_lib/layout.test.ts` | 거리 규칙 잠금 + 새 진입 프레이밍 불변식 |
| `_lib/camera.ts` | 기본 뷰·모드 제한 (거리 재조정) |
| `_components/fields/tint.ts` | Field 별 색온 상수 |
| `_components/fields/shaders/common.ts` | 공유 GLSL 조각 (해시 노이즈, fresnel) |
| `_components/fields/shaders/materials.ts` | 5개 `shaderMaterial` 정의 + `extend` + 타입 증강 |
| `_components/fields/FillVolume.tsx` | 감싸는 안개 |
| `_components/fields/BesideLayers.tsx` | 평행 층 |
| `_components/fields/ExpressRays.tsx` | 방사 광선 |
| `_components/fields/MoveRibbons.tsx` | 흐르는 리본 |
| `_components/fields/RefineShards.tsx` | 정돈된 결정 |
| `_components/fields/FieldRegistry.tsx` | role → 컴포넌트 매핑 |
| `_components/fields/FieldAccents.tsx` | Field 경계 암시용 소량 파티클 |
| `_components/PersonNode.tsx` | 3D 발광 노드 |
| `_components/PersonMarker.tsx` | DOM 이름표 (노드 위에 붙도록 수정) |
| `_components/World.tsx` | 조립 |
| `_components/Starfield.tsx` | 배경 별먼지 (밀도 하향) |

`_components/Nebula.tsx` 는 **삭제한다.**

---

## Task 1: 개명과 진입 프레이밍 불변식 교체 (TDD)

1차 최종 수정에서 넣은 진입 프레이밍 테스트 두 개가 이번 방향과 정면으로 충돌한다. 이 태스크가 그 충돌을 먼저 정리한다. 여기서 잡은 카메라 거리 위에 나머지 태스크가 전부 얹힌다.

**Files:**
- Modify: `src/app/lab/relationship-world/_lib/layout.ts`
- Modify: `src/app/lab/relationship-world/_lib/camera.ts`
- Modify: `src/app/lab/relationship-world/_lib/layout.test.ts`
- Modify: `src/app/lab/relationship-world/_components/Nebula.tsx` (import 이름만)
- Modify: `src/app/lab/relationship-world/_components/CameraRig.tsx` (해당 시)

**Interfaces:**
- Consumes: 없음
- Produces:
  - `FIELD_CENTERS: Record<RelationRole, Vec3>` (기존 `NEBULA_CENTERS` 개명, 값 동일)
  - `FIELD_EXTENT: Record<RelationRole, number>` (기존 `NEBULA_SPREAD` 개명, 값 동일)
  - `DEFAULT_CAMERA_POSITION`, `DEFAULT_TARGET`, `CAMERA_LIMITS`, `CAMERA_FOV` (값 재조정)

- [ ] **Step 1: 개명**

`_lib/layout.ts` 에서 `NEBULA_CENTERS` → `FIELD_CENTERS`, `NEBULA_SPREAD` → `FIELD_EXTENT` 로 바꾼다. **값은 그대로 둔다** — 비대칭 배치와 좌표 규칙 테스트가 이미 검증돼 있다.

주석도 "성운" → "Field" 로 맞춘다. 이제 성운이 아니다.

그 다음 저장소 전체에서 옛 이름을 찾아 전부 고친다:

```bash
grep -rn "NEBULA_CENTERS\|NEBULA_SPREAD" src/
```

`Nebula.tsx` 는 이 태스크에서 삭제하지 않는다(Task 2 에서 삭제). import 이름만 맞춰 컴파일되게 둔다.

- [ ] **Step 2: 실패하는 테스트 작성**

`_lib/layout.test.ts` 에서 **아래 두 describe 블록을 통째로 삭제한다:**

- `"기본 진입 뷰 프레이밍 (375×812)"` 안의 `"사람 20명 중 18명 이상이 화면 안에 들어온다"`
- 같은 블록 안의 `"성운 중심 5개가 전부 화면 안에 들어온다"`

`"기본 진입 뷰는 A·B·C 세 모드의 제한 안에 있다"` 블록은 **그대로 둔다.** 세 모드를 같은 자리에서 비교해야 한다는 요구는 변하지 않았다.

기존 `projectToNdc` 헬퍼와 `PHONE_ASPECT` 상수는 재사용한다. 그 아래에 새 블록을 넣는다:

```ts
describe("진입 프레이밍 — 다 담지 않되 길을 잃지 않는다", () => {
  const eye = DEFAULT_CAMERA_POSITION as V3;
  const target = DEFAULT_TARGET as V3;

  const onScreen = (p: V3, from: V3 = eye, look: V3 = target) => {
    const n = projectToNdc(p, from, look, CAMERA_FOV, PHONE_ASPECT);
    return n.depth > 0 && Math.abs(n.x) <= 1 && Math.abs(n.y) <= 1;
  };

  it("나(원점)는 화면 안에 있다 — 기준점을 잃지 않는다", () => {
    expect(onScreen(SELF_POSITION as V3)).toBe(true);
  });

  it("Field 중심이 2~4개 보인다 — 빈 화면도, 전부 보이지도 않는다", () => {
    const visible = ROLE_ORDER.filter((r) => onScreen(FIELD_CENTERS[r] as V3)).length;
    expect(visible).toBeGreaterThanOrEqual(2);
    expect(visible).toBeLessThanOrEqual(4);
  });
});

describe("모든 Field 는 각 모드의 제한 안에서 도달 가능하다", () => {
  // '도달 가능' = Field 중심을 화면에 넣는 카메라 자세가 그 모드의
  // polar·azimuth·distance 범위 안에 하나 이상 있다. Field 전체가 프레임에
  // 들어올 필요는 없다. 못 가는 곳이 있으면 "길을 잃지 않는다"가 깨진다.
  const target = DEFAULT_TARGET as V3;

  const reachable = (center: V3, mode: CameraMode) => {
    const l = CAMERA_LIMITS[mode];
    const azMin = Number.isFinite(l.minAzimuth) ? l.minAzimuth : -Math.PI;
    const azMax = Number.isFinite(l.maxAzimuth) ? l.maxAzimuth : Math.PI;

    const STEPS = 24;
    for (let i = 0; i <= STEPS; i++) {
      const polar = l.minPolar + ((l.maxPolar - l.minPolar) * i) / STEPS;
      for (let j = 0; j <= STEPS; j++) {
        const az = azMin + ((azMax - azMin) * j) / STEPS;
        for (const d of [l.minDistance, (l.minDistance + l.maxDistance) / 2, l.maxDistance]) {
          const eye: V3 = [
            d * Math.sin(polar) * Math.sin(az),
            d * Math.cos(polar),
            d * Math.sin(polar) * Math.cos(az),
          ];
          const n = projectToNdc(center, eye, target, CAMERA_FOV, PHONE_ASPECT);
          if (n.depth > 0 && Math.abs(n.x) <= 1 && Math.abs(n.y) <= 1) return true;
        }
      }
    }
    return false;
  };

  for (const mode of ["a", "b", "c"] as CameraMode[]) {
    for (const role of ROLE_ORDER) {
      it(`${mode} 모드에서 ${role} 에 도달할 수 있다`, () => {
        expect(reachable(FIELD_CENTERS[role] as V3, mode)).toBe(true);
      });
    }
  }
});
```

import 에 `SELF_POSITION`, `FIELD_CENTERS` 를 추가한다(옛 `NEBULA_CENTERS` import 는 제거).

- [ ] **Step 3: 테스트 실패 확인**

Run: `npx vitest run src/app/lab/relationship-world/_lib/layout.test.ts`
Expected: `"Field 중심이 2~4개 보인다"` 가 FAIL — 현재 `DEFAULT_BASE_Z = 40` 에서는 5개가 전부 보이므로 `expect(5).toBeLessThanOrEqual(4)` 로 떨어진다.

- [ ] **Step 4: 카메라 거리를 되돌린다**

`_lib/camera.ts` 의 `DEFAULT_BASE_Z` 를 `40` → **`26`** 으로 낮추고, `DEFAULT_CAMERA_POSITION` 의 y 를 같은 비율(9.85/40 = 0.2463)로 맞춘다:

```ts
const DEFAULT_BASE_Z = 26;
export const DEFAULT_CAMERA_POSITION: [number, number, number] = [0, 6.4, DEFAULT_BASE_Z];
```

`zoom()` 은 `DEFAULT_BASE_Z` 를 기준으로 하므로 모든 모드 제한이 자동으로 따라 내려간다(A 20.8–31.2, B 15.6–41.6, C 10.4–65).

파일 상단의 긴 주석은 이제 사실이 아니다. **"20/20 · 성운 5/5 가 전부 프러스텀 안에 든다"** 는 문장을 지우고, 새 의도로 바꿔 쓴다:

```
 * 기본 뷰는 월드를 전부 담지 않는다. 나와 인접 Field 2~4개가 크게 보이고,
 * 나머지는 드래그해서 찾아가는 것이 이번 설계의 의도다(설계 문서 6절).
 * 전부 담으려면 거리 41 이 필요한데, 그러면 Field 하나하나가 작아져
 * "성질이 다른 공간"이 보이지 않는다 — 재설계의 목적 자체가 사라진다.
```

- [ ] **Step 5: 테스트 통과 확인과 도달성 튜닝**

Run: `npx vitest run src/app/lab/relationship-world/_lib/layout.test.ts`
Expected: 전부 통과

**도달성 테스트가 실패하면** — 특히 `a` 모드는 azimuth 가 ±35° 로 좁아서 `beside`(월드 방위각 약 −74°)에 못 갈 수 있다. 그 경우 **테스트를 완화하지 말고 `a` 모드의 azimuth 범위를 넓혀라.** "못 가는 곳이 없다"가 상위 규칙이다. 넓힌 값과 이유를 보고서에 남긴다.

- [ ] **Step 6: 전체 검증**

Run: `npm test`
Run: `npm run typecheck`
Run: `npm run lint`
Run: `npm run build`
Expected: 전부 통과

- [ ] **Step 7: 커밋**

```bash
git add src/app/lab/relationship-world
git commit -m "refactor(lab): 성운을 Field 로 개명하고 진입 프레이밍 불변식을 교체한다"
```

---

## Task 2: 셰이더 인프라와 첫 Field — 감싸는 안개

이 태스크가 나머지 네 Field 가 따라갈 등록 패턴을 세운다.

**Files:**
- Create: `src/app/lab/relationship-world/_components/fields/shaders/common.ts`
- Create: `src/app/lab/relationship-world/_components/fields/shaders/materials.ts`
- Create: `src/app/lab/relationship-world/_components/fields/FillVolume.tsx`
- Create: `src/app/lab/relationship-world/_components/fields/FieldRegistry.tsx`
- Modify: `src/app/lab/relationship-world/_components/World.tsx`
- Delete: `src/app/lab/relationship-world/_components/Nebula.tsx`

**Interfaces:**
- Consumes: `FIELD_CENTERS`, `FIELD_EXTENT`, `RelationRole`, `ROLE_ORDER`
- Produces:
  - `FIELD_TINT: Record<RelationRole, string>`
  - `<FieldRegistry role={RelationRole} dimmed={boolean} />`
  - `<FillVolume dimmed={boolean} />`
  - GLSL 조각 `hash3`, `valueNoise`, `fresnel`

- [ ] **Step 1: 공유 GLSL 조각**

`fields/shaders/common.ts`. 픽셀당 루프 없음, 노이즈는 2옥타브까지.

```ts
/** 시드 해시. Math.random 을 안 쓰듯 셰이더도 결정론적이어야 한다. */
export const GLSL_HASH = /* glsl */ `
float hash3(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float valueNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash3(i + vec3(0.0, 0.0, 0.0));
  float n100 = hash3(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash3(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash3(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash3(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash3(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash3(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash3(i + vec3(1.0, 1.0, 1.0));
  return mix(
    mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
    mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
    f.z
  );
}

/** 2옥타브. 더 쌓지 않는다 — 폰에서 픽셀당 비용이 그대로 곱해진다. */
float noise2(vec3 p) {
  return valueNoise(p) * 0.65 + valueNoise(p * 2.03) * 0.35;
}
`;

export const GLSL_FRESNEL = /* glsl */ `
float fresnel(vec3 normalW, vec3 viewDirW, float power) {
  return pow(1.0 - clamp(dot(normalize(normalW), normalize(viewDirW)), 0.0, 1.0), power);
}
`;
```

- [ ] **Step 2: 안개 재료 등록**

`fields/shaders/materials.ts`. `extend` 와 타입 증강을 한 곳에 모은다. R3F 9 는 전역 JSX 가 아니라 `@react-three/fiber` 의 `ThreeElements` 인터페이스를 증강한다.

```ts
import * as THREE from "three";
import { shaderMaterial } from "@react-three/drei";
import { extend, type ThreeElement } from "@react-three/fiber";
import { GLSL_FRESNEL, GLSL_HASH } from "./common";

const VARYINGS = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vViewDirW;
varying vec3 vPosL;
`;

const SHELL_VERTEX = /* glsl */ `
${VARYINGS}
void main() {
  vPosL = position;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vViewDirW = normalize(cameraPosition - worldPos.xyz);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

/** 감싸는 안개: 가장자리만 밝고 안쪽은 비어 보이게 fresnel 로 깎는다. */
const MIST_FRAGMENT = /* glsl */ `
${VARYINGS}
${GLSL_HASH}
${GLSL_FRESNEL}
uniform float uTime;
uniform vec3 uColor;
uniform float uOpacity;

void main() {
  float rim = fresnel(vNormalW, vViewDirW, 2.4);
  float n = noise2(vPosL * 0.55 + vec3(0.0, uTime * 0.05, uTime * 0.03));
  float a = rim * (0.45 + n * 0.55) * uOpacity;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor, a);
}
`;

export const MistMaterial = shaderMaterial(
  { uTime: 0, uColor: new THREE.Color("#d2cec7"), uOpacity: 0.5 },
  SHELL_VERTEX,
  MIST_FRAGMENT,
);

extend({ MistMaterial });

declare module "@react-three/fiber" {
  interface ThreeElements {
    mistMaterial: ThreeElement<typeof MistMaterial>;
  }
}
```

- [ ] **Step 3: 틴트 상수**

`fields/tint.ts`. 다섯 Field 가 전부 여기서 읽는다 — 컴포넌트 하나가 남의 색까지 들고 있으면 안 된다.

```ts
import type { RelationRole } from "../../_data/roles";

// 좁은 대역 안의 색온 차이일 뿐이다. 채도 전부 26% 이하이며 오행을 지시하지 않는다.
// 구분의 부담은 형태가 진다 — 흑백으로 바꿔놓고도 다섯이 구분되어야 한다.
export const FIELD_TINT: Record<RelationRole, string> = {
  fill: "#d2cec7",
  beside: "#c9cdd2",
  express: "#c2cbd6",
  move: "#bac6d6",
  refine: "#b6c2d4",
};
```

- [ ] **Step 4: FillVolume**

`fields/FillVolume.tsx`.

```tsx
"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FIELD_CENTERS, FIELD_EXTENT } from "../../_lib/layout";
import { FIELD_TINT } from "./tint";
import { MistMaterial } from "./shaders/materials";

const SHELLS = [1.0, 1.34, 1.72];

export function FillVolume({ dimmed }: { dimmed: boolean }) {
  const group = useRef<THREE.Group>(null);
  const mats = useRef<Array<InstanceType<typeof MistMaterial> | null>>([]);
  const center = FIELD_CENTERS.fill;
  const extent = FIELD_EXTENT.fill;

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (group.current) {
      // 아주 느린 호흡. 인지되면 안 되고 살아 있다는 느낌만 남긴다.
      group.current.scale.setScalar(1 + Math.sin(t * 0.32) * 0.025);
    }
    const target = dimmed ? 0.14 : 0.5;
    for (const m of mats.current) {
      if (!m) continue;
      m.uniforms.uTime.value = t;
      m.uniforms.uOpacity.value +=
        (target - m.uniforms.uOpacity.value) * Math.min(1, delta * 5);
    }
  });

  return (
    <group ref={group} position={center as unknown as [number, number, number]}>
      {SHELLS.map((s, i) => (
        <mesh key={s}>
          <icosahedronGeometry args={[extent * s, 3]} />
          <mistMaterial
            ref={(m) => {
              mats.current[i] = m;
            }}
            uColor={new THREE.Color(FIELD_TINT.fill)}
            uOpacity={0.5}
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
            blending={THREE.NormalBlending}
          />
        </mesh>
      ))}
    </group>
  );
}
```

- [ ] **Step 5: FieldRegistry**

`fields/FieldRegistry.tsx`. 지금은 `fill` 만 실물이 있고 나머지는 비어 있다. Task 3~6 이 하나씩 채운다.

```tsx
"use client";

import type { RelationRole } from "../../_data/roles";
import { FillVolume } from "./FillVolume";

export function FieldRegistry({
  role,
  dimmed,
}: {
  role: RelationRole;
  dimmed: boolean;
}) {
  switch (role) {
    case "fill":
      return <FillVolume dimmed={dimmed} />;
    // beside / express / move / refine 은 Task 3~6 에서 채운다.
    default:
      return null;
  }
}
```

- [ ] **Step 6: World 교체와 Nebula 삭제**

`_components/World.tsx` 에서 `Nebula` import 와 렌더를 `FieldRegistry` 로 바꾼다:

```tsx
import { FieldRegistry } from "./fields/FieldRegistry";
```

```tsx
{ROLE_ORDER.map((role) => (
  <FieldRegistry key={role} role={role} dimmed={selected !== null && selected.role !== role} />
))}
```

그 다음 파일을 지운다:

```bash
git rm src/app/lab/relationship-world/_components/Nebula.tsx
```

- [ ] **Step 7: 검증**

Run: `npm run typecheck`
Run: `npm run lint`
Run: `npm run build`
Run: `npm test`
Expected: 전부 통과

`mistMaterial` JSX 에서 타입 에러가 나면 `materials.ts` 가 실제로 import 되고 있는지 확인한다 — `extend` 와 `declare module` 은 모듈이 로드돼야 효력이 있다.

- [ ] **Step 8: 커밋**

```bash
git add src/app/lab/relationship-world
git commit -m "feat(lab): 셰이더 인프라를 세우고 감싸는 안개 Field 를 만든다"
```

---

## Task 3: 나란히 서는 사람 — 펼쳐진 층과 평행 흐름

**Files:**
- Modify: `src/app/lab/relationship-world/_components/fields/shaders/materials.ts`
- Create: `src/app/lab/relationship-world/_components/fields/BesideLayers.tsx`
- Modify: `src/app/lab/relationship-world/_components/fields/FieldRegistry.tsx`

**Interfaces:**
- Consumes: `FIELD_TINT`, `FIELD_CENTERS`, `FIELD_EXTENT`, `GLSL_HASH`
- Produces: `<BesideLayers dimmed={boolean} />`, `LayerMaterial`

- [ ] **Step 1: 층 재료 추가**

`materials.ts` 끝에 덧붙인다. 판 위를 한 방향으로 흐르는 streak 이고, 가장자리는 radial 로 지워 사각형 티가 안 나게 한다.

```ts
const LAYER_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const LAYER_FRAGMENT = /* glsl */ `
varying vec2 vUv;
${GLSL_HASH}
uniform float uTime;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uPhase;

void main() {
  // 한 방향으로만 흐른다 — '나란히'가 움직임으로 읽혀야 한다.
  float flow = fract(vUv.x * 2.6 - uTime * 0.06 + uPhase);
  float streak = smoothstep(0.5, 0.0, abs(flow - 0.5) * 2.0);
  float grain = noise2(vec3(vUv * 6.0, uPhase));

  // 사각형 경계를 지운다.
  vec2 d = (vUv - 0.5) * 2.0;
  float edge = smoothstep(1.0, 0.15, length(d));

  float a = streak * edge * (0.35 + grain * 0.65) * uOpacity;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor, a);
}
`;

export const LayerMaterial = shaderMaterial(
  { uTime: 0, uColor: new THREE.Color("#c9cdd2"), uOpacity: 0.42, uPhase: 0 },
  LAYER_VERTEX,
  LAYER_FRAGMENT,
);

extend({ LayerMaterial });

declare module "@react-three/fiber" {
  interface ThreeElements {
    layerMaterial: ThreeElement<typeof LayerMaterial>;
  }
}
```

- [ ] **Step 2: BesideLayers**

`fields/BesideLayers.tsx`. 판은 **4장**이다. 오버드로 제한(Global Constraints) 때문에 늘리지 않는다.

```tsx
"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FIELD_CENTERS, FIELD_EXTENT } from "../../_lib/layout";
import { FIELD_TINT } from "./tint";
import { LayerMaterial } from "./shaders/materials";

const LAYERS = [-0.72, -0.24, 0.24, 0.72];

export function BesideLayers({ dimmed }: { dimmed: boolean }) {
  const mats = useRef<Array<InstanceType<typeof LayerMaterial> | null>>([]);
  const center = FIELD_CENTERS.beside;
  const extent = FIELD_EXTENT.beside;
  const size = extent * 2.6;

  useFrame((state, delta) => {
    const target = dimmed ? 0.12 : 0.42;
    for (const m of mats.current) {
      if (!m) continue;
      m.uniforms.uTime.value = state.clock.elapsedTime;
      m.uniforms.uOpacity.value +=
        (target - m.uniforms.uOpacity.value) * Math.min(1, delta * 5);
    }
  });

  return (
    // 살짝 기울여 둔다. 정확히 수평이면 카메라가 지면 근처로 올 때 사라진다.
    <group position={center as unknown as [number, number, number]} rotation={[0, 0, 0.16]}>
      {LAYERS.map((y, i) => (
        <mesh key={y} position={[0, y * extent, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[size, size * 0.62]} />
          <layerMaterial
            ref={(m) => {
              mats.current[i] = m;
            }}
            uColor={new THREE.Color(FIELD_TINT.beside)}
            uOpacity={0.42}
            uPhase={i * 0.27}
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
            blending={THREE.NormalBlending}
          />
        </mesh>
      ))}
    </group>
  );
}
```

- [ ] **Step 3: 등록**

`FieldRegistry.tsx` 에 `case "beside": return <BesideLayers dimmed={dimmed} />;` 를 더하고 import 를 추가한다.

- [ ] **Step 4: 검증**

Run: `npm run typecheck`
Run: `npm run lint`
Run: `npm run build`
Expected: 전부 통과

- [ ] **Step 5: 커밋**

```bash
git add src/app/lab/relationship-world
git commit -m "feat(lab): 나란히 서는 사람을 평행 층과 한 방향 흐름으로 표현한다"
```

---

## Task 4: 나를 표현하게 하는 사람 — 바깥으로 퍼지는 광선

**Files:**
- Modify: `src/app/lab/relationship-world/_components/fields/shaders/materials.ts`
- Create: `src/app/lab/relationship-world/_components/fields/ExpressRays.tsx`
- Modify: `src/app/lab/relationship-world/_components/fields/FieldRegistry.tsx`

**Interfaces:**
- Consumes: `FIELD_TINT`, `FIELD_CENTERS`, `FIELD_EXTENT`, `GLSL_HASH`
- Produces: `<ExpressRays dimmed={boolean} />`, `RayMaterial`

- [ ] **Step 1: 광선 재료 추가**

`materials.ts` 끝에 덧붙인다. 안쪽이 밝고 바깥으로 갈수록 사라진다 — "퍼져 나감"이 방향으로 읽혀야 한다.

```ts
const RAY_FRAGMENT = /* glsl */ `
varying vec2 vUv;
${GLSL_HASH}
uniform float uTime;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uPhase;

void main() {
  // vUv.y = 0 이 코어, 1 이 바깥 끝이다.
  float outward = smoothstep(1.0, 0.05, vUv.y);
  // 폭 방향은 가운데만 남긴다.
  float across = smoothstep(0.5, 0.0, abs(vUv.x - 0.5) * 2.0);
  float pulse = 0.65 + 0.35 * sin(uTime * 0.8 + uPhase + vUv.y * 3.0);
  float grain = noise2(vec3(vUv * 4.0, uPhase));

  float a = outward * across * pulse * (0.4 + grain * 0.6) * uOpacity;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor, a);
}
`;

export const RayMaterial = shaderMaterial(
  { uTime: 0, uColor: new THREE.Color("#c2cbd6"), uOpacity: 0.5, uPhase: 0 },
  LAYER_VERTEX,
  RAY_FRAGMENT,
);

extend({ RayMaterial });

declare module "@react-three/fiber" {
  interface ThreeElements {
    rayMaterial: ThreeElement<typeof RayMaterial>;
  }
}
```

`LAYER_VERTEX` 를 재사용한다 — 둘 다 uv 만 넘기면 된다.

- [ ] **Step 2: ExpressRays**

`fields/ExpressRays.tsx`. 광선 **9줄**. additive 라 겹치면 밝아지므로 장수를 늘리지 않는다.

```tsx
"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FIELD_CENTERS, FIELD_EXTENT, hash01 } from "../../_lib/layout";
import { FIELD_TINT } from "./tint";
import { RayMaterial } from "./shaders/materials";

const RAY_COUNT = 9;

export function ExpressRays({ dimmed }: { dimmed: boolean }) {
  const group = useRef<THREE.Group>(null);
  const mats = useRef<Array<InstanceType<typeof RayMaterial> | null>>([]);
  const center = FIELD_CENTERS.express;
  const extent = FIELD_EXTENT.express;

  // 방향은 시드로 고정한다. 렌더마다 광선이 흔들리면 안 된다.
  const rays = useMemo(
    () =>
      Array.from({ length: RAY_COUNT }, (_, i) => {
        const u = hash01(i * 3 + 11) * 2 - 1;
        const theta = hash01(i * 3 + 12) * Math.PI * 2;
        const len = extent * (1.5 + hash01(i * 3 + 13) * 1.3);
        const dir = new THREE.Vector3(
          Math.sqrt(1 - u * u) * Math.cos(theta),
          u,
          Math.sqrt(1 - u * u) * Math.sin(theta),
        );
        // 판의 +Y 가 dir 을 향하게 회전시킨다.
        const quat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          dir,
        );
        return { len, quat, phase: hash01(i + 71) * 6.28 };
      }),
    [extent],
  );

  useFrame((state, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.02;
    const target = dimmed ? 0.14 : 0.5;
    for (const m of mats.current) {
      if (!m) continue;
      m.uniforms.uTime.value = state.clock.elapsedTime;
      m.uniforms.uOpacity.value +=
        (target - m.uniforms.uOpacity.value) * Math.min(1, delta * 5);
    }
  });

  return (
    <group ref={group} position={center as unknown as [number, number, number]}>
      {rays.map((r, i) => (
        // 바깥쪽 group 이 방향을 잡고, 안쪽 group 이 판을 길이의 절반만큼 밀어
        // 판의 아래 끝이 코어에 오게 한다. 지오메트리를 직접 translate 하지
        // 않으므로 광선마다 별도 지오메트리를 만들 필요도, 버릴 필요도 없다.
        <group key={i} quaternion={r.quat}>
          <group position={[0, r.len / 2, 0]}>
            <mesh>
              <planeGeometry args={[extent * 0.42, r.len]} />
              <rayMaterial
                ref={(m) => {
                  mats.current[i] = m;
                }}
                uColor={new THREE.Color(FIELD_TINT.express)}
                uOpacity={0.5}
                uPhase={r.phase}
                transparent
                depthWrite={false}
                side={THREE.DoubleSide}
                blending={THREE.AdditiveBlending}
              />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}
```

`planeGeometry` 의 uv 는 아래(`vUv.y = 0`)가 코어 쪽이다 — 프래그먼트의 `outward` 가 그 전제로 쓰였다.

- [ ] **Step 3: 등록**

`FieldRegistry.tsx` 에 `case "express": return <ExpressRays dimmed={dimmed} />;` 를 더한다.

- [ ] **Step 4: 검증**

Run: `npm run typecheck`
Run: `npm run lint`
Run: `npm run build`
Expected: 전부 통과

- [ ] **Step 5: 커밋**

```bash
git add src/app/lab/relationship-world
git commit -m "feat(lab): 나를 표현하게 하는 사람을 바깥으로 퍼지는 광선으로 표현한다"
```

---

## Task 5: 나를 움직이게 하는 사람 — 흐르는 리본

**Files:**
- Modify: `src/app/lab/relationship-world/_components/fields/shaders/materials.ts`
- Create: `src/app/lab/relationship-world/_components/fields/MoveRibbons.tsx`
- Modify: `src/app/lab/relationship-world/_components/fields/FieldRegistry.tsx`

**Interfaces:**
- Consumes: `FIELD_TINT`, `FIELD_CENTERS`, `FIELD_EXTENT`, `hash01`
- Produces: `<MoveRibbons dimmed={boolean} />`, `RibbonMaterial`

- [ ] **Step 1: 리본 재료 추가**

`materials.ts` 끝에 덧붙인다. 튜브의 uv.x 가 길이 방향이다.

```ts
const RIBBON_FRAGMENT = /* glsl */ `
varying vec2 vUv;
uniform float uTime;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uPhase;

void main() {
  // 길이를 따라 계속 흘러간다 — 멈추면 '움직이게 한다'가 죽는다.
  float head = fract(vUv.x * 1.4 - uTime * 0.13 + uPhase);
  float flow = smoothstep(0.42, 0.0, abs(head - 0.5));
  // 양 끝은 부드럽게 사라지게 해서 잘린 튜브로 안 보이게 한다.
  float ends = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);
  float a = (0.22 + flow * 0.78) * ends * uOpacity;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor, a);
}
`;

// LAYER_VERTEX 는 Task 3 에서 이미 이 파일에 정의돼 있다(uv 만 넘기는 최소 정점
// 셰이더). 튜브도 uv 만 있으면 되므로 그대로 재사용한다 — 새로 만들지 말 것.
export const RibbonMaterial = shaderMaterial(
  { uTime: 0, uColor: new THREE.Color("#bac6d6"), uOpacity: 0.55, uPhase: 0 },
  LAYER_VERTEX,
  RIBBON_FRAGMENT,
);

extend({ RibbonMaterial });

declare module "@react-three/fiber" {
  interface ThreeElements {
    ribbonMaterial: ThreeElement<typeof RibbonMaterial>;
  }
}
```

- [ ] **Step 2: MoveRibbons**

`fields/MoveRibbons.tsx`. 리본 **3가닥**.

```tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FIELD_CENTERS, FIELD_EXTENT, hash01 } from "../../_lib/layout";
import { FIELD_TINT } from "./tint";
import { RibbonMaterial } from "./shaders/materials";

const RIBBON_COUNT = 3;

export function MoveRibbons({ dimmed }: { dimmed: boolean }) {
  const mats = useRef<Array<InstanceType<typeof RibbonMaterial> | null>>([]);
  const center = FIELD_CENTERS.move;
  const extent = FIELD_EXTENT.move;

  const geometries = useMemo(
    () =>
      Array.from({ length: RIBBON_COUNT }, (_, i) => {
        const pts = Array.from({ length: 6 }, (_, k) => {
          const s = i * 40 + k * 5;
          const t = k / 5;
          return new THREE.Vector3(
            (hash01(s + 1) * 2 - 1) * extent * 1.5,
            (t - 0.5) * extent * 2.2 + (hash01(s + 2) - 0.5) * extent * 0.5,
            (hash01(s + 3) * 2 - 1) * extent * 1.5,
          );
        });
        const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.6);
        return new THREE.TubeGeometry(curve, 64, extent * 0.055, 8, false);
      }),
    [extent],
  );

  useEffect(() => {
    return () => geometries.forEach((g) => g.dispose());
  }, [geometries]);

  useFrame((state, delta) => {
    const target = dimmed ? 0.16 : 0.55;
    for (const m of mats.current) {
      if (!m) continue;
      m.uniforms.uTime.value = state.clock.elapsedTime;
      m.uniforms.uOpacity.value +=
        (target - m.uniforms.uOpacity.value) * Math.min(1, delta * 5);
    }
  });

  return (
    <group position={center as unknown as [number, number, number]}>
      {geometries.map((geo, i) => (
        <mesh key={i} geometry={geo}>
          <ribbonMaterial
            ref={(m) => {
              mats.current[i] = m;
            }}
            uColor={new THREE.Color(FIELD_TINT.move)}
            uOpacity={0.55}
            uPhase={i * 0.4}
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}
```

- [ ] **Step 3: 등록**

`FieldRegistry.tsx` 에 `case "move": return <MoveRibbons dimmed={dimmed} />;` 를 더한다.

- [ ] **Step 4: 검증**

Run: `npm run typecheck`
Run: `npm run lint`
Run: `npm run build`
Expected: 전부 통과

- [ ] **Step 5: 커밋**

```bash
git add src/app/lab/relationship-world
git commit -m "feat(lab): 나를 움직이게 하는 사람을 흐르는 리본으로 표현한다"
```

---

## Task 6: 나를 다듬는 사람 — 정돈된 결정

나머지 넷이 전부 유기적이라, 하나만 규칙적으로 놓이면 "정돈됨"이 색이나 라벨 없이 형태만으로 읽힌다. **격자 배치가 이 Field 의 핵심이다 — 랜덤으로 흩뿌리면 이 태스크는 실패다.**

**Files:**
- Modify: `src/app/lab/relationship-world/_components/fields/shaders/materials.ts`
- Create: `src/app/lab/relationship-world/_components/fields/RefineShards.tsx`
- Modify: `src/app/lab/relationship-world/_components/fields/FieldRegistry.tsx`

**Interfaces:**
- Consumes: `FIELD_TINT`, `FIELD_CENTERS`, `FIELD_EXTENT`, `hash01`, `GLSL_FRESNEL`
- Produces: `<RefineShards dimmed={boolean} />`, `ShardMaterial`

- [ ] **Step 1: 결정 재료 추가**

`materials.ts` 끝에 덧붙인다. 면은 어둡고 모서리만 밝다 — 각진 느낌이 실루엣으로 살아야 한다.

```ts
const SHARD_FRAGMENT = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vViewDirW;
varying vec3 vPosL;
${GLSL_FRESNEL}
uniform float uTime;
uniform vec3 uColor;
uniform float uOpacity;

void main() {
  float rim = fresnel(vNormalW, vViewDirW, 3.2);
  float facet = 0.16 + 0.84 * rim;
  float a = facet * uOpacity;
  if (a < 0.004) discard;
  gl_FragColor = vec4(uColor, a);
}
`;

export const ShardMaterial = shaderMaterial(
  { uTime: 0, uColor: new THREE.Color("#b6c2d4"), uOpacity: 0.72 },
  SHELL_VERTEX,
  SHARD_FRAGMENT,
);

extend({ ShardMaterial });

declare module "@react-three/fiber" {
  interface ThreeElements {
    shardMaterial: ThreeElement<typeof ShardMaterial>;
  }
}
```

`SHELL_VERTEX` 를 재사용한다 — fresnel 에 법선과 시선이 필요하고, 그건 안개 정점 셰이더가 이미 넘긴다.

- [ ] **Step 2: RefineShards**

`fields/RefineShards.tsx`. **3×3×3 격자에서 중심을 뺀 26개**를 놓는다. 지터는 격자 간격의 8% 이내로만 준다 — 규칙성이 보여야 한다.

```tsx
"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FIELD_CENTERS, FIELD_EXTENT, hash01 } from "../../_lib/layout";
import { FIELD_TINT } from "./tint";
import { ShardMaterial } from "./shaders/materials";

export function RefineShards({ dimmed }: { dimmed: boolean }) {
  const group = useRef<THREE.Group>(null);
  const mats = useRef<Array<InstanceType<typeof ShardMaterial> | null>>([]);
  const center = FIELD_CENTERS.refine;
  const extent = FIELD_EXTENT.refine;

  // 격자다. 랜덤 배치로는 '정돈됨'이 읽히지 않는다.
  const shards = useMemo(() => {
    const step = extent * 0.85;
    const out: { pos: [number, number, number]; scale: number; spin: number }[] = [];
    let n = 0;
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          if (x === 0 && y === 0 && z === 0) continue;
          const j = extent * 0.068;
          out.push({
            pos: [
              x * step + (hash01(n * 3 + 1) - 0.5) * j,
              y * step * 0.8 + (hash01(n * 3 + 2) - 0.5) * j,
              z * step + (hash01(n * 3 + 3) - 0.5) * j,
            ],
            scale: extent * (0.13 + hash01(n + 17) * 0.1),
            spin: 0.05 + hash01(n + 41) * 0.09,
          });
          n++;
        }
      }
    }
    return out;
  }, [extent]);

  useFrame((state, delta) => {
    if (group.current) {
      group.current.children.forEach((c, i) => {
        c.rotation.y += delta * shards[i].spin;
        c.rotation.x += delta * shards[i].spin * 0.4;
      });
    }
    // 26개가 각자 재료 인스턴스를 갖는다. 하나만 잡으면 나머지 25개는
    // 영원히 안 흐려진다 — 배열로 전부 잡아 돌린다(다른 Field 와 같은 패턴).
    const target = dimmed ? 0.2 : 0.72;
    for (const m of mats.current) {
      if (!m) continue;
      m.uniforms.uTime.value = state.clock.elapsedTime;
      m.uniforms.uOpacity.value +=
        (target - m.uniforms.uOpacity.value) * Math.min(1, delta * 5);
    }
  });

  return (
    <group ref={group} position={center as unknown as [number, number, number]}>
      {shards.map((s, i) => (
        <mesh key={i} position={s.pos} scale={s.scale}>
          <octahedronGeometry args={[1, 0]} />
          <shardMaterial
            ref={(m) => {
              mats.current[i] = m;
            }}
            uColor={new THREE.Color(FIELD_TINT.refine)}
            uOpacity={0.72}
            transparent
            depthWrite={false}
            blending={THREE.NormalBlending}
          />
        </mesh>
      ))}
    </group>
  );
}
```

- [ ] **Step 3: 등록**

`FieldRegistry.tsx` 에 `case "refine": return <RefineShards dimmed={dimmed} />;` 를 더한다. 이제 `default: return null` 은 도달 불가가 되므로 지우고, `switch` 가 모든 `RelationRole` 을 덮게 한다.

- [ ] **Step 4: 검증**

Run: `npm run typecheck`
Run: `npm run lint`
Run: `npm run build`
Run: `npm test`
Expected: 전부 통과

- [ ] **Step 5: 커밋**

```bash
git add src/app/lab/relationship-world
git commit -m "feat(lab): 나를 다듬는 사람을 격자로 정돈된 결정으로 표현한다"
```

---

## Task 7: 파티클 강등

지금 화면이 "은하 클러스터"로 보이는 직접적 원인이 파티클 과다다. Field 본체가 생겼으니 파티클은 보조로 내린다.

**Files:**
- Create: `src/app/lab/relationship-world/_components/fields/FieldAccents.tsx`
- Modify: `src/app/lab/relationship-world/_components/fields/FieldRegistry.tsx`
- Modify: `src/app/lab/relationship-world/_components/Starfield.tsx`

**Interfaces:**
- Consumes: `FIELD_CENTERS`, `FIELD_EXTENT`, `hash01`, `FIELD_TINT`
- Produces: `<FieldAccents role={RelationRole} dimmed={boolean} />`

- [ ] **Step 1: FieldAccents**

`fields/FieldAccents.tsx`. Field 당 **140개**. 부피를 채우지 않고 **바깥 껍질 근처에만** 둔다 — 경계를 암시하는 게 목적이다.

```tsx
"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { RelationRole } from "../../_data/roles";
import { FIELD_CENTERS, FIELD_EXTENT, hash01 } from "../../_lib/layout";
import { FIELD_TINT } from "./tint";

const ACCENT_COUNT = 140;

export function FieldAccents({ role, dimmed }: { role: RelationRole; dimmed: boolean }) {
  const mat = useRef<THREE.PointsMaterial>(null);
  const center = FIELD_CENTERS[role];
  const extent = FIELD_EXTENT[role];

  const positions = useMemo(() => {
    const arr = new Float32Array(ACCENT_COUNT * 3);
    const seed = role.length * 137;
    for (let i = 0; i < ACCENT_COUNT; i++) {
      const s = seed + i * 3;
      const u = hash01(s + 1) * 2 - 1;
      const theta = hash01(s + 2) * Math.PI * 2;
      // 껍질 근처(0.82~1.15)에만. 안을 채우면 다시 성운이 된다.
      const r = extent * (0.82 + hash01(s + 3) * 0.33);
      const flat = Math.sqrt(1 - u * u);
      arr[i * 3] = r * flat * Math.cos(theta);
      arr[i * 3 + 1] = r * u * 0.8;
      arr[i * 3 + 2] = r * flat * Math.sin(theta);
    }
    return arr;
  }, [role, extent]);

  useFrame((_, delta) => {
    if (!mat.current) return;
    const target = dimmed ? 0.08 : 0.34;
    mat.current.opacity += (target - mat.current.opacity) * Math.min(1, delta * 5);
  });

  return (
    <points position={center as unknown as [number, number, number]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={mat}
        size={0.09}
        color={FIELD_TINT[role]}
        transparent
        opacity={0.34}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}
```

- [ ] **Step 2: Registry 에 붙인다**

`FieldRegistry.tsx` 가 Field 본체와 악센트를 함께 렌더하도록 바꾼다:

```tsx
return (
  <group>
    {body}
    <FieldAccents role={role} dimmed={dimmed} />
  </group>
);
```

`body` 는 기존 `switch` 결과다.

- [ ] **Step 3: 별먼지 밀도 하향**

`Starfield.tsx` 의 `DustLayer` 세 줄에서 `count` 를 절반 이하로 내린다. 현재 900 / 420 / 160 → **420 / 200 / 80**. `radius`·`size`·`seed` 는 건드리지 않는다.

별은 배경이지 내용이 아니다.

- [ ] **Step 4: 검증**

Run: `npm run typecheck`
Run: `npm run lint`
Run: `npm run build`
Expected: 전부 통과

총 파티클: 이전 4,620(Field) + 1,480(별) = 6,100 → 이후 700(Field) + 700(별) = 1,400. 보고서에 이 수치를 적는다.

- [ ] **Step 5: 커밋**

```bash
git add src/app/lab/relationship-world
git commit -m "feat(lab): 파티클을 경계 암시용 보조 요소로 강등한다"
```

---

## Task 8: 사람에게 3D 앵커를 준다

지금 사람은 DOM 명패뿐이라 3D 상의 실체가 없다. 그래서 카메라를 돌려도 앞뒤가 느껴지지 않는다. 깊이는 3D 노드가, 가독성은 DOM 이 맡도록 분리한다.

**Files:**
- Create: `src/app/lab/relationship-world/_components/PersonNode.tsx`
- Modify: `src/app/lab/relationship-world/_components/PersonMarker.tsx`

**Interfaces:**
- Consumes: `Vec3`
- Produces: `<PersonNode position={Vec3} selected={boolean} dimmed={boolean} />`

- [ ] **Step 1: PersonNode**

`_components/PersonNode.tsx`. 작은 발광 구 + 아주 얇은 후광. Field 지오메트리에 가려져야 깊이가 읽히므로 **`depthWrite` 를 끄지 않는다**(코어만은 깊이에 참여한다).

```tsx
"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Vec3 } from "../_lib/layout";

export function PersonNode({
  position,
  selected,
  dimmed,
}: {
  position: Vec3;
  selected: boolean;
  dimmed: boolean;
}) {
  const halo = useRef<THREE.Mesh>(null);
  const coreMat = useRef<THREE.MeshBasicMaterial>(null);
  const haloMat = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (halo.current) halo.current.scale.setScalar(1 + Math.sin(t * 1.4) * 0.06);
    const core = selected ? 1 : dimmed ? 0.25 : 0.8;
    const ring = selected ? 0.5 : dimmed ? 0.06 : 0.2;
    if (coreMat.current) {
      coreMat.current.opacity += (core - coreMat.current.opacity) * Math.min(1, delta * 6);
    }
    if (haloMat.current) {
      haloMat.current.opacity += (ring - haloMat.current.opacity) * Math.min(1, delta * 6);
    }
  });

  return (
    <group position={position as unknown as [number, number, number]}>
      <mesh>
        <sphereGeometry args={[0.075, 12, 12]} />
        <meshBasicMaterial
          ref={coreMat}
          color={selected ? "#dbeafe" : "#e2e8f0"}
          transparent
          opacity={0.8}
        />
      </mesh>
      <mesh ref={halo}>
        <sphereGeometry args={[0.17, 12, 12]} />
        <meshBasicMaterial
          ref={haloMat}
          color={selected ? "#93c5fd" : "#cbd5e1"}
          transparent
          opacity={0.2}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
```

- [ ] **Step 2: 마커가 노드를 함께 그리게 한다**

`PersonMarker.tsx` 의 반환문 최상위를 `<group>` 으로 감싸고, `<PersonNode>` 와 기존 `<Html>` 을 나란히 둔다. `<Html>` 의 `position` 은 그대로 두되, 이름표가 노드를 가리지 않도록 살짝 위로 올린다:

```tsx
const labelPos: [number, number, number] = [position[0], position[1] + 0.34, position[2]];
```

`<Html position={labelPos} ...>` 로 바꾼다. `import { PersonNode } from "./PersonNode";` 를 추가한다.

- [ ] **Step 3: LOD 경계 재조정**

진입 거리가 41 → 26 으로 줄었으므로 `NEAR`/`FAR` 을 같은 비율(26/40 = 0.65)로 내린다: `35 / 50` → **`23 / 33`**.

`dot` 단계(이름 없음)로 떨어지는 빈도가 낮아지는 방향이 맞다 — 설계 문서 5절이 "이름이 더 명확해야 한다"를 요구한다.

- [ ] **Step 4: 검증**

Run: `npm run typecheck`
Run: `npm run lint`
Run: `npm run build`
Run: `npm test`
Expected: 전부 통과

- [ ] **Step 5: 커밋**

```bash
git add src/app/lab/relationship-world
git commit -m "feat(lab): 사람에게 3D 노드를 주어 앞뒤 깊이가 읽히게 한다"
```

---

## Task 9: Field 성질에 맞춰 사람을 배치한다

지금은 다섯 Field 모두 구면 분포라, 사람이 그 공간에 속해 보이지 않는다. 배치가 Field 형태를 따라야 한다.

**Files:**
- Modify: `src/app/lab/relationship-world/_lib/layout.ts`
- Modify: `src/app/lab/relationship-world/_lib/layout.test.ts`

**Interfaces:**
- Consumes: `FIELD_CENTERS`, `FIELD_EXTENT`, `hash01`
- Produces: `positionFor(role: RelationRole, indexInRole: number): Vec3` (시그니처 불변)

- [ ] **Step 1: 배치 규칙을 Field 별로 나눈다**

`_lib/layout.ts` 의 `positionFor` 를 role 별 분기로 바꾼다. **시그니처는 그대로다 — `feature` 는 여전히 받지 않는다.**

```ts
export function positionFor(role: RelationRole, indexInRole: number): Vec3 {
  const center = FIELD_CENTERS[role];
  const extent = FIELD_EXTENT[role];
  const s = ROLE_SEED[role] + indexInRole * 7;

  // Field 의 형태를 따라 배치한다. 배치가 형태와 따로 놀면
  // 사람이 그 공간에 속해 보이지 않는다.
  let local: [number, number, number];

  switch (role) {
    case "fill": {
      // 감싸는 안개: 껍질 안쪽에 고루
      const u = hash01(s * 3 + 1) * 2 - 1;
      const th = hash01(s * 3 + 2) * Math.PI * 2;
      const r = extent * (0.4 + hash01(s * 3 + 3) * 0.5);
      const flat = Math.sqrt(1 - u * u);
      local = [r * flat * Math.cos(th), r * u * 0.75, r * flat * Math.sin(th)];
      break;
    }
    case "beside": {
      // 평행 층: 층 사이에 앉힌다. y 는 층 위치에 스냅한다.
      const tiers = [-0.72, -0.24, 0.24, 0.72];
      const tier = tiers[indexInRole % tiers.length];
      local = [
        (hash01(s * 3 + 1) * 2 - 1) * extent * 1.15,
        tier * extent,
        (hash01(s * 3 + 2) * 2 - 1) * extent * 0.7,
      ];
      break;
    }
    case "express": {
      // 방사 광선: 코어에서 바깥으로, 거리를 서로 다르게
      const u = hash01(s * 3 + 1) * 2 - 1;
      const th = hash01(s * 3 + 2) * Math.PI * 2;
      const r = extent * (0.75 + (indexInRole / 4) * 1.1);
      const flat = Math.sqrt(1 - u * u);
      local = [r * flat * Math.cos(th), r * u * 0.6, r * flat * Math.sin(th)];
      break;
    }
    case "move": {
      // 흐르는 리본: 흐름 방향(y)을 따라 늘어세운다
      const t = (indexInRole + 0.5) / 3;
      local = [
        (hash01(s * 3 + 1) * 2 - 1) * extent * 1.0,
        (t - 0.5) * extent * 2.0,
        (hash01(s * 3 + 2) * 2 - 1) * extent * 1.0,
      ];
      break;
    }
    case "refine": {
      // 정돈된 결정: 격자 위에 올린다
      const cells: [number, number, number][] = [
        [-1, 0, 1],
        [1, 0, -1],
      ];
      const c = cells[indexInRole % cells.length];
      const step = extent * 0.85;
      local = [c[0] * step, c[1] * step * 0.8, c[2] * step];
      break;
    }
  }

  return [center[0] + local[0], center[1] + local[1], center[2] + local[2]];
}
```

- [ ] **Step 2: 기존 테스트를 돌려 임계값을 확인한다**

Run: `npx vitest run src/app/lab/relationship-world/_lib/layout.test.ts`

`"두 사람이 같은 자리에 겹치지 않는다"`(> 0.35)가 실패하면 **임계값을 낮추지 말고** 해당 Field 의 배치 계수를 벌려라. 이 테스트는 화면이 뭉개지는 것을 막는 장치다.

`feature` 무관 테스트는 반드시 그대로 통과해야 한다 — 실패하면 배치에 `feature` 가 새어든 것이다.

- [ ] **Step 3: 전체 검증**

Run: `npm test`
Run: `npm run typecheck`
Run: `npm run lint`
Run: `npm run build`
Expected: 전부 통과

- [ ] **Step 4: 커밋**

```bash
git add src/app/lab/relationship-world
git commit -m "feat(lab): 사람을 각 Field 의 형태를 따라 배치한다"
```

---

## 마무리: 판단

375px 실기기에서 확인하고 결과를 기록한다. 이 재설계의 산출물은 코드가 아니라 **판단**이다.

- **5개 Field 가 서로 다른 공간으로 느껴지는가** — 재설계의 존재 이유
- **색을 흑백으로 바꿔놓고 봐도 구분되는가** — 형태가 정말 구분을 지고 있는가
- 카메라를 돌렸을 때 각 영역의 깊이와 구조가 다르게 느껴지는가
- 사람 이름과 노드가 명확한가 / 앞뒤 관계가 느껴지는가
- 드래그해서 작은 우주를 둘러보는 재미가 있는가
- **폰에서 부드럽게 도는가** — 버벅이면 "3D 가 별로다"라는 잘못된 결론이 나온다
- 여전히 차트로 보이지 않는가

그리고 1차와 같은 질문이 남는다.

> **"이 화면을 처음 봤을 때 2D 관계 차트보다 확실히 더 매력적이고 기억에 남는가?"**
