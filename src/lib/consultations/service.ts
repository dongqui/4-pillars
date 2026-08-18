// 개설·진행 오케스트레이션. 이 파일이 이용권과 DB 와 LLM 을 동시에 아는
// 유일한 자리다. 셋 중 무엇이 언제 실패하는지가 여기서만 결정된다.

import { DEFAULT_TURN_LIMIT, countCrisis, decideTurn, nextState } from "./budget";
import { runTurn } from "./turn";
import type { ChatTransport } from "./chat-transport";
import type { TicketPort } from "./ticket-port";
import type {
  AppendMessageInput,
  CommitTurnInput,
  ConsultationRow,
  CreateConsultationInput,
  MessageRow,
} from "./store";
import type { CounselorReply } from "./schema";

/** 턴을 다 쓴(또는 닫힌) 상담에 더 말을 걸었을 때 */
export class ConsultationClosedError extends Error {
  constructor() {
    super("이 상담은 이미 마무리됐습니다");
    this.name = "ConsultationClosedError";
  }
}

/** service 가 쓰는 저장소 동작만. 테스트가 통째로 가짜를 넣는다 */
export interface ServiceStore {
  createConsultation(input: CreateConsultationInput): Promise<ConsultationRow>;
  getConsultation(userId: string, id: string): Promise<ConsultationRow | null>;
  listMessages(consultationId: string): Promise<MessageRow[]>;
  appendMessage(input: AppendMessageInput): Promise<MessageRow>;
  commitTurn(input: CommitTurnInput): Promise<ConsultationRow>;
  setTicketSpent(id: string, spent: boolean): Promise<void>;
}

export interface ServiceDeps {
  store: ServiceStore;
  tickets: TicketPort;
  transport: ChatTransport;
  model: string;
}

export interface OpenResult {
  consultation: ConsultationRow;
  reply: CounselorReply;
}

export type AdvanceResult = OpenResult;

/**
 * 상담 개설 + 첫 턴.
 *
 * 순서가 [행 생성 → 차감 → LLM] 인 이유:
 *  - 행이 먼저여야 consultationId 를 멱등키로 넘길 수 있다.
 *  - 차감이 LLM 보다 먼저여야 한다. 뒤로 미루면 차감 실패 시 이미 답을 준
 *    뒤라 되돌릴 수 없다. 반대 방향(차감 후 LLM 실패)은 되돌릴 수 있다.
 */
export async function openConsultation(
  input: { userId: string; profileId: string | null; facts: string; utterance: string },
  deps: ServiceDeps,
): Promise<OpenResult> {
  const consultation = await deps.store.createConsultation({
    userId: input.userId,
    profileId: input.profileId,
    turnLimit: DEFAULT_TURN_LIMIT,
  });

  await deps.tickets.spend(input.userId, consultation.id);
  // 차감이 실제로 성사된 뒤에만 이 행을 "쓸 수 있는 상담"으로 표시한다.
  // spend 가 throw 했으면 이 줄에 닿지 않고, 행은 ticket_spent=false 인 채
  // listConsultations 에서 걸러진다(store.ts) — 공짜 상담이 목록에 뜨지 않는다.
  await deps.store.setTicketSpent(consultation.id, true);

  let result;
  try {
    result = await runTurn(
      {
        facts: input.facts,
        history: [],
        utterance: input.utterance,
        remaining: consultation.turnLimit,
        isLast: consultation.turnLimit === 1,
        first: true,
      },
      { transport: deps.transport, model: deps.model },
    );
  } catch (e) {
    // 되돌리기까지 실패하면 turns_used=0, ticket_spent=true 인 행이 남는다. 그 행이
    // 곧 증거이므로 별도 보상 로직을 두지 않는다 — 사용자는 그 상담을 이용권 없이
    // 재개한다. 반대로 되돌리기가 성사되면 ticket_spent 를 false 로 되돌려, 아무도
    // 값을 치르지 않은 이 행이 재개 가능한 상담으로 남지 않게 한다.
    try {
      await deps.tickets.refund(input.userId, consultation.id);
      await deps.store.setTicketSpent(consultation.id, false);
    } catch (refundError) {
      console.error("[consult] 이용권 되돌리기 실패", consultation.id, refundError);
    }
    throw e;
  }

  const after = await persistTurn(consultation, input.utterance, result, 0, deps);
  return { consultation: after, reply: result.reply };
}

