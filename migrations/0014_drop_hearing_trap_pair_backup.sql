-- Rollback note:
-- Pair rows can be reconstructed from hearing_trap_words.traps if this
-- legacy backup is needed again. The application no longer reads it.
DROP TABLE IF EXISTS hearing_trap_words_pair_backup;
