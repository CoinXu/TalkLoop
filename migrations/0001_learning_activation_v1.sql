CREATE TABLE learning_activation_schema_meta (
  id integer PRIMARY KEY,
  version text NOT NULL,
  description text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO learning_activation_schema_meta (id, version, description)
VALUES (1, 'learning-activation-v1', 'Clean baseline after removing legacy listening-speaking and vocabulary activation schemas');
