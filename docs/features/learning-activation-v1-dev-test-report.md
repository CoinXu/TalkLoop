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
