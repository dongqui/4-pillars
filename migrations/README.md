# 마이그레이션

`scripts/migrate.mts` 가 `migrations/*.sql` 을 **파일명 순서로** 실행하고, 적용 여부를
`schema_migrations` 에 파일명으로 기록한다. 파일 하나에 SQL 문장은 하나만 담는다 —
Neon HTTP 드라이버가 한 쿼리에 문장을 여러 개 담는 것을 거부한다.

## 0012–0015 번호가 겹친다

이용권 시스템과 궁합 기능이 병렬로 개발되면서 두 브랜치가 같은 번호를 썼다.

| 번호 | 궁합 쪽 | 이용권 쪽 |
| --- | --- | --- |
| 0012 | `profiles_kind` | `ticket_wallets` |
| 0013 | `matches` | `entitlements` |
| 0014 | `matches_unique` | `entitlements_unique` |
| 0015 | `match_sections` | `ticket_entries` |

**이름을 바꾸지 않는다.** `schema_migrations` 가 파일명으로 추적하므로 개명하면 이미
적용된 마이그레이션이 미적용으로 보여 재실행되거나 추적이 깨진다. 서로 다른 테이블을
건드리므로 파일명 정렬 순서로 실행해도 의존 관계가 어긋나지 않는다.

**다음 번호는 0020 부터다.**
