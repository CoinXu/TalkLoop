CREATE TABLE corpus_scenes (
  id bigint PRIMARY KEY,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  publish_status text NOT NULL DEFAULT 'draft' CHECK (publish_status IN ('draft', 'published', 'archived')),
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL
);

CREATE UNIQUE INDEX corpus_scenes_name_idx ON corpus_scenes (name);
CREATE INDEX corpus_scenes_publish_idx ON corpus_scenes (publish_status, sort_order);

CREATE TABLE courses (
  id bigint PRIMARY KEY,
  scene_id bigint NOT NULL REFERENCES corpus_scenes (id),
  title text NOT NULL,
  description text,
  level integer NOT NULL CHECK (level BETWEEN 1 AND 4),
  sort_order integer NOT NULL DEFAULT 0,
  unlock_policy jsonb NOT NULL DEFAULT '{"type":"previous_course_completed"}'::jsonb,
  publish_status text NOT NULL DEFAULT 'draft' CHECK (publish_status IN ('draft', 'published', 'archived')),
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL
);

CREATE INDEX courses_scene_idx ON courses (scene_id, sort_order);
CREATE INDEX courses_publish_idx ON courses (publish_status, level);

CREATE TABLE corpus_sentences (
  id bigint PRIMARY KEY,
  course_id bigint REFERENCES courses (id),
  scene_id bigint REFERENCES corpus_scenes (id),
  sentence_text text NOT NULL,
  translation_cn text,
  normal_audio_url text,
  slow_audio_url text,
  audio_status text NOT NULL DEFAULT 'missing' CHECK (audio_status IN ('missing', 'ready', 'failed')),
  target_words jsonb NOT NULL DEFAULT '[]'::jsonb,
  bonus_words jsonb NOT NULL DEFAULT '[]'::jsonb,
  phrase_chunks jsonb NOT NULL DEFAULT '[]'::jsonb,
  difficulty_level integer NOT NULL CHECK (difficulty_level BETWEEN 1 AND 4),
  scene_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  review_status text NOT NULL DEFAULT 'pending_review' CHECK (review_status IN ('pending_review', 'approved', 'rejected')),
  publish_status text NOT NULL DEFAULT 'draft' CHECK (publish_status IN ('draft', 'published', 'archived')),
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL
);

CREATE INDEX corpus_sentences_course_idx ON corpus_sentences (course_id, sort_order);
CREATE INDEX corpus_sentences_publish_idx ON corpus_sentences (publish_status, review_status, difficulty_level);

CREATE TABLE annotation_tasks (
  id bigint PRIMARY KEY,
  target_type text NOT NULL CHECK (target_type IN ('word', 'sentence')),
  target_id bigint NOT NULL,
  task_type text NOT NULL CHECK (task_type IN ('hearing_trap', 'distractors', 'target_words', 'phrase_chunks', 'audio')),
  algorithm_version text NOT NULL,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence numeric,
  review_status text NOT NULL DEFAULT 'pending_review' CHECK (review_status IN ('pending_review', 'approved', 'rejected')),
  reviewer_admin_id bigint REFERENCES admin_users (id),
  reviewed_at timestamp,
  rejection_reason text,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL
);

CREATE INDEX annotation_tasks_target_idx ON annotation_tasks (target_type, target_id);
CREATE INDEX annotation_tasks_review_idx ON annotation_tasks (review_status, task_type);

CREATE TABLE assessment_configs (
  id bigint PRIMARY KEY,
  version text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  self_description_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  estimate_matrix jsonb NOT NULL DEFAULT '{}'::jsonb,
  sampling_strategy jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL
);

CREATE UNIQUE INDEX assessment_configs_version_idx ON assessment_configs (version);
CREATE INDEX assessment_configs_status_idx ON assessment_configs (status);

CREATE TABLE user_assessment_results (
  id bigint PRIMARY KEY,
  user_id text NOT NULL,
  config_id bigint REFERENCES assessment_configs (id),
  source text NOT NULL CHECK (source IN ('self_description', 'verification_test')),
  pain_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  vocabulary_estimate integer NOT NULL,
  frequency_boundary jsonb NOT NULL DEFAULT '{}'::jsonb,
  verification_rounds jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL
);

