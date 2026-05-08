ALTER TABLE annotation_tasks
  ADD COLUMN IF NOT EXISTS task_status text NOT NULL DEFAULT 'queued',
  ADD COLUMN IF NOT EXISTS input_scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS rule_version text NOT NULL DEFAULT 'auto-annotation-v1',
  ADD COLUMN IF NOT EXISTS started_at timestamp,
  ADD COLUMN IF NOT EXISTS completed_at timestamp,
  ADD COLUMN IF NOT EXISTS succeeded_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS low_confidence_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failure_reason text;

ALTER TABLE annotation_tasks
  DROP CONSTRAINT IF EXISTS annotation_tasks_task_status_check,
  ADD CONSTRAINT annotation_tasks_task_status_check
    CHECK (task_status IN ('queued', 'running', 'completed', 'partial_failed', 'failed', 'reviewed'));

ALTER TABLE annotation_tasks
  DROP CONSTRAINT IF EXISTS annotation_tasks_review_status_check,
  ADD CONSTRAINT annotation_tasks_review_status_check
    CHECK (review_status IN ('pending_review', 'approved', 'rejected', 'reviewed'));

CREATE INDEX IF NOT EXISTS annotation_tasks_status_idx
  ON annotation_tasks (task_status, task_type);

CREATE TABLE IF NOT EXISTS annotation_results (
  id bigint PRIMARY KEY,
  task_id bigint NOT NULL REFERENCES annotation_tasks (id),
  target_type text NOT NULL CHECK (target_type IN ('word', 'sentence')),
  target_id bigint NOT NULL,
  result_type text NOT NULL CHECK (result_type IN ('hearing_trap', 'distractors', 'target_words', 'phrase_chunks')),
  trap_type text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  proposed_patch jsonb NOT NULL DEFAULT '{}'::jsonb,
  manual_patch jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence numeric NOT NULL,
  severity numeric NOT NULL,
  result_status text NOT NULL DEFAULT 'pending_review'
    CHECK (result_status IN ('auto_approved', 'pending_review', 'approved', 'rejected', 'edited')),
  algorithm_version text NOT NULL,
  rule_version text NOT NULL,
  reviewer_admin_id bigint REFERENCES admin_users (id),
  reviewed_at timestamp,
  rejection_reason text,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL
);

CREATE INDEX IF NOT EXISTS annotation_results_task_idx
  ON annotation_results (task_id);

CREATE INDEX IF NOT EXISTS annotation_results_target_idx
  ON annotation_results (target_type, target_id, result_type);

CREATE INDEX IF NOT EXISTS annotation_results_review_idx
  ON annotation_results (result_status, result_type, confidence);
