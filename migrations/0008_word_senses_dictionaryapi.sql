CREATE TABLE IF NOT EXISTS word_senses (
  id bigint PRIMARY KEY,
  word_id bigint NOT NULL REFERENCES word_entries (id),
  word_meta_id bigint REFERENCES word_meta (id),
  source text NOT NULL,
  part_of_speech text NOT NULL,
  definition text NOT NULL,
  example text,
  synonyms jsonb NOT NULL DEFAULT '[]'::jsonb,
  antonyms jsonb NOT NULL DEFAULT '[]'::jsonb,
  sense_index integer NOT NULL DEFAULT 0,
  definition_index integer NOT NULL DEFAULT 0,
  raw_definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL
);

CREATE INDEX IF NOT EXISTS word_senses_word_id_idx ON word_senses (word_id, part_of_speech, sense_index, definition_index);
CREATE INDEX IF NOT EXISTS word_senses_word_meta_id_idx ON word_senses (word_meta_id);
CREATE UNIQUE INDEX IF NOT EXISTS word_senses_meta_definition_idx ON word_senses (word_meta_id, sense_index, definition_index) WHERE word_meta_id IS NOT NULL;

WITH expanded AS (
  SELECT
    wm.id AS word_meta_id,
    wm.word_id,
    wm.source,
    meaning.value AS meaning,
    (meaning.ordinality - 1)::integer AS sense_index,
    definition.value AS definition,
    (definition.ordinality - 1)::integer AS definition_index,
    wm.created_at,
    wm.updated_at
  FROM word_meta wm
  CROSS JOIN LATERAL jsonb_array_elements(wm.meanings) WITH ORDINALITY AS meaning(value, ordinality)
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(meaning.value->'definitions', '[]'::jsonb)) WITH ORDINALITY AS definition(value, ordinality)
  WHERE wm.word_id IS NOT NULL
    AND meaning.value->>'partOfSpeech' IS NOT NULL
    AND definition.value->>'definition' IS NOT NULL
)
INSERT INTO word_senses (
  id,
  word_id,
  word_meta_id,
  source,
  part_of_speech,
  definition,
  example,
  synonyms,
  antonyms,
  sense_index,
  definition_index,
  raw_definition,
  created_at,
  updated_at
)
SELECT
  (800000000000000000 + row_number() OVER (ORDER BY word_meta_id, sense_index, definition_index))::bigint,
  word_id,
  word_meta_id,
  source,
  meaning->>'partOfSpeech',
  definition->>'definition',
  definition->>'example',
  COALESCE(definition->'synonyms', '[]'::jsonb),
  COALESCE(definition->'antonyms', '[]'::jsonb),
  sense_index,
  definition_index,
  definition,
  created_at,
  updated_at
FROM expanded
ON CONFLICT DO NOTHING;
