// Creates the shared review account: the login third-party reviewers (app stores, partners) use,
// and the account the agent evals run as. It funds the account and mints its API key.
//
// Usage (from apps/web):
//   DATABASE_URL=<postgres url> bun scripts/create-review-account.ts --password-file=<path> \
//     | gh secret set EASYRENDER_API_KEY --repo easyrenderai/evals
//
// stdout carries the raw API key and nothing else, so it can be piped into the repo secret; the
// script refuses to print into a terminal. Everything a person reads goes to stderr. The login
// password is generated, never printed, and written to --password-file (mode 0600, never
// overwritten). Read it there and share it outside chat.
//
// Safe to run again: the user is found by email, the credit grant uses one fixed idempotency key
// (a second run adds nothing), an existing password is left alone, and each run mints one new key.
// Credits move through the same ledger functions the app uses. The account skips the signup hook,
// so no signup event is recorded, and it has no email subscription, so no marketing consent.
//
// Options: --email=<address>  default review@easyrender.ai
//          --credits=<n>      default 500, granted once
//          --limit=<n>        credit limit on the key, default none
//          --password-file=<path>  required when the account has no password yet
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createApiKey, getBalance, grantCredits } from '@easyrender/core';
import { db } from '@easyrender/db';
import { hashPassword } from 'better-auth/crypto';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function option(name: string): string | undefined {
  return process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
}

function integerOption(name: string, fallback: number | null): number | null {
  const raw = option(name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(`--${name} must be a positive integer`);
  return value;
}

const say = (message: string) => process.stderr.write(`${message}\n`);

if (process.stdout.isTTY) {
  say('stdout is a terminal. Pipe this script into `gh secret set` so the key is never shown.');
  process.exit(1);
}

const email = (option('email') ?? 'review@easyrender.ai').trim().toLowerCase();
if (!EMAIL_PATTERN.test(email)) throw new Error('--email is not an email address');
const credits = integerOption('credits', 500) as number;
const creditLimit = integerOption('limit', null);
const passwordFile = option('password-file');

const existing = await db().user.findUnique({ where: { email }, select: { id: true } });
const user =
  existing ??
  (await db().user.create({
    data: {
      id: randomBytes(16).toString('hex'),
      name: 'easyrender review',
      email,
      emailVerified: true,
    },
    select: { id: true },
  }));
say(`${existing ? 'Found' : 'Created'} user ${email}`);
if (existing) await db().user.update({ where: { id: user.id }, data: { emailVerified: true } });

const hasPassword = await db().account.findFirst({
  where: { userId: user.id, providerId: 'credential' },
  select: { id: true },
});
if (hasPassword) {
  say('Password login already set, left unchanged');
} else {
  if (!passwordFile) throw new Error('--password-file is required to set the first password');
  const password = randomBytes(18).toString('base64url');
  // Write the file first: if it already exists the script stops before any password is stored.
  writeFileSync(passwordFile, `${password}\n`, { flag: 'wx', mode: 0o600 });
  await db().account.create({
    data: {
      id: randomBytes(16).toString('hex'),
      accountId: user.id,
      providerId: 'credential',
      userId: user.id,
      password: await hashPassword(password),
    },
  });
  say(`Password login set, password written to ${passwordFile}`);
}

const isGranted = await grantCredits({
  userId: user.id,
  amount: credits,
  key: 'review-account:initial-grant',
  reason: 'review_account_grant',
});
say(isGranted ? `Granted ${credits} credits` : 'Initial grant already applied, nothing added');

const created = await createApiKey(user.id, 'agent-evals', {
  // share is needed because the evals make each render private (PATCH isPublic).
  scopes: ['read', 'write', 'spend', 'share'],
  creditLimit,
});
say(
  `Balance ${await getBalance(user.id)} credits, key ${created.prefix}… with scopes ${created.scopes.join(', ')}`,
);
process.stdout.write(created.key);
await db().$disconnect();
