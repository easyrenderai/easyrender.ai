'use client';

import { useTranslations } from 'next-intl';
import { type FormEvent, useRef, useState, useTransition } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { findGiftRecipient, giftCredits } from '@/lib/admin-gifts/actions';
import { MAX_GIFT_CREDITS, MAX_GIFT_MODELS } from '@/lib/admin-gifts/limits';

type Recipient = Extract<Awaited<ReturnType<typeof findGiftRecipient>>, { status: 'found' }>;
type PendingGift = { email: string; amount: number; reason: string; key: string };

export function GiftCreditsPanel() {
  const t = useTranslations('AdminGift');
  const [email, setEmail] = useState('');
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [pendingGift, setPendingGift] = useState<PendingGift | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSearching, startSearch] = useTransition();
  const [isGranting, startGrant] = useTransition();
  const searchSequence = useRef(0);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRecipient(null);
    setError(null);
    setSuccess(null);
    const sequence = ++searchSequence.current;
    startSearch(async () => {
      try {
        const result = await findGiftRecipient(email);
        if (sequence !== searchSequence.current) return;
        if (result.status === 'found') setRecipient(result);
        else setError(t(result.status));
      } catch {
        if (sequence === searchSequence.current) setError(t('requestFailed'));
      }
    });
  }

  function prepareGift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!recipient) return;
    const parsed = Number(amount);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_GIFT_CREDITS) {
      setError(t('invalid_amount', { max: MAX_GIFT_CREDITS }));
      return;
    }
    if (!reason.trim() || reason.trim().length > 500) {
      setError(t('invalid_reason'));
      return;
    }
    setPendingGift({
      email: recipient.recipient.email,
      amount: parsed,
      reason: reason.trim(),
      key: crypto.randomUUID(),
    });
  }

  function confirmGift() {
    if (!pendingGift || isGranting) return;
    startGrant(async () => {
      try {
        const result = await giftCredits(pendingGift);
        if (result.status === 'granted' || result.status === 'duplicate') {
          setRecipient({ status: 'found', recipient: result.recipient, ledger: result.ledger });
          setSuccess(
            t(result.status === 'granted' ? 'success' : 'duplicate', {
              balance: result.recipient.credits,
            }),
          );
          setAmount('');
          setReason('');
          setPendingGift(null);
        } else {
          setError(t(result.status, { max: MAX_GIFT_CREDITS }));
          setPendingGift(null);
        }
      } catch {
        setError(t('requestFailed'));
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('findTitle')}</CardTitle>
            <CardDescription>{t('findDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={search} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor="gift-email">{t('email')}</Label>
                <Input
                  id="gift-email"
                  type="email"
                  autoComplete="off"
                  value={email}
                  onChange={(event) => {
                    searchSequence.current += 1;
                    setEmail(event.target.value);
                    setRecipient(null);
                    setSuccess(null);
                  }}
                  required
                />
              </div>
              <Button type="submit" variant="secondary" disabled={isSearching}>
                {isSearching ? t('searching') : t('find')}
              </Button>
            </form>
          </CardContent>
        </Card>
        {recipient ? (
          <Card>
            <CardHeader>
              <CardTitle>{recipient.recipient.name}</CardTitle>
              <CardDescription>{recipient.recipient.email}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  {t('balance')}
                </p>
                <p className="mt-1 font-mono text-3xl font-semibold tabular-nums">
                  {recipient.recipient.credits.toLocaleString('es-ES')}
                </p>
              </div>
              <div>
                <h2 className="mb-2 text-sm font-medium">{t('recentLedger')}</h2>
                {recipient.ledger.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('noEntries')}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('date')}</TableHead>
                        <TableHead>{t('movement')}</TableHead>
                        <TableHead>{t('ledgerReason')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recipient.ledger.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>
                            {new Intl.DateTimeFormat('es-ES', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            }).format(new Date(entry.createdAt))}
                          </TableCell>
                          <TableCell className="font-mono tabular-nums">
                            {entry.delta > 0 ? '+' : ''}
                            {entry.delta.toLocaleString('es-ES')}
                          </TableCell>
                          <TableCell className="max-w-48 truncate" title={entry.reason}>
                            {entry.reason}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>
        ) : !isSearching ? (
          <p className="text-sm text-muted-foreground">{t('emptyState')}</p>
        ) : null}
      </div>
      <div className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}
        <Card>
          <CardHeader>
            <CardTitle>{t('giftTitle')}</CardTitle>
            <CardDescription>{t('giftDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={prepareGift} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gift-amount">{t('amount')}</Label>
                <Input
                  id="gift-amount"
                  type="number"
                  min={1}
                  max={MAX_GIFT_CREDITS}
                  step={1}
                  inputMode="numeric"
                  aria-describedby="gift-amount-hint"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  disabled={!recipient}
                  required
                />
                <p id="gift-amount-hint" className="text-xs text-muted-foreground">
                  {t('amountHint', { max: MAX_GIFT_CREDITS, models: MAX_GIFT_MODELS })}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="gift-reason">{t('reason')}</Label>
                <Textarea
                  id="gift-reason"
                  maxLength={500}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  disabled={!recipient}
                  required
                />
              </div>
              <Button type="submit" disabled={!recipient}>
                {t('review')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      <Dialog
        open={pendingGift !== null}
        onOpenChange={(open) => {
          if (!open && !isGranting) setPendingGift(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('confirmTitle')}</DialogTitle>
            <DialogDescription>{t('confirmDescription')}</DialogDescription>
          </DialogHeader>
          {pendingGift && (
            <div className="space-y-2 rounded-lg border bg-muted p-4 text-sm">
              <p>
                <span className="text-muted-foreground">{t('email')}:</span> {pendingGift.email}
              </p>
              <p>
                <span className="text-muted-foreground">{t('amount')}:</span>{' '}
                <span className="font-mono tabular-nums">
                  {pendingGift.amount.toLocaleString('es-ES')}
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">{t('reason')}:</span> {pendingGift.reason}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isGranting}
              onClick={() => setPendingGift(null)}
            >
              {t('cancel')}
            </Button>
            <Button type="button" disabled={isGranting} onClick={confirmGift}>
              {isGranting ? t('granting') : t('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
