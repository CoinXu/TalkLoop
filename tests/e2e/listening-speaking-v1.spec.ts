import { expect, test } from '@playwright/test';

const baseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

test.describe('Listening Speaking V1 - content and publishing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(baseUrl);
  });

  test('TC-F-001/TC-API-002 creates a complete learning unit with source and license fields', async ({ page }) => {
    await page.getByTestId('admin-entry').click();
    await page.getByTestId('create-unit').click();

    await page.getByTestId('unit-title-input').fill('A real eye-opener');
    await page.getByTestId('expression-input').fill('a real eye-opener');
    await page.getByTestId('source-type-select').selectOption('manual_upload');
    await page.getByTestId('license-status-select').selectOption('approved');
    await page.getByTestId('audio-upload-input').setInputFiles('tests/fixtures/sample-audio.mp3');
    await page.getByTestId('transcript-input').fill('This trip was a real eye-opener.');
    await page.getByTestId('target-sentence-input').fill('This trip was a real eye-opener.');
    await page.getByTestId('speaking-prompt-input').fill('说说一次让你开眼界的经历。');
    await page.getByTestId('save-unit').click();

    await expect(page.getByTestId('unit-id')).toBeVisible();
    await expect(page.getByTestId('source-type-value')).toHaveText('manual_upload');
    await expect(page.getByTestId('license-status-value')).toHaveText('approved');
    await expect(page.getByTestId('publish-status-value')).toHaveText('draft');
  });

  test('TC-F-003 imports BBC URL as draft or internal review without approved license', async ({ page }) => {
    await page.getByTestId('admin-entry').click();
    await page.getByTestId('bbc-url-import').click();
    await page.getByTestId('source-url-input').fill('https://www.bbc.co.uk/learningenglish/example');
    await page.getByTestId('start-import').click();

    await expect(page.getByTestId('import-preview')).toBeVisible();
    await expect(page.getByTestId('source-type-value')).toHaveText('bbc_url_import');
    await expect(page.getByTestId('license-status-value')).not.toHaveText('approved');
    await expect(page.getByTestId('publish-status-value')).toHaveText('draft');
  });

  test('TC-B-005/TC-B-006 blocks publish when required fields or license status are invalid', async ({ page }) => {
    await page.getByTestId('admin-entry').click();
    await page.getByTestId('open-incomplete-unit').click();
    await page.getByTestId('publish-unit').click();

    await expect(page.getByTestId('publish-blockers')).toContainText('音频');
    await expect(page.getByTestId('publish-blockers')).toContainText('文字稿');

    await page.getByTestId('open-unknown-license-unit').click();
    await page.getByTestId('publish-unit').click();
    await expect(page.getByTestId('publish-blockers')).toContainText('授权');
  });

  test('TC-F-004/TC-F-007 hides unavailable units from regular users and shows internal review to testers', async ({ page }) => {
    await page.getByTestId('login-as-regular-user').click();
    await page.goto(`${baseUrl}/home`);
    await expect(page.getByText('Internal Review Unit')).toBeHidden();
    await expect(page.getByText('Rejected Unit')).toBeHidden();

    await page.getByTestId('switch-to-internal-tester').click();
    await page.goto(`${baseUrl}/home`);
    await expect(page.getByText('Internal Review Unit')).toBeVisible();
    await expect(page.getByTestId('internal-test-badge')).toBeVisible();
  });
});

test.describe('Listening Speaking V1 - transcript sync', () => {
  test('TC-F-008/TC-I-009 generates and manually adjusts synced segments', async ({ page }) => {
    await page.goto(`${baseUrl}/admin/sync/sample-unit`);
    await page.getByTestId('auto-sync').click();

    await expect(page.getByTestId('synced-segment-list')).toBeVisible();
    await page.getByTestId('segment-start-input-0').fill('0.5');
    await page.getByTestId('segment-end-input-0').fill('3.2');
    await page.getByTestId('save-sync').click();

    await expect(page.getByTestId('sync-status')).toHaveText('manually_reviewed');
  });

  test('TC-I-010/TC-F-011 highlights current segment and locates target sentence audio', async ({ page }) => {
    await page.goto(`${baseUrl}/learn/sample-unit/listening`);
    await page.getByTestId('play-audio').click();

    await expect(page.getByTestId('active-transcript-segment')).toBeVisible();
    await page.getByTestId('go-to-repeat').click();
    await page.getByTestId('play-target-sentence-audio').click();
    await expect(page.getByTestId('target-sentence-playing')).toBeVisible();
  });

  test('TC-B-012 blocks full learning flow for unsynced unit', async ({ page }) => {
    await page.goto(`${baseUrl}/learn/not-synced-unit`);
    await expect(page.getByTestId('sync-required-message')).toBeVisible();
    await expect(page.getByTestId('start-full-flow')).toBeDisabled();
  });
});