CREATE INDEX user_assessment_results_user_idx ON user_assessment_results (user_id, created_at);

CREATE TABLE user_vocabulary_entries (
  id bigint PRIMARY KEY,
  user_id text NOT NULL,
  word_id bigint NOT NULL REFERENCES word_entries (id),
  activation_status text NOT NULL DEFAULT 'red' CHECK (activation_status IN ('red', 'yellow', 'green')),
  consecutive_correct integer NOT NULL DEFAULT 0,
  total_attempts integer NOT NULL DEFAULT 0,
  total_correct integer NOT NULL DEFAULT 0,
  last_practice_type text,
  next_review_at timestamp,
  srs_interval_days integer NOT NULL DEFAULT 0,
  failure_count integer NOT NULL DEFAULT 0,
  sentence_exposures integer NOT NULL DEFAULT 0,
  spoken_count integer NOT NULL DEFAULT 0,
  weak_pronunciations jsonb NOT NULL DEFAULT '[]'::jsonb,
  skip_count integer NOT NULL DEFAULT 0,
  avoid_until timestamp,
  source text NOT NULL DEFAULT 'assessment',
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL
);

CREATE UNIQUE INDEX user_vocabulary_entries_user_word_idx ON user_vocabulary_entries (user_id, word_id);
CREATE INDEX user_vocabulary_entries_status_idx ON user_vocabulary_entries (user_id, activation_status, next_review_at);

CREATE TABLE user_vocabulary_events (
  id bigint PRIMARY KEY,
  user_vocabulary_entry_id bigint NOT NULL REFERENCES user_vocabulary_entries (id),
  user_id text NOT NULL,
  old_status text,
  new_status text,
  event_type text NOT NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  admin_user_id bigint REFERENCES admin_users (id),
  created_at timestamp NOT NULL
);

CREATE INDEX user_vocabulary_events_entry_idx ON user_vocabulary_events (user_vocabulary_entry_id, created_at);

CREATE TABLE practice_rule_configs (
  id bigint PRIMARY KEY,
  version text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL
);

CREATE UNIQUE INDEX practice_rule_configs_version_idx ON practice_rule_configs (version);
CREATE INDEX practice_rule_configs_status_idx ON practice_rule_configs (status);

CREATE TABLE word_activation_attempts (
  id bigint PRIMARY KEY,
  user_id text NOT NULL,
  word_id bigint REFERENCES word_entries (id),
  sentence_id bigint REFERENCES corpus_sentences (id),
  practice_type text NOT NULL CHECK (practice_type IN ('audio_meaning', 'sentence_word', 'repeat_activation', 'review')),
  is_correct boolean NOT NULL DEFAULT false,
  selected_answer text,
  correct_answer text,
  replay_count integer NOT NULL DEFAULT 0,
  rule_version text NOT NULL,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL
);

CREATE INDEX word_activation_attempts_user_idx ON word_activation_attempts (user_id, created_at);
CREATE INDEX word_activation_attempts_word_idx ON word_activation_attempts (word_id, practice_type);

CREATE TABLE daily_task_strategies (
  id bigint PRIMARY KEY,
  version text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL
);

CREATE UNIQUE INDEX daily_task_strategies_version_idx ON daily_task_strategies (version);
CREATE INDEX daily_task_strategies_status_idx ON daily_task_strategies (status);

CREATE TABLE daily_tasks (
  id bigint PRIMARY KEY,
  user_id text NOT NULL,
  task_date text NOT NULL,
  strategy_version text NOT NULL,
  status text NOT NULL DEFAULT 'generated' CHECK (status IN ('generated', 'in_progress', 'completed', 'failed')),
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  generation_log jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL
);

CREATE UNIQUE INDEX daily_tasks_user_date_idx ON daily_tasks (user_id, task_date);
CREATE INDEX daily_tasks_status_idx ON daily_tasks (status, task_date);

