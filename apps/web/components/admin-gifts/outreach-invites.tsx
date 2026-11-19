import { randomUUID } from 'node:crypto';
import { listCreditInvites } from '@easyrender/core';
import { RENDER_CREDITS } from '@easyrender/harness/pricing';
import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cancelOutreachInvite } from '@/lib/admin-gifts/invite-actions';
import { MAX_GIFT_CREDITS } from '@/lib/admin-gifts/limits';
import { InviteForm } from './invite-form';

export async function OutreachInvites() {
  const [t, formatter, invites] = await Promise.all([
    getTranslations('CreditInvite'),
    getFormatter(),
    listCreditInvites(),
  ]);
  const date = (value: Date) => formatter.dateTime(value, { dateStyle: 'medium' });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('adminTitle')}</CardTitle>
        <CardDescription>{t('adminDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <InviteForm
          requestKey={randomUUID()}
          defaultCredits={RENDER_CREDITS}
          copy={{
            campaign: t('campaign'),
            credits: t('credits'),
            create: t('create'),
            link: t('link'),
            copy: t('copy'),
            copied: t('copied'),
            copyError: t('copyError'),
            errors: {
              invalid_amount: t('invalid_amount', { max: MAX_GIFT_CREDITS }),
              invalid_key: t('invalid_key'),
              invalid_campaign: t('invalid_campaign'),
            },
          }}
        />
        {invites.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('recipient')}</TableHead>
                <TableHead>{t('campaign')}</TableHead>
                <TableHead>{t('credits')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead>{t('firstModel')}</TableHead>
                <TableHead>{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((invite) => (
                <TableRow key={invite.id}>
                  <TableCell>{invite.recipientEmail ?? '—'}</TableCell>
                  <TableCell>{invite.campaign}</TableCell>
                  <TableCell>{formatter.number(invite.amount)}</TableCell>
                  <TableCell>
                    {t(invite.status)}
                    {invite.status === 'pending' && (
                      <div className="text-xs text-muted-foreground">{date(invite.expiresAt)}</div>
                    )}
                  </TableCell>
                  <TableCell>{invite.firstModelAt ? date(invite.firstModelAt) : '—'}</TableCell>
                  <TableCell>
                    {invite.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={`/invite/${invite.id}`}>{t('open')}</Link>
                        </Button>
                        <form action={cancelOutreachInvite}>
                          <Input type="hidden" name="id" value={invite.id} />
                          <Button size="sm" type="submit" variant="ghost">
                            {t('revoke')}
                          </Button>
                        </form>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">{t('noInvites')}</p>
        )}
      </CardContent>
    </Card>
  );
}
