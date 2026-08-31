# 마이그레이션

`scripts/migrate.mts` 가 `migrations/*.sql` 을 **파일명 순서로** 실행하고, 적용 여부를
`schema_migrations` 에 파일명으로 기록한다. 파일 하나에 SQL 문장은 하나만 담는다 —
Neon HTTP 드라이버가 한 쿼리에 문장을 여러 개 담는 것을 거부한다.

## 번호가 겹치는 자리

병렬로 개발된 갈래들이 같은 번호를 썼다. 아래 경우 모두 서로 다른 테이블을
건드리므로, 번호가 겹쳐도 파일명 정렬 순서로 실행하면 의존 관계가 어긋나지
않는다.

### 0012–0016

이용권 시스템과 main(궁합·상담)이 병렬로 개발되면서 세 기능이 번호를 나눠 썼다.
0012–0015 는 궁합·상담·이용권 세 갈래가 한 번호를 같이 쓰고, 0016 은 상담·이용권
두 갈래가 겹친다(궁합은 0015 에서 끝났다).

| 번호 | 궁합 쪽 | 상담 쪽 | 이용권 쪽 |
| --- | --- | --- | --- |
| 0012 | `profiles_kind` | `consultations` | `ticket_wallets` |
| 0013 | `matches` | `consultations_user_idx` | `entitlements` |
| 0014 | `matches_unique` | `consultation_messages` | `entitlements_unique` |
| 0015 | `match_sections` | `consultation_messages_idx` | `ticket_entries` |
| 0016 | — | `consultations_ticket_spent` | `ticket_entries_user_idx` |

### 0033

한 해의 흐름(flow) 기능과 main(사주 리포트 정리 · 궁합 v1 키 정리)이 병렬로
개발되며 세 갈래가 0033 을 같이 썼다.

| 번호 | flow 쪽 | main 쪽(사주 리포트) | main 쪽(궁합) |
| --- | --- | --- | --- |
| 0033 | `flows.sql` | `drop_saju_luck_sections.sql` | `match_sections_drop_v1_keys.sql` |

flow 쪽은 자기 안에서 `0033_flows` → `0036_flow_sections` → `0037/0038`(drop) →
`0039`~`0042`(재생성) 순으로 이어지는데, 그 사이에 다른 갈래의 0033 이 끼어도 이
순서는 안 깨진다 — 정렬은 번호가 아니라 파일명 전체 문자열로 하고, 세 갈래가
건드리는 테이블이 서로 겹치지 않기 때문이다.

**이름을 바꾸지 않는다.** `schema_migrations` 가 파일명으로 추적하므로, 위 두
경우(0012–0016, 0033) 어느 쪽이든 개명하면 이미 적용된 마이그레이션이 미적용으로
보여 재실행되거나 추적이 깨진다. **번호가 겹치는 걸 나중에 발견해도 그 자체로
재번호를 매길 이유가 되지 않는다** — 겹침은 병렬 개발의 흔적일 뿐, 겹친 두 파일
모두 이미 적용됐을 수 있다.

**다음 번호는 0045 부터다.**
