# Learning Activation v1.0 Dev Summary

## Backend Scope

- Rebuilt the backend around `docs/PRD/learning-activation-v1`.
- Kept shared infrastructure: Fastify app bootstrap, Swagger plugin, error handling, Drizzle database wrapper, Snowflake IDs, static asset route, environment loading.
- Removed the old listening/speaking backend main path from the active app wiring.

## Implemented Modules

- M1 admin foundation: admin login/logout/me, admin accounts, permissions, audit logs, bootstrap super admin.
- M2 word library: SUBTLEXus-oriented word entries, admin CRUD/publish, public published word list.
- M2 import: admin multipart SUBTLEXus `.xls/.xlsx` import API with dry-run, row limit, frequency-field mapping, exclusion marking, batched upsert, and audit.
- API docs: replaced generic `object`/unknown schemas with explicit query, body, and response schemas for admin, word library, and learning activation routes.
- M3 corpus/course: scenes, courses, sentences, publication validation, admin CRUD, public course browsing.
- M4 annotation: annotation tasks, review/reject/correction flow, admin audit.
- M5 assessment: active assessment config, self-description submission, admin config management.
- M6 user vocabulary runtime: assessment-driven initial vocabulary generation, user vocabulary query, overview, admin correction with reason and audit.
- M7 activation practice: activation attempt recording, red/yellow/green status transitions, SRS update, and rule config management.
- M8 daily tasks: strategy config, on-demand daily task generation with audio-meaning, repeat-sentence, and review-word items.
- M9 listen-repeat: A/B/C attempt recording, text match level, speed ratio, sentence stats, and target-word activation callback.
- M10 course reports: report creation, course progress update, weak sentence payload, activated word payload, admin report query.

## Migrations

- `0001_learning_activation_v1.sql`: schema metadata baseline.
- `0002_learning_activation_v1_admin_foundation.sql`: admin users, sessions, permissions, role permissions, audit logs.
- `0003_learning_activation_v1_word_library.sql`: word entries.
- `0004_learning_activation_v1_runtime_modules.sql`: M3-M10 content, annotation, assessment, user vocabulary, practice, daily task, listen-repeat, and report tables.

## New Backend Files

- `services/api/src/repositories/LearningActivationRepository.ts`
- `services/api/src/services/LearningActivationService.ts`
- `services/api/src/http/routes/LearningActivationRoutes.ts`
- `services/api/src/http/schemas/LearningActivationSchemas.ts`

## Modified Backend Files

- `services/api/src/app.ts`
- `services/api/src/infrastructure/database/schema.ts`
- `services/api/src/scripts/provisionDatabase.ts`
- `services/api/src/scripts/smokeDatabase.ts`

## Notes

- Local/development database was provisioned with the new migration.
- No production or real-data destructive operation was executed.

## Frontend Scope

- Rebuilt `apps/web/src/App.tsx` around `learning-activation-v1` instead of extending old listening/speaking flows.
- Removed old frontend main-path files for legacy home, learning, admin content pages, recorder panels, and legacy learning/admin API clients.
- Added `learningActivationApi.ts` for the v1 backend endpoints:
  - learning: scenes, courses, sentences, assessment, user vocabulary, daily task, activation attempts, listen-repeat attempts, course reports.
  - admin: auth, accounts, audit logs, word library, corpus/course, annotation, assessment, user vocabulary, practice rules, daily task strategies, listen-repeat monitoring, course reports.
- Added separate user/admin session stores using `x-session-id` and `x-admin-session-id`.
- Implemented learning-side navigation for:
  - daily task, first-run assessment, vocabulary, courses, listen-repeat, course report, profile.
- Implemented admin-side navigation for M1-M10:
  - M1 admin foundation
  - M2 word library
  - M3 corpus/course
  - M4 auto annotation
  - M5 assessment
  - M6 user vocabulary
  - M7 activation practice
  - M8 daily task
  - M9 listen-repeat
  - M10 course report

## Frontend Notes

- Admin public registration is intentionally not provided; M1 follows PRD by using existing `super_admin` accounts to create, disable, and reset admin accounts.
- `/admin/dashboard` now renders the admin login shell when there is no admin session and does not poll `/admin/auth/me`.
- Backend/database cleanup was not performed by the frontend role; no production or real-data destructive operation was executed.

## Backend Update 2026-05-05

- Added public `GET /learning/continue-learning?limit=6` for post-daily-task continuation batches.
- Continue-learning candidates are ordered by due green reviews, yellow consolidation, then red activation words; each item includes `practiceType` and `prioritySource`.
- Continue-learning filters out unpublished, unapproved, excluded, or audio-missing words and returns specific `emptyReasons`.
- Practice result submission remains on `/learning/practice/activation-attempts`, so daily-task and continue-learning results share the same activation state and SRS transition path.

## Frontend Bugfix 2026-05-05

- Listen-repeat attempts now omit empty `textMatchRate` values instead of sending `null`, avoiding backend numeric-field failures for unscored manual submissions.

## Backend Word Sense Update 2026-05-05

- Added `word_senses` as a structured DictionaryAPI sense table keyed by word, metadata source, part of speech, and definition index.
- DictionaryAPI imports now expand `meanings[].definitions[]` into `word_senses` while keeping `word_entries.meaningEn/partOfSpeech` as backwards-compatible summary fields.
- Public word-meta and user vocabulary word responses now include optional structured `senses` for multi-part-of-speech dictionary display.

## Backend Word Entry Cleanup 2026-05-05

- Removed obsolete `word_entries.meaning_en` and `word_entries.part_of_speech`; structured meanings now live in `word_senses`.
- Word entry list/detail responses now include `senses` directly, so clients do not need an extra word-meta request for dictionary meanings.
- DictionaryAPI `derivedFields` now keeps only word identity, pronunciation, audio URL, and audio status.
