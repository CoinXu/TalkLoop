CREATE TABLE word_entries (
  id bigint PRIMARY KEY,
  word text NOT NULL,
  lemma text NOT NULL,
  phonetic text,
  meaning_cn text,
  meaning_en text,
  audio_url text,
  part_of_speech text,
  frequency_count integer,
  cd_count integer,
  frequency_low integer,
  cd_low integer,
  subtlwf numeric,
  lg10wf numeric,
  subtlcd numeric,
  lg10cd numeric,
  difficulty_level integer CHECK (difficulty_level BETWEEN 1 AND 4),
  level_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  scene_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  hearing_trap text,
  distractors jsonb NOT NULL DEFAULT '{"pronunciation":[],"meaning":[],"difficulty":[]}'::jsonb,
  common_collocations jsonb NOT NULL DEFAULT '[]'::jsonb,
  review_status text NOT NULL DEFAULT 'pending_review' CHECK (review_status IN ('pending_review', 'approved', 'rejected')),
  publish_status text NOT NULL DEFAULT 'draft' CHECK (publish_status IN ('draft', 'published', 'archived')),
  audio_status text NOT NULL DEFAULT 'missing' CHECK (audio_status IN ('missing', 'ready', 'failed')),
  is_excluded boolean NOT NULL DEFAULT false,
  exclusion_reason text,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL
);

CREATE UNIQUE INDEX word_entries_word_idx ON word_entries (word);
CREATE INDEX word_entries_list_idx ON word_entries (publish_status, review_status, difficulty_level);
CREATE INDEX word_entries_lemma_idx ON word_entries (lemma);
