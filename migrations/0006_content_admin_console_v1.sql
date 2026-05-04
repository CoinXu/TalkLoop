ALTER TABLE corpus_scenes
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS updated_by_admin_id bigint REFERENCES admin_users (id);

UPDATE corpus_scenes
SET slug = regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')
WHERE slug IS NULL;

ALTER TABLE corpus_scenes
  ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS corpus_scenes_slug_idx ON corpus_scenes (slug);

ALTER TABLE corpus_scenes
  DROP CONSTRAINT IF EXISTS corpus_scenes_publish_status_check,
  ADD CONSTRAINT corpus_scenes_publish_status_check CHECK (publish_status IN ('draft', 'published', 'unpublished', 'archived'));

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS min_sentence_count integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS max_sentence_count integer NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS needs_revalidation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_by_admin_id bigint REFERENCES admin_users (id);

UPDATE courses
SET slug = regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g')
WHERE slug IS NULL;

ALTER TABLE courses
  ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS courses_scene_slug_idx ON courses (scene_id, slug);

ALTER TABLE courses
  DROP CONSTRAINT IF EXISTS courses_publish_status_check,
  ADD CONSTRAINT courses_publish_status_check CHECK (publish_status IN ('draft', 'published', 'unpublished', 'archived')),
  DROP CONSTRAINT IF EXISTS courses_sentence_count_rule_check,
  ADD CONSTRAINT courses_sentence_count_rule_check CHECK (min_sentence_count > 0 AND max_sentence_count >= min_sentence_count);

ALTER TABLE corpus_sentences
  ADD COLUMN IF NOT EXISTS import_batch_id text,
  ADD COLUMN IF NOT EXISTS updated_by_admin_id bigint REFERENCES admin_users (id);

ALTER TABLE corpus_sentences
  DROP CONSTRAINT IF EXISTS corpus_sentences_publish_status_check,
  ADD CONSTRAINT corpus_sentences_publish_status_check CHECK (publish_status IN ('draft', 'published', 'unpublished', 'archived')),
  DROP CONSTRAINT IF EXISTS corpus_sentences_audio_status_check,
  ADD CONSTRAINT corpus_sentences_audio_status_check CHECK (audio_status IN ('missing', 'ready', 'failed', 'default', 'unreachable'));

CREATE INDEX IF NOT EXISTS corpus_sentences_assignment_idx ON corpus_sentences (scene_id, course_id, sort_order);
CREATE INDEX IF NOT EXISTS corpus_sentences_import_batch_idx ON corpus_sentences (import_batch_id);

CREATE TABLE IF NOT EXISTS content_admin_settings (
  id bigint PRIMARY KEY,
  setting_key text NOT NULL,
  setting_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS content_admin_settings_key_idx ON content_admin_settings (setting_key);

INSERT INTO admin_permissions (permission_key, description, created_at)
VALUES
  ('admin.content.read', 'View content admin console data', now()),
  ('admin.content.write', 'Manage content admin console resources', now()),
  ('admin.content.publish', 'Run publishing validation and change publication status', now())
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO admin_role_permissions (id, admin_role, permission_key, created_at)
SELECT (2000000 + row_number() OVER (ORDER BY permission_key))::bigint, 'super_admin', permission_key, now()
FROM admin_permissions
WHERE permission_key IN ('admin.content.read', 'admin.content.write', 'admin.content.publish')
ON CONFLICT (admin_role, permission_key) DO NOTHING;
