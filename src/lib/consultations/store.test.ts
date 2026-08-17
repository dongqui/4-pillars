import { describe, it, expect } from "vitest";
import {
  toConsultationRow,
  toMessageRow,
  createConsultation,
  getConsultation,
  listConsultations,
  listMessages,
  appendMessage,
  commitTurn,
  type SqlClient,
} from "./store";

/** 호출된 SQL과 바인딩 값을 기록하는 가짜 클라이언트. 응답은 순서대로 꺼내 쓴다. */
function fakeClient(...responses: Record<string, unknown>[][]) {
  const calls: { sql: string; values: unknown[] }[] = [];
  let i = 0;
  const client: SqlClient = (strings, ...values) => {
    calls.push({ sql: strings.join("?"), values });
    return Promise.resolve(responses[i++] ?? []);
  };
  return { client, calls };
}

const dbConsultation = {
  id: 7,
  user_id: 3,
  profile_id: 12,
  status: "open",
  turns_used: 2,
  turn_limit: 10,
  title: "직장에서의 답답함",
  created_at: "2026-08-17T00:00:00.000Z",
  closed_at: null,
};

const dbMessage = {
  id: 41,
  role: "counselor",
  bubbles: ["첫 마디예요", "두 번째 마디예요"],
  suggestions: ["더 물어볼까요?", "다른 얘기도 해요"],
  crisis: false,
  turn_no: 2,
  created_at: "2026-08-17T00:01:00.000Z",
};

describe("toConsultationRow", () => {
  it("숫자 id 를 문자열로 바꾼다", () => {
    const row = toConsultationRow(dbConsultation);
    expect(row.id).toBe("7");
    expect(row.userId).toBe("3");
    expect(row.profileId).toBe("12");
  });

  it("프로필이 지워진 상담은 profileId 가 null 이다", () => {
    const row = toConsultationRow({ ...dbConsultation, profile_id: null });
    expect(row.profileId).toBeNull();
  });

  it("모르는 status 는 closed 로 본다 — 열린 것으로 잘못 보면 공짜 턴이 열린다", () => {
    const row = toConsultationRow({ ...dbConsultation, status: "weird" });
    expect(row.status).toBe("closed");
  });
});

describe("toMessageRow", () => {
  it("jsonb 배열을 string[] 로 읽는다", () => {
    const row = toMessageRow(dbMessage);
    expect(row.bubbles).toEqual(["첫 마디예요", "두 번째 마디예요"]);
    expect(row.suggestions).toEqual(["더 물어볼까요?", "다른 얘기도 해요"]);
    expect(row.crisis).toBe(false);
  });

  it("드라이버가 jsonb 를 문자열로 주는 경우에도 배열로 읽는다", () => {
    const row = toMessageRow({ ...dbMessage, bubbles: '["하나"]', suggestions: null });
    expect(row.bubbles).toEqual(["하나"]);
    expect(row.suggestions).toBeNull();
  });

  it("배열이 아닌 값이 오면 빈 배열로 떨어뜨린다", () => {
    const row = toMessageRow({ ...dbMessage, bubbles: 42 });
    expect(row.bubbles).toEqual([]);
  });
});

describe("getConsultation", () => {
  it("user_id 로 함께 걸러 남의 상담을 못 읽게 한다", async () => {
    const { client, calls } = fakeClient([dbConsultation]);
    const row = await getConsultation("3", "7", client);
    expect(row?.id).toBe("7");
    expect(calls[0].values).toEqual(["3", "7"]);
    expect(calls[0].sql).toContain("user_id");
  });

  it("없으면 null 이다", async () => {
    const { client } = fakeClient([]);
    expect(await getConsultation("3", "999", client)).toBeNull();
  });
});

describe("listConsultations", () => {
  it("진행 중인 상담을 위로 올리고 마지막 말풍선을 함께 읽는다", async () => {
    const { client, calls } = fakeClient([
      { ...dbConsultation, last_bubbles: ["지금 자리에서 답답한 게…"] },
    ]);
    const rows = await listConsultations("3", client);
    expect(rows[0].lastBubble).toBe("지금 자리에서 답답한 게…");
    expect(calls[0].sql).toContain("status = 'open'");
  });

  it("상담사 답이 아직 없으면 lastBubble 은 null 이다", async () => {
    const { client } = fakeClient([{ ...dbConsultation, last_bubbles: null }]);
    const rows = await listConsultations("3", client);
    expect(rows[0].lastBubble).toBeNull();
  });
});

describe("createConsultation", () => {
  it("만든 행을 돌려준다", async () => {
    const { client, calls } = fakeClient([dbConsultation]);
    const row = await createConsultation(
      { userId: "3", profileId: "12", turnLimit: 10 },
      client,
    );
    expect(row.id).toBe("7");
    expect(calls[0].values).toEqual(["3", "12", 10]);
  });
});

describe("appendMessage", () => {
  it("사용자 발화는 말풍선 하나에 담기고 suggestions 는 null 이다", async () => {
    const { client, calls } = fakeClient([dbMessage]);
    await appendMessage(
      { consultationId: "7", role: "user", bubbles: ["회사가 힘들어요"], turnNo: 3 },
      client,
    );
    expect(calls[0].values[1]).toBe("user");
    expect(calls[0].values[2]).toBe(JSON.stringify(["회사가 힘들어요"]));
    expect(calls[0].values[3]).toBeNull();
  });
});

describe("commitTurn", () => {
  it("턴 수와 토큰을 함께 올리고 상태를 적는다", async () => {
    const { client, calls } = fakeClient([{ ...dbConsultation, turns_used: 3 }]);
    const row = await commitTurn(
      {
        id: "7",
        turnsUsed: 3,
        status: "open",
        title: null,
        tokensIn: 1200,
        tokensOut: 300,
      },
      client,
    );
    expect(row.turnsUsed).toBe(3);
    expect(calls[0].values).toEqual([3, "open", null, 1200, 300, "7"]);
  });

  it("닫는 턴이면 closed_at 을 채운다", async () => {
    const { client, calls } = fakeClient([
      { ...dbConsultation, status: "closed", closed_at: "2026-08-17T00:09:00.000Z" },
    ]);
    const row = await commitTurn(
      { id: "7", turnsUsed: 10, status: "closed", title: null, tokensIn: 1, tokensOut: 1 },
      client,
    );
    expect(row.status).toBe("closed");
    expect(calls[0].sql).toContain("closed_at");
  });
});