test.describe('Listening Speaking V1 - account, progress, and learning flow', () => {
  test('TC-F-013 logs in with configured OTP method and returns to learning step', async ({ page }) => {
    await page.goto(`${baseUrl}/learn/sample-unit/speaking-prompt`);
    await page.getByTestId('submit-score').click();
    await expect(page.getByTestId('login-panel')).toBeVisible();

    await page.getByTestId('otp-recipient-input').fill('qa@example.com');
    await page.getByTestId('otp-code-input').fill('123456');
    await page.getByTestId('login-and-save').click();

    await expect(page).toHaveURL(/speaking-prompt/);
    await expect(page.getByTestId('session-active')).toBeVisible();
  });

  test('TC-P-014/TC-P-015 saves and resumes current unit step', async ({ page }) => {
    await page.goto(`${baseUrl}/home`);
    await page.getByTestId('login-as-regular-user').click();
    await page.getByTestId('unit-card-sample-unit').click();
    await page.getByTestId('go-to-intensive-listening').click();
    await page.getByTestId('leave-learning').click();

    await page.goto(`${baseUrl}/home`);
    await page.getByTestId('unit-card-sample-unit').click();
    await expect(page.getByTestId('current-step')).toHaveText('看文字精听');
  });

  test('TC-I-018/TC-H-019/TC-I-020/TC-H-021 completes the fixed learning sequence without default answer reveal', async ({ page }) => {
    await page.goto(`${baseUrl}/learn/sample-unit`);
    await expect(page.getByTestId('full-transcript')).toBeHidden();

    await page.getByTestId('play-original-audio').click();
    await page.getByTestId('next-step').click();
    await page.getByTestId('replay-segment-0').click();
    await expect(page.getByTestId('active-transcript-segment')).toBeVisible();

    await page.getByTestId('next-step').click();
    await page.getByTestId('play-target-sentence-audio').click();
    await page.getByTestId('next-step').click();

    await expect(page.getByTestId('expected-answer')).toBeHidden();
    await expect(page.getByTestId('speaking-prompt')).toBeVisible();
  });

  test('TC-F-022/TC-F-023 only speaking prompt score can complete a unit', async ({ page }) => {
    await page.goto(`${baseUrl}/learn/sample-unit/repeat`);
    await page.getByTestId('record-audio').click();
    await page.getByTestId('stop-recording').click();
    await page.getByTestId('submit-target-sentence-score').click();
    await page.goto(`${baseUrl}/home`);
    await expect(page.getByTestId('unit-status-sample-unit')).not.toHaveText('completed');

    await page.goto(`${baseUrl}/learn/sample-unit/speaking-prompt`);
    await page.getByTestId('record-audio').click();
    await page.getByTestId('stop-recording').click();
    await page.getByTestId('submit-speaking-prompt-score').click();
    await expect(page.getByTestId('score-result')).toBeVisible();
    await page.goto(`${baseUrl}/home`);
    await expect(page.getByTestId('unit-status-sample-unit')).toHaveText('completed');
  });
});

test.describe('Listening Speaking V1 - speaking score', () => {
  test('TC-I-024/TC-API-025/TC-API-026 records, previews, retries, and shows score dimensions', async ({ page }) => {
    await page.goto(`${baseUrl}/learn/sample-unit/speaking-prompt`);
    await page.getByTestId('record-audio').click();
    await page.getByTestId('stop-recording').click();
    await page.getByTestId('play-my-recording').click();
    await page.getByTestId('rerecord').click();
    await page.getByTestId('record-audio').click();
    await page.getByTestId('stop-recording').click();
    await page.getByTestId('submit-speaking-prompt-score').click();

    await expect(page.getByTestId('overall-score')).toBeVisible();
    await expect(page.getByTestId('pronunciation-score')).toBeVisible();
    await expect(page.getByTestId('fluency-score')).toBeVisible();
    await expect(page.getByTestId('completeness-score')).toBeVisible();
  });

  test('TC-H-027/TC-H-028 shows playback comparison without correction advice', async ({ page }) => {
    await page.goto(`${baseUrl}/learn/sample-unit/score-result`);

    await expect(page.getByTestId('reference-playback')).toBeVisible();
    await expect(page.getByTestId('user-recording-playback')).toBeVisible();
    await expect(page.getByText('逐词纠错')).toBeHidden();
    await expect(page.getByText('语法批改')).toBeHidden();
    await expect(page.getByText('改正建议')).toBeHidden();
  });

  test('TC-API-029 keeps target sentence and speaking prompt score histories separate', async ({ page }) => {
    await page.goto(`${baseUrl}/history/sample-unit`);

    await expect(page.getByTestId('score-history-target-sentence')).toBeVisible();
    await expect(page.getByTestId('score-history-speaking-prompt')).toBeVisible();
  });
});

