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
            className="h-[6px] w-[6px] rounded-full bg-slate-400"
            style={{ animation: `pv-dot 1.2s ease-in-out ${i * 160}ms infinite` }}
          />
        ))}
      </span>
    </div>
  );
}
