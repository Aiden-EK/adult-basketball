DO $$
BEGIN
  IF (SELECT COUNT(*) FROM game_attendance) > 0 THEN
    RAISE EXCEPTION 'game_attendance에 데이터가 있어 자동 전환할 수 없습니다.';
  END IF;
END $$;
DROP TABLE IF EXISTS game_attendance;

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS league_member_id BIGINT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'PRESENT';
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE attendance ALTER COLUMN actual_team_id DROP NOT NULL;
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS uq_attendance_game_day_member;
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
ALTER TABLE attendance ADD CONSTRAINT attendance_status_check CHECK (status IN ('PRESENT', 'ABSENT'));
ALTER TABLE attendance ADD CONSTRAINT fk_attendance_league_member FOREIGN KEY (league_member_id) REFERENCES league_member(id) ON DELETE RESTRICT;
ALTER TABLE attendance ADD CONSTRAINT uq_attendance_game_day_league_member UNIQUE (game_day_id, league_member_id);
CREATE INDEX IF NOT EXISTS idx_attendance_game_day_id ON attendance(game_day_id);
