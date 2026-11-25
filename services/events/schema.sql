-- One row per day, event and job. No identifiers, IPs or device data are stored.
CREATE TABLE IF NOT EXISTS counts (
  day TEXT NOT NULL,
  event TEXT NOT NULL,
  job INTEGER NOT NULL DEFAULT -1,
  detail TEXT NOT NULL DEFAULT '',
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, event, job, detail)
);
