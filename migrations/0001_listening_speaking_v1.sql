CREATE TYPE source_type AS ENUM ('manual_upload', 'bbc_url_import', 'other_url_import');
CREATE TYPE license_status AS ENUM ('unknown', 'internal_review', 'approved', 'restricted', 'rejected');
CREATE TYPE publish_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE sync_status AS ENUM ('not_synced', 'auto_synced', 'manually_reviewed');
CREATE TYPE progress_status AS ENUM ('not_started', 'in_progress', 'completed');
CREATE TYPE learning_step AS ENUM ('listen_original', 'intensive_listening', 'target_shadowing', 'speaking_prompt', 'score_result');
CREATE TYPE score_target_type AS ENUM ('target_sentence', 'speaking_prompt');
CREATE TYPE import_job_status AS ENUM ('pending', 'succeeded', 'failed');

CREATE TABLE users (
  id bigint PRIMARY KEY,
  login_destination text NOT NULL,
  is_internal_tester boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL
);

CREATE UNIQUE INDEX users_login_destination_idx ON users (login_destination);

CREATE TABLE sessions (
  id bigint PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users (id),
  expires_at timestamp NOT NULL,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL
);

CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE content_units (
  id bigint PRIMARY KEY,
  title text NOT NULL,
  expression text NOT NULL,
  expression_meaning text NOT NULL,
  difficulty text NOT NULL,
  scene_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  estimated_minutes integer NOT NULL DEFAULT 5,
  source_type source_type NOT NULL,
  source_url text,
  license_status license_status NOT NULL DEFAULT 'unknown',
  publish_status publish_status NOT NULL DEFAULT 'draft',
  sync_status sync_status NOT NULL DEFAULT 'not_synced',
  published_at timestamp,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL,
  CONSTRAINT content_units_source_url_required CHECK (source_type = 'manual_upload' OR source_url IS NOT NULL),
  CONSTRAINT content_units_estimated_minutes_positive CHECK (estimated_minutes > 0)
);

CREATE UNIQUE INDEX content_units_source_url_idx ON content_units (source_url);
CREATE INDEX content_units_list_idx ON content_units (publish_status, license_status, sync_status);

CREATE TABLE audio_assets (
  id bigint PRIMARY KEY,
  content_unit_id bigint NOT NULL REFERENCES content_units (id),
  url text NOT NULL,
  duration_seconds integer NOT NULL,
  format text NOT NULL,
  uploaded_by text NOT NULL,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL,
  CONSTRAINT audio_assets_duration_positive CHECK (duration_seconds > 0)
);

CREATE INDEX audio_assets_content_unit_idx ON audio_assets (content_unit_id);

CREATE TABLE transcript_segments (
  id bigint PRIMARY KEY,
  content_unit_id bigint NOT NULL REFERENCES content_units (id),
  english_text text NOT NULL,
  chinese_text text,
  speaker text,
  segment_order integer NOT NULL,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL,
  CONSTRAINT transcript_segments_order_nonnegative CHECK (segment_order >= 0)
);

CREATE UNIQUE INDEX transcript_segments_unit_order_idx ON transcript_segments (content_unit_id, segment_order);

CREATE TABLE target_sentences (
  id bigint PRIMARY KEY,
  content_unit_id bigint NOT NULL REFERENCES content_units (id),
  english_text text NOT NULL,
  chinese_prompt text NOT NULL,
  includes_expression boolean NOT NULL,
  transcript_segment_id bigint NOT NULL REFERENCES transcript_segments (id),
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL
);

CREATE INDEX target_sentences_content_unit_idx ON target_sentences (content_unit_id);

CREATE TABLE speaking_prompts (
  id bigint PRIMARY KEY,
  content_unit_id bigint NOT NULL REFERENCES content_units (id),
  chinese_scenario text NOT NULL,
  english_prompt_gap text NOT NULL,
  target_expression text NOT NULL,
  expected_answer text NOT NULL,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL
);

CREATE INDEX speaking_prompts_content_unit_idx ON speaking_prompts (content_unit_id);

CREATE TABLE synced_segments (
  id bigint PRIMARY KEY,
  content_unit_id bigint NOT NULL REFERENCES content_units (id),
  transcript_segment_id bigint NOT NULL REFERENCES transcript_segments (id),
  start_ms integer NOT NULL,
  end_ms integer NOT NULL,
  english_text text NOT NULL,
  chinese_text text,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL,
  CONSTRAINT synced_segments_time_valid CHECK (start_ms >= 0 AND end_ms > start_ms)
);

CREATE INDEX synced_segments_content_unit_idx ON synced_segments (content_unit_id);

CREATE TABLE unit_progress (
  id bigint PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users (id),
  content_unit_id bigint NOT NULL REFERENCES content_units (id),
  current_step learning_step NOT NULL DEFAULT 'listen_original',
  status progress_status NOT NULL DEFAULT 'not_started',
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL
);

CREATE UNIQUE INDEX unit_progress_user_unit_idx ON unit_progress (user_id, content_unit_id);

CREATE TABLE score_records (
  id bigint PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users (id),
  content_unit_id bigint NOT NULL REFERENCES content_units (id),
  score_target_type score_target_type NOT NULL,
  target_id bigint NOT NULL,
  target_text text NOT NULL,
  overall_score integer NOT NULL,
  pronunciation_score integer,
  fluency_score integer,
  completeness_score integer,
  recording_url text NOT NULL,
  provider_payload jsonb,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL,
  CONSTRAINT score_records_overall_range CHECK (overall_score BETWEEN 0 AND 100),
  CONSTRAINT score_records_pronunciation_range CHECK (pronunciation_score IS NULL OR pronunciation_score BETWEEN 0 AND 100),
  CONSTRAINT score_records_fluency_range CHECK (fluency_score IS NULL OR fluency_score BETWEEN 0 AND 100),
  CONSTRAINT score_records_completeness_range CHECK (completeness_score IS NULL OR completeness_score BETWEEN 0 AND 100)
);

CREATE INDEX score_records_user_unit_created_idx ON score_records (user_id, content_unit_id, created_at);
CREATE INDEX score_records_target_idx ON score_records (user_id, score_target_type, target_id);

CREATE TABLE ingestion_jobs (
  id bigint PRIMARY KEY,
  source_url text NOT NULL,
  status import_job_status NOT NULL DEFAULT 'pending',
  failure_reason text,
  imported_content_unit_id bigint REFERENCES content_units (id),
  raw_preview jsonb,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL
);

CREATE INDEX ingestion_jobs_source_url_idx ON ingestion_jobs (source_url);