/**
 * 이어지는 턴. 이용권을 다시 쓰지 않는다 — 상담 1건에 1장이다.
 * 없는(또는 남의) 상담이면 null. 턴을 다 썼으면 ConsultationClosedError.
 */
export async function advanceConsultation(
  input: { userId: string; id: string; facts: string; utterance: string },
  deps: ServiceDeps,
): Promise<AdvanceResult | null> {
  const consultation = await deps.store.getConsultation(input.userId, input.id);
  if (!consultation) return null;

  // 이용권이 실제로 쓰이지 않은 행(차감 실패, 또는 LLM 실패 뒤 환불 성공)은 아무도
  // 값을 치르지 않았다. turns_used=0, status='open' 이라 decideTurn 은 통과시키므로
  // 여기서 따로 막는다 — 아니면 이 행이 무료 상담이 된다(설계 §2 의 재개 규칙은
  // ticket_spent=true 인 행에만 해당한다).
  if (!consultation.ticketSpent) throw new ConsultationClosedError();

  const decision = decideTurn(consultation);
  if (decision.kind === "exhausted") throw new ConsultationClosedError();

  const history = await deps.store.listMessages(consultation.id);

  // LLM 을 먼저 부르고 그 다음에 저장한다. 순서를 뒤집으면 호출이 실패했을 때
  // 답 없는 사용자 발화가 이력에 남아, 다음 턴의 프롬프트가 그 유령을 읽는다.
  const result = await runTurn(
    {
      facts: input.facts,
      history,
      utterance: input.utterance,
      remaining: decision.remaining,
      isLast: decision.isLast,
      // turnsUsed=0 인 채로 재개된 상담(첫 턴이 실패해 제목 없이 남은 경우)은
      // 여전히 "첫 턴"이다. 여기를 항상 false 로 두면 그 상담은 제목을 영영
      // 못 받아 목록에 "아직 시작하지 않은 상담"으로 계속 뜬다 — 열 턴을
      // 끝내도 거짓말이 유지된다.
      first: consultation.turnsUsed === 0,
    },
    { transport: deps.transport, model: deps.model },
  );

  const after = await persistTurn(
    consultation,
    input.utterance,
    result,
    countCrisis(history),
    deps,
  );
  return { consultation: after, reply: result.reply };
}

/** 발화·답변을 남기고 턴 수·상태·제목·토큰을 올린다 */
async function persistTurn(
  consultation: ConsultationRow,
  utterance: string,
  result: { reply: CounselorReply; usage: { promptTokens: number; completionTokens: number } },
  crisisSoFar: number,
  deps: ServiceDeps,
): Promise<ConsultationRow> {
  const state = nextState(consultation, { crisis: result.reply.crisis, crisisSoFar });
  const turnNo = consultation.turnsUsed + 1;

  await deps.store.appendMessage({
    consultationId: consultation.id,
    role: "user",
    bubbles: [utterance],
    suggestions: null,
    turnNo,
  });

  await deps.store.appendMessage({
    consultationId: consultation.id,
    role: "counselor",
    bubbles: result.reply.bubbles,
    suggestions: result.reply.suggestions,
    crisis: result.reply.crisis,
    turnNo,
  });

  return deps.store.commitTurn({
    id: consultation.id,
    turnsUsed: state.turnsUsed,
    status: state.status,
    // 첫 턴에만 값이 있다. store 가 COALESCE 로 기존 제목을 지킨다.
    title: result.reply.title ?? null,
    tokensIn: result.usage.promptTokens,
    tokensOut: result.usage.completionTokens,
  });
}
