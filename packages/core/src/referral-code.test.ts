import { describe, expect, it } from 'vitest';
import { normalizeReferralCode } from './referral-code';
import { mailboxKey } from './referrals';

describe('referral codes', () => {
  it('accepts a code in any case and with stray spaces', () => {
    expect(normalizeReferralCode(' k7m2px9q ')).toBe('K7M2PX9Q');
  });

  it('rejects anything that cannot be one of ours', () => {
    expect(normalizeReferralCode('K7M2PX9')).toBeNull();
    expect(normalizeReferralCode('K7M2PX9QQ')).toBeNull();
    expect(normalizeReferralCode('K7M2PX0Q')).toBeNull(); // 0 is not in the alphabet
    expect(normalizeReferralCode('K7M2-X9Q')).toBeNull();
    expect(normalizeReferralCode(undefined)).toBeNull();
    expect(normalizeReferralCode(['K7M2PX9Q'])).toBeNull();
  });
});

describe('mailbox key', () => {
  it('treats Gmail dots, +tags and googlemail as one mailbox', () => {
    const key = mailboxKey('Jane.Doe+promo@googlemail.com');
    expect(key).toBe('janedoe@gmail.com');
    expect(mailboxKey('janedoe@gmail.com')).toBe(key);
  });

  it('keeps dots and distinct domains apart elsewhere', () => {
    expect(mailboxKey('a.b+x@acme.com')).toBe('a.b@acme.com');
    expect(mailboxKey('a.b@acme.com')).not.toBe(mailboxKey('ab@acme.com'));
    expect(mailboxKey('a@acme.com')).not.toBe(mailboxKey('a@other.com'));
  });
});
