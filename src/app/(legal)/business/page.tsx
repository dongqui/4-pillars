import type { Metadata } from "next";
import { LegalPage } from "../_components/LegalPage";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = {
  title: "사업자정보 | 프로젝트 사주",
  description: "헤일메리랩스 사업자 정보",
};

const ROWS: [string, string][] = [
  ["상호", COMPANY.name],
  ["대표자", COMPANY.ceo],
  ["사업자등록번호", COMPANY.registrationNumber],
  ["주소", COMPANY.address],
  ["개업일", COMPANY.openedOn],
  ["통신판매업 신고번호", COMPANY.mailOrderSalesNumber],
  ["고객문의", COMPANY.contactEmail],
];

export default function BusinessInfoPage() {
  return (
    <LegalPage title="사업자정보" updatedAt="2026-08-12">
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
