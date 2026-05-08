CREATE TABLE IF NOT EXISTS hearing_trap_words (
  id bigint PRIMARY KEY,
  source_word_id bigint NOT NULL REFERENCES word_entries (id),
  source_word text NOT NULL,
  source_phonemes jsonb NOT NULL DEFAULT '[]'::jsonb,
  traps jsonb NOT NULL DEFAULT '[]'::jsonb,
  algorithm_version text NOT NULL,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS hearing_trap_words_source_version_idx
  ON hearing_trap_words (source_word_id, algorithm_version);

CREATE INDEX IF NOT EXISTS hearing_trap_words_source_compact_idx
  ON hearing_trap_words (source_word_id);
