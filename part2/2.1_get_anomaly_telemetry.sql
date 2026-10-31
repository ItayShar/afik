SELECT device_id
FROM device_telemetry_logs
WHERE recorded_at < NOW()
GROUP BY device_id
HAVING
    AVG(CASE
        WHEN recorded_at >= NOW() - INTERVAL 24 HOUR
        THEN voltage * `current`
    END)
    >=
    1.25 * AVG(CASE
        WHEN recorded_at < NOW() - INTERVAL 24 HOUR
        THEN voltage * `current`
    END);