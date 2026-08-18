export type CameraMode = "a" | "b" | "c";

const deg = (d: number) => (d * Math.PI) / 180;

/**
 * 수직 fov 다. three 의 fov 는 언제나 수직이라, 가로 화각은 종횡비가 곱해진
 * atan(tan(fov/2)·aspect) 로 줄어든다. 375×812(aspect 0.462)에서 가로 반각은
 * 12.2° 뿐이다 — 이 상수를 키워서 폭을 벌 수는 없다. 필요한 폭을 fov 로만
 * 채우려면 수직 112° 가 필요하고 그 각도는 화면 가장자리를 심하게 왜곡한다.
 * 그래서 폭은 fov 가 아니라 '거리'로 번다(아래 DEFAULT_CAMERA_POSITION).
 */
export const CAMERA_FOV = 50;

/**
 * 이번 설계(구면 앵커 5개 × 소구역 3개, layout.ts)는 기본 뷰에서 다섯 Role
 * 구역과 21명(나 포함) 전원이 375×812 진입 화면 안에 들어오는 것을 목표로
 * 한다 — 직전 설계는 나와 인접 Field 2~4개만 보이고 나머지는 드래그해야
 * 찾을 수 있었고, 그것이 "위치가 아무 정보도 주지 않는다"는 실패로
 * 이어졌다. layout.test.ts 의 "5개 앵커가 전부 화면 안에 있다" 와
 * "20명 전원이 화면 안에 투영된다" 가 이 목표를 잠근다.
 *
 * 방향은 예전 [0, 3.2, 13] 과 완전히 같다(3.2:13 비율 유지). 거리(DEFAULT_BASE_Z)
 * 는 이 폭을 벌기 위해 조정된 값이고, ANCHOR_RADIUS(layout.ts, 7)를 포함해
 * 화면에 다섯 구역이 다 들어오도록 함께 맞춰졌다.
 */
const DEFAULT_BASE_Z = 26;
export const DEFAULT_CAMERA_POSITION: [number, number, number] = [0, 6.4, DEFAULT_BASE_Z];
export const DEFAULT_TARGET: [number, number, number] = [0, 0, 0];

/** 설계 문서 10절의 zoom 배율. 기준 길이만 13 → 26 으로 옮겼다. */
const zoom = (factor: number) => +(DEFAULT_BASE_Z * factor).toFixed(2);

export const CAMERA_LIMITS: Record<
  CameraMode,
  {
    minPolar: number;
    maxPolar: number;
    minAzimuth: number;
    maxAzimuth: number;
    minDistance: number;
    maxDistance: number;
    enablePan: boolean;
  }
> = {
  // A · 제한적
  a: {
    minPolar: deg(60),
    maxPolar: deg(85),
    minAzimuth: deg(-35),
    maxAzimuth: deg(35),
    minDistance: zoom(0.8), // 20.8
    maxDistance: zoom(1.2), // 31.2
    enablePan: false,
  },
  // B · 중간
  b: {
    minPolar: deg(35),
    maxPolar: deg(100),
    minAzimuth: -Infinity,
    maxAzimuth: Infinity,
    minDistance: zoom(0.6), // 15.6
    maxDistance: zoom(1.6), // 41.6
    enablePan: false,
  },
  // C · 자유 + Reset
  c: {
    minPolar: deg(15),
    maxPolar: deg(140),
    minAzimuth: -Infinity,
    maxAzimuth: Infinity,
    minDistance: zoom(0.4), // 10.4
    maxDistance: zoom(2.5), // 65
    enablePan: true,
  },
};

export const CAMERA_MODE_OPTIONS: { value: CameraMode; label: string }[] = [
  { value: "a", label: "A 제한" },
  { value: "b", label: "B 중간" },
  { value: "c", label: "C 자유" },
];

// ---------------------------------------------------------------------------
// 사람을 선택했을 때 CameraRig 가 노리는 초점 뷰. three 를 몰라도 계산되는
// 순수 상수라 여기 두고, layout.test.ts 가 focus view 프레이밍을 잠글 수
// 있게 한다(CameraRig.tsx 는 이 값을 그대로 가져다 쓴다).

