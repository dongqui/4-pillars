/**
 * 섹션 끝에 붙는 다음 행동 카드. 09(관계 지도)·11(궁합)이 같은 모양을 쓴다.
 *
 * next/link 가 아니라 <a> 인 이유: /map 은 GET 이 지도 행을 만든다(멱등하지만
 * 만들긴 한다). Link 의 프리페치는 그 서버 컴포넌트를 실제로 돌리므로, 누르지도
 * 않은 사용자의 지도가 미리 생긴다.
 */
export function CtaCard({
  title,
  desc,
  label,
  href,
}: {
  title: string;
  desc: string;
  label: string;
  href: string;
}) {
  return (
    <div className="mt-3.5 bg-slate-900 rounded-2xl p-6 flex flex-wrap items-center gap-4">
      <div className="flex-1 min-w-[220px]">
        <div className="text-base font-bold text-white tracking-[-0.01em]">{title}</div>
        <p className="text-[13.5px] text-slate-400 mt-[5px] mb-0 leading-[1.6] break-keep [text-wrap:pretty]">
          {desc}
        </p>
      </div>
      <a
        href={href}
        className="flex-none text-sm font-semibold text-slate-900 bg-white px-5 py-3 rounded-xl hover:bg-slate-100"
      >
        {label}
      </a>
    </div>
  );
}
