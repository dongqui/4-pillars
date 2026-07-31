import Link from "next/link";

const SHELL =
  "flex w-full items-center justify-center gap-2.5 rounded-[20px] border-[1.5px] border-dashed bg-white p-[22px] text-[15px] font-semibold";

function Plus() {
  return (
    <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full border-[1.5px] border-current text-[17px] font-normal leading-none">
      +
    </span>
  );
}

export function AddProfileButton({ disabled }: { disabled: boolean }) {
  if (disabled) {
    return (
      <div className={`${SHELL} border-slate-200 text-slate-300`} aria-disabled>
        <Plus />
        새 프로필 추가
      </div>
    );
  }

  return (
    <Link
      href="/funnel?step=name"
      className={`${SHELL} border-slate-300 text-slate-500 hover:border-accent hover:text-accent`}
    >
      <Plus />
      새 프로필 추가
    </Link>
  );
}
