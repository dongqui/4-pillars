import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LegalPage } from "../_components/LegalPage";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = {
  title: "사업자정보 | 프로젝트 사주",
  description: "프로젝트엔 사업자 정보",
};

// 전화번호만 tel 링크다. 루트 레이아웃에서 브라우저 자동 전화번호 인식을 껐기 때문에
// (사업자등록번호를 전화번호로 오인해 하이드레이션을 깼다) 걸어줄 링크는 우리가 건다.
const ROWS: [string, ReactNode][] = [
  ["상호", COMPANY.name],
  ["대표자", COMPANY.ceo],
  ["사업자등록번호", COMPANY.registrationNumber],
  ["주소", COMPANY.address],
  ["개업일", COMPANY.openedOn],
  ["통신판매업 신고번호", COMPANY.mailOrderSalesNumber],
  [
    "전화번호",
    <a key="phone" href={`tel:${COMPANY.phone}`} className="underline underline-offset-2">
      {COMPANY.phone}
    </a>,
  ],
  ["고객문의", COMPANY.contactEmail],
];

export default function BusinessInfoPage() {
  return (
    <LegalPage title="사업자정보" updatedAt="2026-08-18">
      <table className="w-full text-[15px] border-collapse">
        <tbody>
          {ROWS.map(([label, value]) => (
            <tr key={label} className="border-b border-slate-100 align-top">
              <th className="text-left font-medium text-slate-500 py-3 pr-4 w-[140px] whitespace-nowrap">
                {label}
              </th>
              <td className="py-3 text-slate-800">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-6 text-sm text-slate-400">
        사업자등록번호는 국세청 홈택스(www.hometax.go.kr)에서 조회·확인할 수 있습니다.
      </p>
    </LegalPage>
  );
}
