interface Props {
  /** 펼쳐져 있으면 위를 가리킨다 — 다시 누르면 접힌다는 신호다. */
  open: boolean;
  /** 감싼 줄의 색을 따르게 하려면 넘긴다. 기본은 두 드롭다운이 같이 쓰는 회색이다. */
  className?: string;
}

/**
 * 드롭다운 버튼 오른쪽 끝의 화살표.
 *
 * 궁합 PersonSelect 안의 지역 함수였다. 프로필 선택(PersonPicker)은 같은 자리를 텍스트
 * 문자 `▾` 로, 11px 로 그리고 있었다 — 같은 모양의 드롭다운인데 화살표만 두 벌이어서
 * 눈에 띄게 작은 쪽이 생겼다. 한쪽만 키우면 원인이 남으므로 하나로 합친다.
 *
 * 크기를 prop 으로 열어 두지 않는다: 두 곳이 같은 크기여야 한다는 것이 이 컴포넌트의
 * 존재 이유다.
 */
export function Chevron({ open, className = "text-slate-400" }: Props) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className={`flex-none transition-transform ${open ? "rotate-180" : ""} ${className}`}
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
