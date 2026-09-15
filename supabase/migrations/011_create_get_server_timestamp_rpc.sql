-- RPC function: Lấy timestamp từ server PostgreSQL (múi giờ Việt Nam)
-- Trả về JSON object chứa date, time, datetime (ISO), epoch_ms
-- Dùng để chống gian lận giờ client khi chấm công

CREATE OR REPLACE FUNCTION get_server_timestamp()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'date',    (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
    'time',     to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'HH24:MI'),
    'datetime', to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD"T"HH24:MI:SS'),
    'epoch_ms', extract(epoch from now())::bigint * 1000
  );
$$;

-- Grant quyền thực thi cho anonymous role (app dùng anon key) và authenticated
GRANT EXECUTE ON FUNCTION get_server_timestamp() TO anon;
GRANT EXECUTE ON FUNCTION get_server_timestamp() TO authenticated;