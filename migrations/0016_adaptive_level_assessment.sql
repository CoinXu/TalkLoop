CREATE TABLE IF NOT EXISTS assessment_sessions (
  id bigint PRIMARY KEY,
  user_id text NOT NULL,
  config_id bigint REFERENCES assessment_configs (id),
  assessment_version text NOT NULL,
  status text NOT NULL DEFAULT 'in_progress',
  current_round int NOT NULL DEFAULT 1,
  current_band text NOT NULL DEFAULT 'L2_MID',
  min_rounds int NOT NULL DEFAULT 5,
  max_rounds int NOT NULL DEFAULT 9,
  questions_per_round int NOT NULL DEFAULT 6,
  pain_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  self_description jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_id bigint REFERENCES user_assessment_results (id),
  started_at timestamp NOT NULL,
  expires_at timestamp NOT NULL,
  completed_at timestamp,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL,
  CONSTRAINT assessment_sessions_status_check
    CHECK (status IN ('in_progress', 'completed', 'expired', 'abandoned'))
);

CREATE INDEX IF NOT EXISTS assessment_sessions_user_status_idx
  ON assessment_sessions (user_id, status, updated_at);

CREATE TABLE IF NOT EXISTS assessment_items (
  id bigint PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES assessment_sessions (id),
  round_index int NOT NULL,
  item_index int NOT NULL,
  word_id bigint NOT NULL REFERENCES word_entries (id),
  word text NOT NULL,
  correct_meaning text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  selected_option text,
  is_correct boolean,
  answered_at timestamp,
  band_key text NOT NULL,
  difficulty_level int,
  lg10wf numeric,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL,
  CONSTRAINT assessment_items_unique_session_item
    UNIQUE (session_id, round_index, item_index),
  CONSTRAINT assessment_items_unique_session_word
    UNIQUE (session_id, word_id)
);

CREATE INDEX IF NOT EXISTS assessment_items_session_round_idx
  ON assessment_items (session_id, round_index, item_index);

CREATE INDEX IF NOT EXISTS assessment_items_word_idx
  ON assessment_items (word_id);
