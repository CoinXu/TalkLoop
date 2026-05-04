CREATE TABLE IF NOT EXISTS word_meta (
  id bigint PRIMARY KEY,
  word_id bigint REFERENCES word_entries (id),
  word text NOT NULL,
  normalized_word text NOT NULL,
  source text NOT NULL,
  source_url text,
  license_name text,
  license_url text,
  phonetics jsonb NOT NULL DEFAULT '[]'::jsonb,
  meanings jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  derived_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  import_batch_id text,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS word_meta_source_normalized_word_idx ON word_meta (source, normalized_word);
CREATE INDEX IF NOT EXISTS word_meta_word_id_idx ON word_meta (word_id);
CREATE INDEX IF NOT EXISTS word_meta_import_batch_idx ON word_meta (import_batch_id);
CREATE INDEX IF NOT EXISTS word_meta_word_idx ON word_meta (word);

INSERT INTO admin_permissions (permission_key, description, created_at)
VALUES
  ('admin.word_meta.read', 'View source dictionary metadata for word entries', now()),
  ('admin.word_meta.write', 'Import and apply source dictionary metadata for word entries', now())
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO admin_role_permissions (id, admin_role, permission_key, created_at)
SELECT (3000000 + row_number() OVER (ORDER BY permission_key))::bigint, 'super_admin', permission_key, now()
FROM admin_permissions
WHERE permission_key IN ('admin.word_meta.read', 'admin.word_meta.write')
ON CONFLICT (admin_role, permission_key) DO NOTHING;
