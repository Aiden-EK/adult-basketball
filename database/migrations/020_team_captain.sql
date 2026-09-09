ALTER TABLE team ADD COLUMN IF NOT EXISTS captain_member_id BIGINT REFERENCES league_member(id) ON DELETE SET NULL;
CREATE OR REPLACE FUNCTION clear_invalid_team_captain() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (OLD.team_id IS DISTINCT FROM NEW.team_id) THEN UPDATE team SET captain_member_id = NULL WHERE captain_member_id = OLD.id; END IF;
  RETURN COALESCE(NEW, OLD);
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_clear_invalid_team_captain ON league_member;
CREATE TRIGGER trg_clear_invalid_team_captain AFTER UPDATE OF team_id OR DELETE ON league_member FOR EACH ROW EXECUTE FUNCTION clear_invalid_team_captain();
