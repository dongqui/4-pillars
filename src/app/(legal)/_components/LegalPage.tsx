export function LegalPage({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <article>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">최종 개정일: {updatedAt}</p>
      <div className="mt-8 text-[15px] leading-7 text-slate-700 [&_h2]:mt-9 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-slate-900 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1 [&_a]:text-accent [&_a]:underline">
        {children}
      </div>
    </article>
  );
}