test.describe('Listening Speaking V1 - home and review', () => {
  test('TC-F-030/TC-F-031 lists learnable units and continue learning entry', async ({ page }) => {
    await page.goto(`${baseUrl}/home`);
    await page.getByTestId('login-as-regular-user').click();

    await expect(page.getByTestId('unit-list')).toBeVisible();
    await expect(page.getByTestId('continue-learning')).toBeVisible();
  });

  test('TC-I-032/TC-I-033 resumes incomplete unit and enters completed unit practice', async ({ page }) => {
    await page.goto(`${baseUrl}/home`);
    await page.getByTestId('in-progress-unit-card').click();
    await expect(page.getByTestId('current-step')).toHaveText('看文字精听');

    await page.goto(`${baseUrl}/home`);
    await page.getByTestId('practice-again-completed-unit').click();
    await expect(page).toHaveURL(/repeat|speaking-prompt/);
  });

  test('TC-H-034/TC-F-035 excludes non-V1 home features and enforces internal review visibility', async ({ page }) => {
    await page.goto(`${baseUrl}/home`);
    await expect(page.getByText('排行榜')).toBeHidden();
    await expect(page.getByText('社区')).toBeHidden();
    await expect(page.getByText('会员')).toBeHidden();
    await expect(page.getByText('支付')).toBeHidden();
    await expect(page.getByText('营销')).toBeHidden();

    await expect(page.getByText('Internal Review Unit')).toBeHidden();
    await page.getByTestId('switch-to-internal-tester').click();
    await expect(page.getByText('Internal Review Unit')).toBeVisible();
    await expect(page.getByTestId('internal-test-badge')).toBeVisible();
  });
});

test.describe('Listening Speaking V1 - boundary and exception handling', () => {
  test('TC-B-036 blocks dependent steps when audio playback fails', async ({ page }) => {
    await page.goto(`${baseUrl}/learn/audio-failure-unit`);
    await page.getByTestId('play-original-audio').click();

    await expect(page.getByTestId('audio-error-message')).toBeVisible();
    await expect(page.getByTestId('go-to-repeat')).toBeDisabled();
    await expect(page.getByTestId('go-to-speaking-prompt')).toBeDisabled();
  });

  test('TC-B-037 shows microphone permission guidance and prevents completion', async ({ page, context }) => {
    await context.clearPermissions();
    await page.goto(`${baseUrl}/learn/sample-unit/speaking-prompt`);
    await page.getByTestId('record-audio').click();

    await expect(page.getByTestId('microphone-permission-message')).toBeVisible();
    await expect(page.getByTestId('submit-speaking-prompt-score')).toBeDisabled();
  });

  test('TC-B-038 allows score retry without losing local recording on timeout', async ({ page }) => {
    await page.goto(`${baseUrl}/learn/score-timeout-unit/speaking-prompt`);
    await page.getByTestId('record-audio').click();
    await page.getByTestId('stop-recording').click();
    await page.getByTestId('submit-speaking-prompt-score').click();

    await expect(page.getByTestId('score-timeout-message')).toBeVisible();
    await expect(page.getByTestId('play-my-recording')).toBeEnabled();
    await expect(page.getByTestId('retry-score')).toBeEnabled();
  });

  test('TC-B-039 asks for re-login before saving score when session expires', async ({ page }) => {
    await page.goto(`${baseUrl}/learn/session-expired-unit/speaking-prompt`);
    await page.getByTestId('record-audio').click();
    await page.getByTestId('stop-recording').click();
    await page.getByTestId('submit-speaking-prompt-score').click();

    await expect(page.getByTestId('login-panel')).toBeVisible();
    await expect(page.getByTestId('local-recording-retained')).toBeVisible();
  });

  test('TC-B-040 shows clear import failure reason', async ({ page }) => {
    await page.goto(`${baseUrl}/admin/import`);
    await page.getByTestId('source-url-input').fill('https://www.bbc.co.uk/learningenglish/broken');
    await page.getByTestId('start-import').click();

    await expect(page.getByTestId('import-failure-reason')).toBeVisible();
  });
});
