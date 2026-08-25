-- v2 개편에서 사라진 섹션 키의 미아 행을 지운다.
--
-- eachSide 는 bond 로, moments 는 conflict 로 흡수됐고 bridge 는 advice 로
-- 스키마가 바뀌었다. isMatchSectionKey 가 모르는 키를 이미 걸러 주므로 이 DELETE 가
-- 없어도 화면은 멀쩡하다 — 쌓이기만 하는 행을 치우는 위생 조치다.
--
-- verdict·chemistry 는 지우지 않는다. version 2 로 올라가 decodeMatchSections 가
-- 옛 행을 missing 으로 잡고 putMatchSections 의 조건부 DO UPDATE 가 덮어쓴다.
DELETE FROM match_sections WHERE section_key IN ('eachSide', 'moments', 'bridge');
