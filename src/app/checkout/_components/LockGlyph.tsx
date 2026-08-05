/**
 * 자물쇠 윤곽. 디자인이 아이콘 대신 위쪽만 둥근 사각형 하나로 그렸다 —
 * 결제 화면에서 이 표시는 장식이라 스크린 리더에는 읽히지 않게 둔다
 * (옆 텍스트가 "안전 결제"라고 이미 말한다).
 */
export function LockGlyph({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block rounded-[2px] rounded-t-[7px] border-[1.5px] ${className}`}
    />
  );
}
