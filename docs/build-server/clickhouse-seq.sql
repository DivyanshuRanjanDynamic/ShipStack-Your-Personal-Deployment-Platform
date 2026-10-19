-- Build-server fixes, Step 7: per-line log ordering with `seq`.
--
-- The build-server now publishes one Kafka message per log line, each carrying a per-process,
-- monotonically increasing `seq`. Storing and ordering by `seq` makes one stored row equal one
-- UI line, so a diagnosis evidence line number matches the UI row number.
--
-- Apply this to your ClickHouse database BEFORE deploying the updated api-server consumer
-- (the consumer writes the `seq` column). Do NOT run it against a shared or production database
-- without approval; apply it to a local database first.
--
-- The column defaults to 0, so rows written before this migration (which have no `seq`) keep
-- working and simply sort first by timestamp.

ALTER TABLE default.log_events
    ADD COLUMN IF NOT EXISTS seq UInt64 DEFAULT 0;

-- Reads are ordered in the query, not by the table's sort key (changing the ORDER BY of an
-- existing MergeTree is not a simple ALTER). Both the api-server /logs/:id query and the
-- ai-service log fetch now order by (seq, timestamp):
--
--   SELECT event_id, log, timestamp, seq
--   FROM log_events
--   WHERE deployment_id = {id: String}
--   ORDER BY seq ASC, timestamp ASC;
