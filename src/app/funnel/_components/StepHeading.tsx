interface Props {
  title: React.ReactNode;
  sub: string;
  /** 부제와 본문 사이 간격. 스텝마다 시안 값이 조금씩 다르다. */
  gap?: string;
}

/**
 * 스텝 제목 + 한 줄 설명. 모바일 시안(25px/14px)과 데스크톱 시안(32px/15px)의
 * 크기를 한 곳에서 맞춘다.
 */
export function StepHeading({ title, sub, gap = "mb-8 md:mb-9" }: Props) {
  return (
    <>
      <h1 className="mb-2 text-[25px] font-bold leading-[1.3] tracking-[-0.02em] md:mb-2.5 md:text-[32px] md:leading-[1.25] md:tracking-[-0.025em]">
        {title}
      </h1>
      <p className={`text-sm text-slate-500 md:text-[15px] ${gap}`}>{sub}</p>
    </>
  );
}
