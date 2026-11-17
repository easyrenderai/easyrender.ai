import { describe, expect, it } from 'vitest';
import { createEditorialMetrics } from './editorial';

const cta = {
  article_group: 'compare-meshy',
  article_locale: 'es',
  article_path: '/es/comparativas/meshy',
  cta_position: 'sidebar',
  cta_destination: '/es#try',
} as const;

describe('editorial CTA funnel', () => {
  it('records one visible exposure per placement, retries after initialization and never counts hidden CTAs', () => {
    const events: string[] = [];
    let isReady = false;
    const metrics = createEditorialMetrics((name) => {
      if (!isReady) return false;
      events.push(name);
      return true;
    });
    metrics.visibility(cta, true);
    metrics.visibility({ ...cta, cta_position: 'mobile' }, false);
    expect(events).toEqual([]);
    isReady = true;
    metrics.flush();
    metrics.visibility(cta, true);
    metrics.visibility(cta, false);
    metrics.visibility(cta, true);
    expect(events).toEqual(['article_cta_viewed']);
  });
  it('attributes later product events to the clicked article, not just the latest article viewed, and expires after 30 minutes', () => {
    let time = 0;
    const metrics = createEditorialMetrics(
      () => true,
      () => time,
    );
    metrics.click(cta);
    metrics.visibility({ ...cta, article_group: 'compare-tripo' }, true);
    expect(metrics.context()).toEqual(cta);
    time = 30 * 60 * 1000;
    expect(metrics.context()).toEqual({});
  });
  it('does not attribute unrecorded clicks and can clear the in-memory context', () => {
    let isReady = false;
    const metrics = createEditorialMetrics(() => isReady);
    metrics.click(cta);
    expect(metrics.context()).toEqual({});
    isReady = true;
    metrics.click(cta);
    metrics.clear();
    expect(metrics.context()).toEqual({});
  });
  it('uses click as visible evidence when the observer has not fired yet', () => {
    const events: string[] = [];
    const metrics = createEditorialMetrics((name) => {
      events.push(name);
      return true;
    });
    metrics.click(cta);
    expect(events).toEqual(['article_cta_viewed', 'article_cta_clicked']);
  });
});
