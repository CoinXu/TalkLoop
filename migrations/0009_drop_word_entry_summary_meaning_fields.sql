ALTER TABLE word_entries
  DROP COLUMN IF EXISTS meaning_en,
  DROP COLUMN IF EXISTS part_of_speech;
