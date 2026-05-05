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
