import Link from "next/link";
import type { ConsultationEntry } from "../_lib/to-list-entry";

export function ConsultationList({ entries }: { entries: ConsultationEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="py-14 text-center text-[14px] text-gray-500">아직 나눈 이야기가 없어요.</p>
    );
  }

  return (
    <ul className="mt-6 divide-y divide-slate-100">
      {entries.map((e) => (
        <li key={e.id}>
          <Link href={`/consult/${e.id}`} className="block py-4">
            <div className="flex items-baseline gap-3">
              <span className="flex-1 truncate text-[15px] font-bold tracking-[-0.02em]">
                {e.title}
              </span>
              <span className="flex-none text-[12.5px] font-bold text-slate-400">
                {e.progress}
              </span>
            </div>
            {e.preview && (
              <p className="mt-1 truncate text-[13.5px] text-gray-500">{e.preview}</p>
            )}
            <p className="mt-1 text-[12px] text-slate-400">{e.when}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
