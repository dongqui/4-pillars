/** 한 해의 흐름 v2 의 **새 진입**만 정한다. 발행된 v2 읽기·pending 완료·failed 재시도는 플래그를 안 본다. */
export const flowReportV2Enabled = () => process.env.FLOW_REPORT_V2_ENABLED === "true";
