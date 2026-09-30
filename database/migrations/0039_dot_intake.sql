-- Isolated private analysis intake. Original source metadata is distinct from Dot processing provenance.
-- No article/publication/queue references; unknown source rights never enable fulltext collection.
CREATE TABLE dot_deliveries (
  producer text NOT NULL CHECK (producer = 'dot'),
  delivery_id text NOT NULL CHECK (delivery_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$'),
  schema_version text NOT NULL CHECK (schema_version = 'insurhot.dot.v1'),
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
  received_at timestamptz NOT NULL,
  first_seen_at timestamptz NOT NULL,
  item_count integer NOT NULL CHECK (item_count BETWEEN 1 AND 50),
  PRIMARY KEY (producer, delivery_id)
);
CREATE TABLE dot_items (
  producer text NOT NULL CHECK (producer = 'dot'),
  delivery_id text NOT NULL,
  item_id text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  pillars text[] NOT NULL,
  assertion_kind text NOT NULL CHECK (assertion_kind IN ('reported', 'inference')),
  original_sources jsonb NOT NULL CHECK (jsonb_typeof(original_sources) = 'array'),
  dot_observed_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL,
  first_seen_at timestamptz NOT NULL,
  rights_status text NOT NULL DEFAULT 'unknown' CHECK (rights_status = 'unknown'),
  publication_status text NOT NULL DEFAULT 'private' CHECK (publication_status = 'private'),
  evidence_status text NOT NULL DEFAULT 'unverified' CHECK (evidence_status = 'unverified'),
  PRIMARY KEY (producer, delivery_id, item_id),
  FOREIGN KEY (producer, delivery_id) REFERENCES dot_deliveries (producer, delivery_id) ON DELETE CASCADE
);
COMMENT ON COLUMN dot_items.summary IS 'Declared Dot-original summary, never retained original article fulltext';
COMMENT ON COLUMN dot_items.producer IS 'Declared processing provenance; bearer authentication does not certify Dot authorship or factual truth';
