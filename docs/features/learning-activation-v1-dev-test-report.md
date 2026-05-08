# Dev Test Report learning-activation-v1

## Type Check

- `npm run typecheck`: passed

## Build

- `npm run build`: passed

## Migration

- `npm run db:provision`: passed
- Applied: `0004_learning_activation_v1_runtime_modules.sql`

## Unit Tests

- `npm run test:unit`: passed
- Scope: existing backend unit tests

## Integration Smoke

- `npm run test:integration`: passed
- Covered:
  - health check
  - OpenAPI generation
  - admin auth guard
  - admin login/me
  - admin word library
  - admin SUBTLEXus import dry run with uploaded `.xls`
  - admin corpus
  - admin annotations
  - admin assessment
  - admin practice rules
  - admin daily task strategies
  - admin listen-repeat monitoring
  - admin course reports
  - public word library
  - public courses
  - user daily task generation
  - OpenAPI route schema scan: no generic empty object response and no missing query schemas on list/query endpoints

## Frontend Verification

- `cd apps/web && npm run typecheck`: passed
- `cd apps/web && npm run lint`: passed
- `cd apps/web && npm run test`: passed
- `cd apps/web && npm run build`: passed

## Frontend Coverage

- App shell renders v1.0 learning tabs.
- Admin dashboard route renders the login shell before admin authentication.
- Regression guard: no `/admin/auth/me` polling occurs before admin login.

## Backend Update 2026-05-05

- `cd services/api && npm run typecheck`: passed
- `cd services/api && npm run test:unit -- src/services/LearningActivationService.test.ts`: passed
- `cd services/api && npm run build`: passed
- Scope: continue-learning candidate priority, consumable-content filtering, and existing course unlock regression.

## Frontend Bugfix 2026-05-05

- `cd apps/web && npm run typecheck`: passed
- `cd apps/web && npm run test -- src/App.test.tsx`: passed
- Manual API check: listen-repeat request without `textMatchRate` returned `201 Created`.

## Backend Word Sense Update 2026-05-05

- `cd services/api && npm run typecheck`: passed
- `cd services/api && npm run test:unit -- src/services/WordLibraryService.test.ts src/services/LearningActivationService.test.ts`: passed
- `cd services/api && npm run build`: passed
- `cd services/api && npm run db:provision`: applied `0008_word_senses_dictionaryapi.sql`
- Manual API checks: `/word-library/word-meta?keyword=in` and `/learning/vocabulary/words?wordId=176746524351401996` return structured `senses`.

## Backend Word Entry Cleanup 2026-05-05

- `cd services/api && npm run typecheck`: passed
- `cd services/api && npm run test:unit -- src/services/WordLibraryService.test.ts src/services/LearningActivationService.test.ts`: passed
- `cd services/api && npm run build`: passed
- `cd services/api && npm run db:provision`: applied `0009_drop_word_entry_summary_meaning_fields.sql` and `0010_remove_dictionaryapi_summary_derived_fields.sql`
- Manual API checks: `/word-library/words`, `/learning/vocabulary/words`, and `/word-library/word-meta` return `senses`; top-level word entry `meaningEn/partOfSpeech` fields are absent.

## Backend Hearing Trap Prototype 2026-05-05

- `cd services/api && npm run typecheck`: passed
- `cd services/api && npm run test:unit -- src/services/WordLibraryService.test.ts`: passed
- `cd services/api && npm run build`: passed
- `cd services/api && npm run db:provision`: applied `0011_hearing_trap_words.sql`
- Manual API check: `/word-library/hearing-traps?word=and&limit=10` returned `200 OK` with candidates from `word_entries`.

## Backend Hearing Trap Storage Cleanup 2026-05-05

- `cd services/api && npm run typecheck`: passed
- `cd services/api && npm run test:unit -- src/services/WordLibraryService.test.ts`: passed
- `cd services/api && npm run build`: passed
- `cd services/api && npm run db:provision`: applied `0012_drop_word_entries_hearing_trap.sql`

## Backend Hearing Trap Bulk Generation 2026-05-05

- `cd services/api && npm run typecheck`: passed
- `cd services/api && npm run test:unit -- src/services/WordLibraryService.test.ts`: passed
- `cd services/api && npm run build`: passed
- `cd services/api && npm run db:provision`: applied `0013_compact_hearing_trap_words.sql` and `0014_drop_hearing_trap_pair_backup.sql`
- Bulk generation result: 6643 requested word entries, 6623 processed source words, 66223 jsonb trap items.
- Manual API check: `/word-library/hearing-traps?word=and&limit=3` returned `200 OK` with compact-table-backed generation still working.
- DictionaryAPI re-import result: 19993 processed rows, 0 skipped, 13375 word entries created, 6618 existing word entries updated, 19993 word metadata rows linked.
- Hearing-trap regeneration after import: 20018 requested word entries, 19600 processed source words, 418 CMUdict-missing words, 195993 jsonb trap items.
- Final DB check: `word_entries=20018`, `word_meta=19993`, `word_senses=147787`, `hearing_trap_words=19600`.
- `cd services/api && npm run build`: passed after the regeneration performance fix.

## Backend Auto Annotation M4 Update 2026-05-05

- `cd services/api && npm run typecheck`: passed
- `cd services/api && npm run test:unit -- src/services/LearningActivationService.test.ts`: passed
- `cd services/api && npm run build`: passed
- `cd services/api && npm run db:provision`: applied `0015_auto_annotation_results.sql`
- Manual API check: `POST /admin/annotations/tasks/run` for word hearing traps returned `201 Created` with generated results.
- Manual API check: `POST /admin/annotations/tasks/run` for sentence hearing traps returned `201 Created` with weak-form/contraction/linking candidates.
- Manual API check: `GET /admin/annotations/results?limit=1&offset=0` returned `200 OK` with annotation result payload.

## Backend Adaptive Assessment M5 Update 2026-05-05

- `cd services/api && npm run typecheck`: passed
- `cd services/api && npm run test:unit -- src/services/LearningActivationService.test.ts`: passed
- `cd services/api && npm run build`: passed
- `cd services/api && npm run db:provision`: applied `0016_adaptive_level_assessment.sql`
- Unit coverage: adaptive assessment session start generates six question items with four meaning options.
- Manual API check on a fresh backend at port `3001`: `POST /learning/assessment/sessions` returned `201 Created` with 6 current-round items.
- Manual API check on the same session: `POST /learning/assessment/sessions/:id/answers` returned `200 OK` and advanced from round 1 to round 2.
