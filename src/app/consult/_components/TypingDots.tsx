/**
 * 답을 기다리는 동안의 점 세 개. pro 모델이라 첫 말풍선까지 5~10초 걸리는데,
 * 이게 없으면 화면이 죽은 것처럼 보인다.
 */
export function TypingDots() {
  return (
    <div className="flex justify-start" role="status" aria-label="상담사가 답을 쓰고 있어요">
      <span className="flex items-center gap-1 rounded-[18px] bg-slate-100 px-4 py-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            // opacity-60 은 reduced-motion 이 pv-dot 을 꺼도(animation: none) 점이
            // 안 보이거나 완전 불투명해지지 않고 정지된 세 점으로 보이게 하는 기본값이다.
            // "답을 쓰고 있어요" 의미는 위 role="status" aria-label 이 전달하므로,
            // 이건 시각적인 보정일 뿐이다.
            className="h-[6px] w-[6px] rounded-full bg-slate-400 opacity-60 pv-dot"
            style={{ animationDelay: `${i * 160}ms` }}
          />
        ))}
      </span>
    </div>
  );
}
