import posthog, { type CaptureResult, type PostHogConfig } from 'posthog-js';
import { expect, it } from 'vitest';

it('the installed SDK supplies a real anonymous session only on the consented instance and preserves purchase dedup fields', () => {
  const captured: CaptureResult[] = [];
  const config: Partial<PostHogConfig> = {
    persistence: 'memory',
    disable_persistence: true,
    person_profiles: 'never',
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    disable_external_dependency_loading: true,
    advanced_disable_flags: true,
    advanced_disable_feature_flags: true,
    before_send: (event) => {
      if (event) captured.push(event);
      return null;
    },
  };
  // Drop all sends in before_send; this contract test never contacts PostHog or uses a DOM.
  const cookieless = posthog.init(
    'fixture-public-key',
    { ...config, cookieless_mode: 'always' },
    'contract_cookieless',
  );
  const consented = posthog.init('fixture-public-key', config, 'contract_consented');
  expect(cookieless?.get_distinct_id()).toBe('$posthog_cookieless');
  expect(cookieless?.get_session_id()).toBe('');
  expect(consented?.get_distinct_id()).not.toBe('$posthog_cookieless');
  expect(consented?.get_session_id()).toMatch(
    /^[\da-f]{8}-[\da-f]{4}-7[\da-f]{3}-[\da-f]{4}-[\da-f]{12}$/,
  );
  const uuid = '019a0000-0000-5000-a000-000000000001';
  const timestamp = new Date();
  consented?.capture(
    'purchase_completed',
    {
      distinct_id: 'checkout-browser',
      posthog_session_id: 'checkout-session',
      $session_id: 'checkout-session',
    },
    { uuid, timestamp },
  );
  expect(captured.at(-1)).toMatchObject({
    uuid,
    event: 'purchase_completed',
    properties: {
      distinct_id: 'checkout-browser',
      posthog_session_id: 'checkout-session',
    },
  });
  // posthog-js overwrites this field: the app must restore it in before_send.
  expect(captured.at(-1)?.properties.$session_id).toBe(consented?.get_session_id());
  const previous = consented?.get_distinct_id();
  consented?.reset(true);
  expect(consented?.get_distinct_id()).not.toBe(previous);
});

it('the installed memory-only SDK can enable and stop replay without persistent opt-in', () => {
  const sdk = posthog.init(
    'fixture-public-key',
    {
      persistence: 'memory',
      disable_persistence: true,
      disable_session_recording: true,
      disable_external_dependency_loading: true,
      advanced_disable_flags: true,
      capture_pageview: false,
      autocapture: false,
      before_send: () => null,
    },
    'contract_replay',
  );
  expect(sdk?.sessionManager).toBeDefined();
  const sessionId = sdk?.get_session_id();
  sdk?.startSessionRecording();
  expect(sdk?.config.disable_session_recording).toBe(false);
  expect(sdk?.get_session_id()).toBe(sessionId);
  expect(sdk?.config.persistence).toBe('memory');
  expect(sdk?.config.disable_persistence).toBe(true);
  // No DOM or remote config in this contract test: enabling is not proof of live recording.
  expect(sdk?.sessionRecordingStarted()).toBe(false);
  sdk?.stopSessionRecording();
  expect(sdk?.config.disable_session_recording).toBe(true);
});
