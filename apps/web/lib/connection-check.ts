import type { ApiKeyScope } from '@easyrender/core';
export type ConnectionCheckResult = {
  account: { name: string; email: string };
  balance: number;
  key: {
    scopes: ApiKeyScope[];
    expiresAt: string | null;
    creditLimit: number | null;
    spentCredits: number;
    remainingCredits: number | null;
  };
};
