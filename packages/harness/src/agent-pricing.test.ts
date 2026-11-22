import { describe, expect, it } from 'vitest';
import {
  AGENT_MODEL,
  agentCostUsd,
  agentMicroCredits,
  CREDIT_USD,
  creditsFor,
  MARGIN,
  MICRO_CREDITS_PER_CREDIT,
} from './pricing';

describe('agent chat pricing', () => {
  it('costs a turn from its tokens at the provider list price', () => {
    const usage = { inputTokens: 6000, outputTokens: 500 };
    const expected =
      (6000 * AGENT_MODEL.inputUsdPerMTok + 500 * AGENT_MODEL.outputUsdPerMTok) / 1_000_000;
    expect(agentCostUsd(usage)).toBeCloseTo(expected, 10);
  });

  it('charges cached prompt tokens at a tenth and cache writes at 25% more', () => {
    const base = agentCostUsd({ inputTokens: 1_000_000, outputTokens: 0 });
    expect(
      agentCostUsd({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 1_000_000 }),
    ).toBeCloseTo(base * 0.1, 10);
    expect(
      agentCostUsd({ inputTokens: 0, outputTokens: 0, cacheWriteTokens: 1_000_000 }),
    ).toBeCloseTo(base * 1.25, 10);
  });

  it('applies the one margin rule, in millionths of a credit', () => {
    const usage = { inputTokens: 6000, outputTokens: 500 };
    const credits = agentMicroCredits(usage) / MICRO_CREDITS_PER_CREDIT;
    // Price is cost plus the margin: cost = price * (1 - margin).
    expect(credits * CREDIT_USD * (1 - MARGIN)).toBeCloseTo(agentCostUsd(usage), 6);
    // The whole-credit rule never undercuts the fractional one.
    expect(creditsFor(agentCostUsd(usage))).toBeGreaterThanOrEqual(Math.floor(credits));
  });

  it('is zero for no usage and never negative', () => {
    expect(agentMicroCredits({ inputTokens: 0, outputTokens: 0 })).toBe(0);
  });
});
