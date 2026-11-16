import { randomUUID } from 'node:crypto';
import { db } from '@easyrender/db';
import { RENDER_CREDITS } from '@easyrender/harness';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { spendCreditsInTransaction } from './credits';
import {
  bindFirstModelEnrollment,
  configureFirstModelCampaign,
  FIRST_MODEL_CAMPAIGN,
  firstModelOffer,
  firstModelReport,
  grantFirstModelInTransaction,
} from './first-model-experiment';
import { startBuild } from './renders';

const provider = vi.hoisted(() => ({ hasFailed: false }));
vi.mock('./storage', () => ({
  getFile: async () => new Uint8Array([1]),
  putFile: async (key: string) => key,
}));
vi.mock('@easyrender/harness', async (original) => ({
  ...(await original<typeof import('@easyrender/harness')>()),
  createReplicate: () => ({
    upload: async () => {
      if (provider.hasFailed) throw new Error('provider down');
      return 'https://fixture.test/photo';
    },
    start: async () => ({ id: randomUUID() }),
  }),
}));

const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;
describe.skipIf(!url)('first model pilot (real Postgres)', () => {
  beforeEach(async () => {
    provider.hasFailed = false;
    process.env.REPLICATE_API_TOKEN = 'fixture';
    await db().firstModelEnrollment.deleteMany();
    await db().firstModelCampaign.deleteMany();
    await db().firstModelCampaign.create({
      data: {
        id: FIRST_MODEL_CAMPAIGN,
        isActive: true,
        maxOffers: 2,
        endsAt: new Date(Date.now() + 86400000),
      },
    });
  });
  afterAll(async () => {
    await db().firstModelEnrollment.deleteMany();
    await db().firstModelCampaign.deleteMany();
    await db().$disconnect();
  });
  async function visitor(ipHash = randomUUID()) {
    const actor = { anonId: randomUUID(), ipHash, source: 'web' as const };
    const render = await db().render.create({
      data: {
        anonId: actor.anonId,
        ipHash,
        sourceKey: 'test:photo',
        status: 'preview_ready',
        sheetKey: 'test:angles',
      },
    });
    return { actor, render };
  }
  async function member(anonId: string, isVerified = true) {
    const id = randomUUID();
    await db().user.create({
      data: { id, name: 'Trial test', email: `${id}@example.com`, emailVerified: isVerified },
    });
    await bindFirstModelEnrollment(id, anonId);
    await db().render.updateMany({ where: { anonId, userId: null }, data: { userId: id } });
    return id;
  }
  async function treatment() {
    for (let i = 0; i < 2; i++) {
      const input = await visitor();
      const offer = await firstModelOffer(input.render.id, input.actor);
      if (offer?.variant === 'free_model') return input;
    }
    throw new Error('A pair must include a free model');
  }
  it('persists a balanced allocation and reserves only the bounded number of offers under concurrency', async () => {
    const visitors = await Promise.all(Array.from({ length: 8 }, () => visitor()));
    const offers = await Promise.all(
      visitors.map(({ render, actor }) => firstModelOffer(render.id, actor)),
    );
    expect(offers.filter((v) => v?.variant === 'free_model')).toHaveLength(2);
    expect(offers.filter((v) => v?.variant === 'control')).toHaveLength(2);
    const first = visitors[offers.findIndex(Boolean)];
    expect(await firstModelOffer(first.render.id, first.actor)).toEqual(
      offers[offers.findIndex(Boolean)],
    );
    expect(await db().firstModelEnrollment.count()).toBe(4);
  });
  it('does not enroll signed-in users, public viewers, API callers or a repeated network within a day', async () => {
    const first = await visitor();
    expect(await firstModelOffer(first.render.id, { ...first.actor, source: 'api' })).toBeNull();
    expect(
      await firstModelOffer(first.render.id, { ...first.actor, anonId: 'not-owner' }),
    ).toBeNull();
    const id = await member(first.actor.anonId);
    expect(await firstModelOffer(first.render.id, { ...first.actor, userId: id })).toBeNull();
    const second = await visitor();
    expect(await firstModelOffer(second.render.id, second.actor)).not.toBeNull();
    const third = await visitor(second.actor.ipHash);
    expect(await firstModelOffer(third.render.id, third.actor)).toBeNull();
  });
  it('pauses new enrollment while preserving a promised model and rejects a second account', async () => {
    const { actor, render } = await treatment();
    await db().firstModelCampaign.update({
      where: { id: FIRST_MODEL_CAMPAIGN },
      data: { isActive: false },
    });
    const fresh = await visitor();
    expect(await firstModelOffer(fresh.render.id, fresh.actor)).toBeNull();
    const id = await member(actor.anonId, false);
    expect(await firstModelOffer(render.id, { ...actor, userId: id })).toMatchObject({
      state: 'verify',
    });
    const anotherId = await member(actor.anonId);
    expect(
      await db().firstModelEnrollment.findUnique({ where: { anonId: actor.anonId } }),
    ).toMatchObject({ userId: id });
    expect(await firstModelOffer(render.id, { ...actor, userId: anotherId })).toBeNull();
  });
  it('requires verified ownership and commits one grant with its debit, including concurrent requests and rollback', async () => {
    const { actor, render } = await treatment();
    const userId = await member(actor.anonId, false);
    const signed = { ...actor, userId };
    const grant = () =>
      db().$transaction((tx) =>
        grantFirstModelInTransaction(tx, render.id, signed, RENDER_CREDITS),
      );
    await expect(grant()).rejects.toMatchObject({ code: 'trial_verify_email' });
    expect(await db().creditLedger.count({ where: { userId } })).toBe(0);
    await db().user.update({ where: { id: userId }, data: { emailVerified: true } });
    await expect(
      db().$transaction(async (tx) => {
        await grantFirstModelInTransaction(tx, render.id, signed, RENDER_CREDITS);
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect((await db().user.findUniqueOrThrow({ where: { id: userId } })).credits).toBe(0);
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        db().$transaction(async (tx) => {
          const didGrant = await grantFirstModelInTransaction(
            tx,
            render.id,
            signed,
            RENDER_CREDITS,
          );
          await spendCreditsInTransaction(tx, {
            userId,
            amount: RENDER_CREDITS,
            key: `render:${render.id}`,
            reason: 'render',
            renderId: render.id,
          });
          return didGrant;
        }),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await db().user.findUniqueOrThrow({ where: { id: userId } })).credits).toBe(0);
    expect(await db().creditLedger.count({ where: { userId, reason: 'first_model_trial' } })).toBe(
      1,
    );
    expect(await firstModelOffer(render.id, signed)).toMatchObject({ state: 'used' });
  });
  it('starts a real pipeline transition with zero personal credits and never grants twice on parallel clicks', async () => {
    const { actor, render } = await treatment();
    const userId = await member(actor.anonId);
    const signed = { ...actor, userId, isUsingFreeModel: true, maxCredits: 0 };
    const results = await Promise.all([
      startBuild(render.id, signed),
      startBuild(render.id, signed),
    ]);
    expect(results.map((r) => r.status)).toEqual(['rendering', 'rendering']);
    expect((await db().user.findUniqueOrThrow({ where: { id: userId } })).credits).toBe(0);
    expect(await db().creditLedger.count({ where: { userId, reason: 'first_model_trial' } })).toBe(
      1,
    );
  });
  it('refunds a failed free build through the existing ledger without issuing another welcome grant', async () => {
    const { actor, render } = await treatment();
    const userId = await member(actor.anonId);
    provider.hasFailed = true;
    await expect(
      startBuild(render.id, { ...actor, userId, isUsingFreeModel: true, maxCredits: 0 }),
    ).rejects.toMatchObject({ status: 502 });
    expect((await db().render.findUniqueOrThrow({ where: { id: render.id } })).status).toBe(
      'failed',
    );
    expect((await db().user.findUniqueOrThrow({ where: { id: userId } })).credits).toBe(
      RENDER_CREDITS,
    );
    expect(await db().creditLedger.count({ where: { userId, reason: 'first_model_trial' } })).toBe(
      1,
    );
    expect(
      await db().creditLedger.count({ where: { userId, idempotencyKey: `refund:${render.id}` } }),
    ).toBe(1);
  });
  it('starts a bounded 14-day pilot once and preserves the sample and deadline across pause/resume', async () => {
    await db().firstModelCampaign.deleteMany();
    await expect(
      configureFirstModelCampaign({ isActive: true, maxOffers: 0 }),
    ).rejects.toMatchObject({ code: 'bad_trial_config' });
    const first = await configureFirstModelCampaign({ isActive: true, maxOffers: 100 });
    expect(first).toMatchObject({ maxOffers: 100, isActive: true, enrolled: 0 });
    await expect(
      configureFirstModelCampaign({ isActive: true, maxOffers: 250 }),
    ).rejects.toMatchObject({ code: 'trial_already_started' });
    await configureFirstModelCampaign({ isActive: false, maxOffers: 100 });
    const resumed = await configureFirstModelCampaign({ isActive: true, maxOffers: 100 });
    expect(resumed).toMatchObject({ startedAt: first?.startedAt, endsAt: first?.endsAt });
  });
  it('never falls back to spending an existing balance when a free claim is not eligible', async () => {
    const { actor, render } = await treatment();
    const userId = await member(actor.anonId);
    await db().user.update({ where: { id: userId }, data: { credits: RENDER_CREDITS } });
    await expect(
      startBuild(render.id, {
        ...actor,
        userId,
        source: 'api',
        apiKeyId: 'fixture-key',
        isUsingFreeModel: true,
        maxCredits: 0,
      }),
    ).rejects.toMatchObject({ code: 'trial_unavailable' });
    await db().firstModelEnrollment.update({ where: { userId }, data: { variant: 'control' } });
    await expect(
      startBuild(render.id, { ...actor, userId, isUsingFreeModel: true, maxCredits: 0 }),
    ).rejects.toMatchObject({ code: 'trial_unavailable' });
    expect((await db().user.findUniqueOrThrow({ where: { id: userId } })).credits).toBe(
      RENDER_CREDITS,
    );
    expect(await db().creditLedger.count({ where: { userId } })).toBe(0);
    expect((await db().render.findUniqueOrThrow({ where: { id: render.id } })).status).toBe(
      'preview_ready',
    );
  });
  it('stays inactive by default and never enrolls a new visitor after the deadline', async () => {
    await db().firstModelCampaign.deleteMany();
    const { actor, render } = await visitor();
    expect(await firstModelOffer(render.id, actor)).toBeNull();
    expect((await firstModelReport()).campaign).toBeNull();
    expect(await db().firstModelCampaign.count()).toBe(0);
    await configureFirstModelCampaign({ isActive: true, maxOffers: 250 });
    await db().firstModelCampaign.update({
      where: { id: FIRST_MODEL_CAMPAIGN },
      data: { endsAt: new Date(0) },
    });
    expect(await firstModelOffer(render.id, actor)).toBeNull();
  });
  it('does not count a model cost twice when a returning account has another anonymous preview', async () => {
    const first = await treatment();
    const userId = await member(first.actor.anonId);
    const returning = await visitor();
    await firstModelOffer(returning.render.id, returning.actor);
    await db().render.update({
      where: { id: returning.render.id },
      data: { userId, costUsd: 0.5 },
    });
    const report = await firstModelReport();
    expect(report.arms.reduce((sum, arm) => sum + arm.recordedProviderCostUsd, 0)).toBe(0.5);
  });
  it('keeps anonymous non-converters in the denominator and excludes immature and out-of-window purchases', async () => {
    const { actor, render } = await treatment();
    const userId = await member(actor.anonId);
    const enrolledAt = new Date(Date.now() - 31 * 86400000);
    await db().firstModelEnrollment.updateMany({ data: { enrolledAt } });
    await db().firstModelEnrollment.update({
      where: { userId },
      data: { boundAt: new Date(enrolledAt.getTime() + 1000) },
    });
    await db().render.update({
      where: { id: render.id },
      data: {
        createdAt: enrolledAt,
        status: 'ready',
        completedAt: new Date(enrolledAt.getTime() + 2000),
        costUsd: 0.225,
      },
    });
    await db().purchase.createMany({
      data: [
        {
          userId,
          stripeSessionId: randomUUID(),
          packId: 'payg',
          credits: 500,
          amountCents: 500,
          status: 'paid',
          paidAt: new Date(enrolledAt.getTime() + 86400000),
        },
        {
          userId,
          stripeSessionId: randomUUID(),
          packId: 'payg',
          credits: 500,
          amountCents: 500,
          status: 'paid',
          paidAt: new Date(),
        },
      ],
    });
    const fresh = await visitor();
    await firstModelOffer(fresh.render.id, fresh.actor);
    const report = await firstModelReport();
    expect(report).toMatchObject({
      windows: expect.arrayContaining([
        expect.objectContaining({
          days: 30,
          variant: 'free_model',
          matureVisitors: 1,
          payers: 1,
          firstModels: 1,
          secondModels: 0,
          signups: 1,
        }),
      ]),
      revenueCentsByCurrency: { usd: 1000 },
    });
  });
});
