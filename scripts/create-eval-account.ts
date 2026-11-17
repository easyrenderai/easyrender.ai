// Creates the account the agent evals run as, funds it and mints its API key.
// Usage: DATABASE_URL=<postgres url> bun scripts/create-eval-account.ts \
//          | gh secret set EASYRENDER_API_KEY --repo easyrenderai/evals
//
// The raw key goes to stdout and nowhere else, so it can be piped straight into the repo secret.
// It refuses to print into a terminal. Everything a person reads goes to stderr.
//
// Safe to run again: the user is found by email, the credit grant uses one fixed idempotency
// key (a second run adds nothing), and each run mints one new key. Revoke an unused key from
// the account's dashboard. Credits move through the same ledger functions the app uses.
//
// Options: --email=<address>  default review@easyrender.ai
//          --credits=<n>      default 500, grant applied once
//          --limit=<n>        credit limit on the key, default none
import { randomBytes } from 'node:crypto';
import { createApiKey, getBalance, grantCredits } from '../packages/core/src/index.ts';
import { db } from '../packages/db/src/index.ts';

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

// The account has no password and no email subscription row: it signs in with a key only and
// holds no marketing consent. It skips the signup hook, so no signup event is recorded.
const existing = await db().user.findUnique({ where: { email }, select: { id: true } });
const user =
  existing ??
  (await db().user.create({
    data: {
      id: randomBytes(16).toString('hex'),
      name: 'Agent evals',
      email,
      emailVerified: true,
    },
    select: { id: true },
  }));
say(`${existing ? 'Found' : 'Created'} user ${email}`);

const isGranted = await grantCredits({
  userId: user.id,
  amount: credits,
  key: 'eval-account:initial-grant',
  reason: 'eval_account_grant',
});
say(isGranted ? `Granted ${credits} credits` : 'Initial grant already applied, nothing added');

const created = await createApiKey(user.id, 'agent-evals', {
  scopes: ['read', 'write', 'spend'],
  creditLimit,
});
say(
  `Balance ${await getBalance(user.id)} credits, key ${created.prefix}… with scopes ${created.scopes.join(', ')}`,
);
process.stdout.write(created.key);
await db().$disconnect();
