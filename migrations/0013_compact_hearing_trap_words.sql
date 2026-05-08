DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'hearing_trap_words'
      AND column_name = 'trap_word_id'
  ) THEN
    ALTER TABLE hearing_trap_words RENAME TO hearing_trap_words_pair_backup;

    CREATE TABLE hearing_trap_words (
      id bigint PRIMARY KEY,
      source_word_id bigint NOT NULL REFERENCES word_entries (id),
      source_word text NOT NULL,
      source_phonemes jsonb NOT NULL DEFAULT '[]'::jsonb,
      traps jsonb NOT NULL DEFAULT '[]'::jsonb,
      algorithm_version text NOT NULL,
      created_at timestamp NOT NULL,
      updated_at timestamp NOT NULL
    );

    INSERT INTO hearing_trap_words (
      id,
      source_word_id,
      source_word,
      source_phonemes,
      traps,
      algorithm_version,
      created_at,
      updated_at
    )
    SELECT
      min(id) AS id,
      source_word_id,
      min(source_word) AS source_word,
      (array_agg(source_phonemes ORDER BY updated_at DESC))[1] AS source_phonemes,
      jsonb_agg(
        jsonb_build_object(
          'trapWordId', trap_word_id::text,
          'trapWord', trap_word,
          'phonemes', trap_phonemes,
          'vectorDistance', vector_distance::text,
          'weightedDistance', weighted_distance::text
        )
        ORDER BY weighted_distance, vector_distance, trap_word
      ) AS traps,
      algorithm_version,
      min(created_at) AS created_at,
      max(updated_at) AS updated_at
    FROM hearing_trap_words_pair_backup
    GROUP BY source_word_id, algorithm_version;

    CREATE UNIQUE INDEX IF NOT EXISTS hearing_trap_words_source_version_idx
      ON hearing_trap_words (source_word_id, algorithm_version);

    CREATE INDEX IF NOT EXISTS hearing_trap_words_source_compact_idx
      ON hearing_trap_words (source_word_id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS hearing_trap_words_source_version_idx
  ON hearing_trap_words (source_word_id, algorithm_version);

CREATE INDEX IF NOT EXISTS hearing_trap_words_source_compact_idx
  ON hearing_trap_words (source_word_id);
