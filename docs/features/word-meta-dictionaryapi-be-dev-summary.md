# DictionaryAPI Word Metadata Backend

## Scope

- Added `word_meta` as a durable source table for DictionaryAPI payloads.
- Added admin APIs for listing metadata, importing DictionaryAPI rows, and applying one metadata row to `word_entries`.
- Added a local JSONL import script for `services/vocabulary/word/.data/dictionaryapi-raw.jsonl`.

## Data Flow

1. DictionaryAPI JSONL rows are parsed only when `status = ok`.
2. `word_entries` fields are derived from stable dictionary fields:
   - `word`
   - `lemma`
   - `phonetic`
   - `meaning_en`
   - `audio_url`
   - `audio_status`
   - `part_of_speech`
3. Full source data is preserved in `word_meta.raw_payload`.
4. Remaining dictionary structures are also queryable in `word_meta.phonetics`, `word_meta.meanings`, and `word_meta.derived_fields`.

## Admin APIs

- `GET /admin/word-library/word-meta`
- `POST /admin/word-library/imports/dictionaryapi`
- `POST /admin/word-library/word-meta/:id/apply`

All write APIs require `admin.word_meta.write`; listing requires `admin.word_meta.read`.

## Local Import

```bash
npm run word-meta:import -- --input ../../services/vocabulary/word/.data/dictionaryapi-raw.jsonl
```

Useful options:

- `--dry-run`
- `--limit <n>`
- `--no-apply`
- `--no-create-missing`
- `--overwrite`
