-- 운영 리그 seed 데이터. 스키마(init.sql)와 분리해 관리한다.
INSERT INTO league (year, quarter, name, status)
VALUES
  (2026, 1, '2026년 1분기 리그', 'COMPLETED'),
  (2026, 2, '2026년 2분기 리그', 'COMPLETED'),
  (2026, 3, '2026년 3분기 리그', 'ACTIVE')
ON CONFLICT (year, quarter) DO UPDATE
SET name = EXCLUDED.name,
    status = EXCLUDED.status;