// 진입 거리는 |DEFAULT_CAMERA_POSITION − DEFAULT_TARGET| = |(0, 6.4, 26)| =
// 26.776 이다(DEFAULT_BASE_Z 가 40 → 26 으로 내려간 뒤의 값). 설계 10절의 줌
// 배율 1.575 를 지키려면 26.776 / 1.575 = 17.0 이어야 한다.
//
// 예전 값 26.2 는 DEFAULT_BASE_Z 가 40 이던 시절의 41.20 을 기준으로 잡은 것이라,
// 기준이 26 으로 내려간 뒤에는 실제 돌리가 26.776 / 26.2 = **1.022 배** 였다 —
// 사람을 선택해도 카메라가 사실상 다가가지 않았다.
//
// A 모드만 minDistance 가 20.8(zoom(0.8))이라 17.0 이 거기서 클램프된다 →
// A 의 실제 돌리는 1.287 배다. 이건 A 의 줌 제한 자체에서 오는 것이고
// FOCUS_DISTANCE 로는 더 줄일 수 없다.
export const FOCUS_DISTANCE = 17.0;

// 0 = 나, 1 = 상대. 0.70 에서 20명 전원이 프레임 안이다(재측정: 세 모드 모두
// person offscreen 0/20, 최대 |ndc.x| 는 A 0.251 · B·C 0.304 — layout.test.ts
// 의 focus view 테스트가 잠근다). 거리를 26.2 → 17.0 으로 당기면 나와 상대를
// **동시에** 담을 수 있는 폭이 줄어, 375px 세로 화면에서는 원점('나')이 20명
// 중 1명(A) / 5명(B·C) 선택에서 화면 밖으로 나간다(예전 1명). 이건 돌리를
// 되살리는 대가이고, bias 를 낮춰 나를 되찾으려 하면 이번엔 상대가 가로로
// 밀려나 최대 13명까지 화면을 벗어난다(bias 0.50, lift 5.8 에서 B·C 5/20
// 이탈). 판단 대상은 상대이므로 상대를 잡는다.
export const FOCUS_BIAS = 0.7;

// 타깃을 아래로 내리면 피사체가 화면 위쪽에 잡힌다 — 40vh 시트에 가리지 않게.
//
// 거리에 **선형 비례**시키면(6.0 × 17.0/26.2 = 3.89) 상단 1/3 안착이 A 16/20,
// B·C 19/20 로 오히려 나빠진다. ndc.y 는 lift 항 0.971·L/(t·d) 와 사람 자신의
// 오프셋 항 (1−bias)(p·up)/(t·d) 의 합인데, 거리를 당기면 앞의 항만 그대로이고
// 뒤의 항이 1/d 로 **커져** 타깃보다 아래에 있는 사람이 더 아래로 밀리기
// 때문이다. 그래서 선형보다 더 올려야 한다.
//
// 5.2 였다가 4.5 로 내렸다. 소구역이 상태별 세 껍질로 갈리면서(STATE_RADIUS)
// 沖 이 반지름 8.5 로 밀려났고, 5.2 에서는 沖 을 선택할 때 그 사람이 화면
// **위쪽**으로 벗어난다(f10 선우, |ndc.y| 1.038).
//
// 거리를 늘려도 해결되지만(17.0 → 18.0 이면 이탈 0) 그러면 화면 전체가
// 작아진다 — 이 라운드의 요구가 "색이 드러나게"라 노드를 줄이는 방향은
// 반대다. lift 를 내리는 쪽은 공짜였다: 시트 가림이 애초에 binding 이 아니다.
//
// 실측(20명 × 3모드, 375×812): lift 4.5 에서 세 모드 전부 이탈 0/20,
// 최대 |ndc| 0.921(여유 8%), 가장 아래 사람이 261px 로 40vh 시트 상단(487px)
// 보다 226px 위다 — 가린 사람 0/20. 상단 1/3 안착은 A 16/20, B·C 20/20 이다
// (A 는 모드 제한 때문에 거리가 20.8 로 밀려 조금 더 내려온다).
// layout.test.ts 의 focus view 테스트가 이탈 0/20 을 잠근다.
export const FRAME_LIFT = 4.5;
