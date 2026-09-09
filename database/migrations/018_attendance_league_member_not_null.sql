DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM attendance WHERE league_member_id IS NULL) THEN
    RAISE EXCEPTION 'league_member_id가 없는 출석 데이터가 있어 NOT NULL 제약을 적용할 수 없습니다.';
  END IF;
END $$;

ALTER TABLE attendance
  ALTER COLUMN league_member_id SET NOT NULL;
