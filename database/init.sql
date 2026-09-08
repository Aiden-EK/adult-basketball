-- 어른이농구 v1.0 초기 데이터베이스 스키마

CREATE TABLE IF NOT EXISTS league (
    id BIGSERIAL PRIMARY KEY,
    year INTEGER NOT NULL CHECK (year >= 2000),
    quarter INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4),
    name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'ACTIVE', 'COMPLETED')),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    winner_team_id BIGINT,
    CONSTRAINT uq_league_year_quarter UNIQUE (year, quarter),
    CONSTRAINT ck_league_dates CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at)
);

CREATE TABLE IF NOT EXISTS team (
    id BIGSERIAL PRIMARY KEY,
    league_id BIGINT NOT NULL REFERENCES league(id) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    CONSTRAINT uq_team_league_name UNIQUE (league_id, name),
    CONSTRAINT uq_team_league_sort_order UNIQUE (league_id, sort_order)
);

ALTER TABLE league DROP CONSTRAINT IF EXISTS fk_league_winner_team;
ALTER TABLE league ADD CONSTRAINT fk_league_winner_team
    FOREIGN KEY (winner_team_id) REFERENCES team(id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS member (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    birth_year INTEGER CHECK (birth_year BETWEEN 1900 AND 2100),
    height INTEGER CHECK (height > 0),
    positions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    grade VARCHAR(20) NOT NULL DEFAULT 'REGULAR' CHECK (grade IN ('REGULAR', 'GUEST')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS league_member (
    id BIGSERIAL PRIMARY KEY,
    league_id BIGINT NOT NULL REFERENCES league(id) ON DELETE RESTRICT,
    member_id BIGINT NOT NULL REFERENCES member(id) ON DELETE RESTRICT,
    team_id BIGINT REFERENCES team(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_league_member_member UNIQUE (league_id, member_id)
);

CREATE TABLE IF NOT EXISTS game_day (
    id BIGSERIAL PRIMARY KEY,
    league_id BIGINT NOT NULL REFERENCES league(id) ON DELETE RESTRICT,
    game_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_game_day_league_date UNIQUE (league_id, game_date)
);

CREATE TABLE IF NOT EXISTS attendance (
    id BIGSERIAL PRIMARY KEY,
    game_day_id BIGINT NOT NULL REFERENCES game_day(id) ON DELETE RESTRICT,
    member_id BIGINT NOT NULL REFERENCES member(id) ON DELETE RESTRICT,
    actual_team_id BIGINT NOT NULL REFERENCES team(id) ON DELETE RESTRICT,
    grade_snapshot VARCHAR(20) NOT NULL CHECK (grade_snapshot IN ('REGULAR', 'GUEST')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_attendance_game_day_member UNIQUE (game_day_id, member_id)
);

CREATE TABLE IF NOT EXISTS game (
    id BIGSERIAL PRIMARY KEY,
    game_day_id BIGINT NOT NULL REFERENCES game_day(id) ON DELETE RESTRICT,
    game_no INTEGER NOT NULL CHECK (game_no > 0),
    team_a_id BIGINT NOT NULL REFERENCES team(id) ON DELETE RESTRICT,
    team_b_id BIGINT NOT NULL REFERENCES team(id) ON DELETE RESTRICT,
    team_a_score INTEGER CHECK (team_a_score >= 0),
    team_b_score INTEGER CHECK (team_b_score >= 0),
    result_type VARCHAR(20) CHECK (result_type IN ('NORMAL', 'TIEBREAK', 'FORFEIT')),
    winner_team_id BIGINT REFERENCES team(id) ON DELETE RESTRICT,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_game_day_game_no UNIQUE (game_day_id, game_no),
    CONSTRAINT ck_game_different_teams CHECK (team_a_id <> team_b_id),
    CONSTRAINT ck_game_winner_is_participant CHECK (winner_team_id IS NULL OR winner_team_id IN (team_a_id, team_b_id))
);
