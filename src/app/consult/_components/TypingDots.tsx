/**
 * 답을 기다리는 동안의 점 세 개. pro 모델이라 첫 말풍선까지 5~10초 걸리는데,
 * 이게 없으면 화면이 죽은 것처럼 보인다.
 *
 * 상담사 말풍선과 같은 모양(같은 배경·같은 꼬리)이라 답이 도착하면 자리가
 * 흔들리지 않고 그대로 글자로 바뀐다.
 */
export function TypingDots() {
  return (
    <div className="flex justify-start" role="status" aria-label="상담사가 답을 쓰고 있어요">
      <span className="flex items-center gap-[5px] rounded-[18px_18px_18px_6px] bg-slate-100 px-4 py-3.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            // opacity-60 은 reduced-motion 이 pv-dot 을 꺼도(animation: none) 점이
            // 안 보이거나 완전 불투명해지지 않고 정지된 세 점으로 보이게 하는 기본값이다.
            // "답을 쓰고 있어요" 의미는 위 role="status" aria-label 이 전달하므로,
            // 이건 시각적인 보정일 뿐이다.
            className="pv-dot h-1.5 w-1.5 rounded-full bg-slate-500 opacity-60"
            style={{ animationDelay: `${i * 180}ms` }}
          />
        ))}
      </span>
    </div>
  );
}
