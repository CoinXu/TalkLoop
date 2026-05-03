CREATE TABLE subtlexus_words (
  id bigint PRIMARY KEY,
  word text NOT NULL,
  normalized_word text NOT NULL,
  freq_count integer,
  cd_count integer,
  freq_low integer,
  cd_low integer,
  subtl_wf numeric,
  lg10_wf numeric,
  subtl_cd numeric,
  lg10_cd numeric,
  source_file_name text NOT NULL,
  import_batch_id text NOT NULL,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL
);

CREATE UNIQUE INDEX subtlexus_words_word_idx ON subtlexus_words (word);
CREATE INDEX subtlexus_words_normalized_word_idx ON subtlexus_words (normalized_word);
CREATE INDEX subtlexus_words_frequency_idx ON subtlexus_words (lg10_wf, freq_count);
CREATE INDEX subtlexus_words_import_batch_idx ON subtlexus_words (import_batch_id);
