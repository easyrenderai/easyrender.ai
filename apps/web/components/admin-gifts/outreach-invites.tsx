import { randomUUID } from 'node:crypto';
import { listCreditInvitePage } from '@easyrender/core';
import { RENDER_CREDITS } from '@easyrender/harness/pricing';
import Form from 'next/form';
import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { cancelOutreachInvite } from '@/lib/admin-gifts/invite-actions';
import { MAX_CREDIT_INVITE_BATCH, MAX_GIFT_CREDITS } from '@/lib/admin-gifts/limits';
import { InviteForm } from './invite-form';

const PANEL_PATH = '/admin/gift-credits';

export async function OutreachInvites({ campaign, page }: { campaign: string; page: number }) {
  const [t, formatter, results] = await Promise.all([
    getTranslations('CreditInvite'),
    getFormatter(),
    listCreditInvitePage({ campaign, page }),
  ]);
  const { invites, total, redeemed, completed, page: current, pages } = results;
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
            quantity: t('quantity'),
            linksCreated: t('linksCreated'),
            download: t('download'),
            create: t('create'),
            link: t('link'),
            copy: t('copy'),
            copied: t('copied'),
            copyError: t('copyError'),
            errors: {
              invalid_amount: t('invalid_amount', { max: MAX_GIFT_CREDITS }),
              invalid_key: t('invalid_key'),
              invalid_campaign: t('invalid_campaign'),
              invalid_quantity: t('invalid_quantity', { max: MAX_CREDIT_INVITE_BATCH }),
            },
          }}
        />
        <div className="space-y-3 border-t pt-5">
          <Form action={PANEL_PATH} className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1 basis-52 space-y-2">
              <Label htmlFor="campaign-search">{t('findCampaign')}</Label>
              <Input
                key={campaign}
                id="campaign-search"
                name="campaign"
                defaultValue={campaign}
                maxLength={120}
              />
            </div>
            <Button type="submit" variant="secondary">
              {t('filter')}
            </Button>
            {campaign && (
              <Button asChild variant="ghost">
                <Link href={PANEL_PATH} prefetch={false}>
                  {t('clearFilter')}
                </Link>
              </Button>
            )}
          </Form>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {t('campaignSummary', { total, redeemed, completed })}
            </p>
            {campaign && total > 0 && (
              <Button asChild size="sm" variant="outline">
                <Link
                  href={{ pathname: `${PANEL_PATH}/export`, query: { campaign } }}
                  prefetch={false}
                  download
                >
                  {t('download')}
                </Link>
              </Button>
            )}
          </div>
        </div>
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
                  <TableCell>
                    {invite.campaign}
                    <div className="font-mono text-xs text-muted-foreground">
                      {invite.id.slice(0, 13).toUpperCase()}
                    </div>
                  </TableCell>
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
                          <Link href={`/invite/${invite.id}`} prefetch={false}>
                            {t('open')}
                          </Link>
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
        {pages > 1 && (
          <nav
            aria-label={t('pageNumber', { page: current, pages })}
            className="flex flex-wrap items-center gap-2"
          >
            {current > 1 && (
              <Button asChild variant="outline" size="sm">
                <Link
                  href={{ pathname: PANEL_PATH, query: { campaign, page: current - 1 } }}
                  prefetch={false}
                >
                  {t('previous')}
                </Link>
              </Button>
            )}
            <p className="text-sm text-muted-foreground">
              {t('pageNumber', { page: current, pages })}
            </p>
            {current < pages && (
              <Button asChild variant="outline" size="sm">
                <Link
                  href={{ pathname: PANEL_PATH, query: { campaign, page: current + 1 } }}
                  prefetch={false}
                >
                  {t('next')}
                </Link>
              </Button>
            )}
          </nav>
        )}
      </CardContent>
    </Card>
  );
}