CREATE TABLE daily_task_items (
  id bigint PRIMARY KEY,
  daily_task_id bigint NOT NULL REFERENCES daily_tasks (id),
  item_type text NOT NULL CHECK (item_type IN ('audio_meaning', 'repeat_sentence', 'review_word')),
  word_id bigint REFERENCES word_entries (id),
  sentence_id bigint REFERENCES corpus_sentences (id),
  priority_score numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped', 'failed')),
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL
);

CREATE INDEX daily_task_items_task_idx ON daily_task_items (daily_task_id, status);

CREATE TABLE listen_repeat_attempts (
  id bigint PRIMARY KEY,
  user_id text NOT NULL,
  sentence_id bigint NOT NULL REFERENCES corpus_sentences (id),
  mode text NOT NULL CHECK (mode IN ('A', 'B', 'C')),
  phrase_chunk_index integer,
  original_audio_duration_ms integer,
  recording_duration_ms integer,
  recording_url text,
  transcript text,
  text_match_rate numeric,
  text_match_level text CHECK (text_match_level IN ('accurate', 'partial', 'low')),
  speed_ratio numeric,
  target_word_hits jsonb NOT NULL DEFAULT '[]'::jsonb,
  waveform_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  asr_status text NOT NULL DEFAULT 'pending' CHECK (asr_status IN ('pending', 'succeeded', 'failed')),
  failure_reason text,
  created_at timestamp NOT NULL
);

CREATE INDEX listen_repeat_attempts_user_idx ON listen_repeat_attempts (user_id, created_at);
CREATE INDEX listen_repeat_attempts_sentence_idx ON listen_repeat_attempts (sentence_id, text_match_rate);

CREATE TABLE sentence_learning_stats (
  id bigint PRIMARY KEY,
  user_id text NOT NULL,
  sentence_id bigint NOT NULL REFERENCES corpus_sentences (id),
  attempts integer NOT NULL DEFAULT 0,
  best_accuracy numeric,
  latest_accuracy numeric,
  latest_mode text,
  latest_speed_ratio numeric,
  first_practiced_at timestamp,
  last_practiced_at timestamp,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL
);

CREATE UNIQUE INDEX sentence_learning_stats_user_sentence_idx ON sentence_learning_stats (user_id, sentence_id);

CREATE TABLE course_progress (
  id bigint PRIMARY KEY,
  user_id text NOT NULL,
  course_id bigint NOT NULL REFERENCES courses (id),
  completion_rate numeric NOT NULL DEFAULT 0,
  average_accuracy numeric,
  practice_rounds integer NOT NULL DEFAULT 0,
  weak_sentence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'unlocked' CHECK (status IN ('locked', 'unlocked', 'completed')),
  completed_at timestamp,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL
);

CREATE UNIQUE INDEX course_progress_user_course_idx ON course_progress (user_id, course_id);
CREATE INDEX course_progress_status_idx ON course_progress (user_id, status);

CREATE TABLE course_reports (
  id bigint PRIMARY KEY,
  user_id text NOT NULL,
  course_id bigint NOT NULL REFERENCES courses (id),
  practiced_sentence_count integer NOT NULL DEFAULT 0,
  average_accuracy numeric,
  average_speed_ratio numeric,
  best_sentence_id bigint REFERENCES corpus_sentences (id),
  weak_sentence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  activated_word_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  report_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL
);

CREATE INDEX course_reports_user_course_idx ON course_reports (user_id, course_id, created_at);

CREATE TABLE user_learning_stats (
  id bigint PRIMARY KEY,
  user_id text NOT NULL,
  practiced_sentence_count integer NOT NULL DEFAULT 0,
  repeat_attempt_count integer NOT NULL DEFAULT 0,
  practice_duration_seconds integer NOT NULL DEFAULT 0,
  streak_days integer NOT NULL DEFAULT 0,
  accuracy_trend jsonb NOT NULL DEFAULT '[]'::jsonb,
  completed_course_count integer NOT NULL DEFAULT 0,
  unlocked_scene_count integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL
);

CREATE UNIQUE INDEX user_learning_stats_user_idx ON user_learning_stats (user_id);
