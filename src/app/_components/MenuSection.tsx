import Link from "next/link";
import { MENU_ITEMS, TICKET_PRICE_LABEL, type MenuItem } from "../_lib/catalog";

const CARD =
  "flex items-start justify-between gap-4 rounded-[18px] border border-slate-100 bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,.04)] transition-[transform,box-shadow] duration-200";
const HOVER = "hover:-translate-y-[3px] hover:shadow-[0_18px_40px_-20px_rgba(15,23,42,.16)]";
const PILL = "flex-none whitespace-nowrap rounded-full px-3 py-[7px] text-[13px] font-bold";

function Body({ item }: { item: MenuItem }) {
  return (
    <>
      <div>
        <div className="mb-[7px] text-[16.5px] font-bold tracking-[-0.015em]">{item.title}</div>
        <p className="m-0 text-[13.5px] leading-[1.6] text-slate-400 [text-wrap:pretty]">
          {item.desc}
        </p>
      </div>
      <span className={`${PILL} ${item.paid ? "bg-accent-50 text-accent" : "bg-wood-soft text-wood-ink"}`}>
        {item.price}
      </span>
    </>
  );
}

/**
 * 무엇이 무료고 무엇이 이용권 한 장인지 한 화면에 늘어놓는 자리.
 * 항목도 가격도 _lib/catalog.ts 가 결제·이용권 표에서 파생시킨다 — 여기서
 * 문자열로 적으면 가격을 올릴 때 랜딩만 옛값으로 남는다.
 */
export function MenuSection() {
  return (
    <section id="menu" className="mx-auto max-w-[1120px] px-5 py-[clamp(56px,8vw,88px)] md:px-8">
      <div className="text-center">
        <h2 className="mb-3.5 text-[clamp(28px,4vw,46px)] font-bold tracking-[-0.035em] [text-wrap:balance]">
          무료로 시작해서, 하나씩 {TICKET_PRICE_LABEL}
        </h2>
        <p className="mb-[46px] text-[clamp(16px,2vw,18px)] text-slate-400 [text-wrap:pretty]">
          캐릭터는 무료. 구독도 패키지도 없이, 알고 싶은 것만 하나씩 열어보세요.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MENU_ITEMS.map((item) => (
          <Link key={item.title} href={item.href} className={`${CARD} ${HOVER}`}>
            <Body item={item} />
          </Link>
        ))}
      </div>

      <p className="mt-[34px] text-center text-sm text-slate-400">
        열어본 내용은 언제든 다시 보실 수 있어요.
      </p>
    </section>
  );
}
