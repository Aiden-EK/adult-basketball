CREATE TABLE IF NOT EXISTS game_attendance (
    id BIGSERIAL PRIMARY KEY,
    game_id BIGINT NOT NULL REFERENCES game(id) ON DELETE RESTRICT,
    league_member_id BIGINT NOT NULL REFERENCES league_member(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL CHECK (status IN ('PRESENT', 'ABSENT')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_game_attendance_game_member UNIQUE (game_id, league_member_id)
);
CREATE INDEX IF NOT EXISTS idx_game_attendance_game_id ON game_attendance(game_id);
