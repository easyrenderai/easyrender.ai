import { config, listPendingCreditInvites } from '@easyrender/core';
import { csv } from '@easyrender/core/admin-analytics/helpers';
import { requireAdmin } from '@/lib/admin-analytics/auth';

export async function GET(request: Request) {
  await requireAdmin();
  const campaign = new URL(request.url).searchParams.get('campaign')?.trim();
  if (!campaign || campaign.length > 120) return new Response(null, { status: 400 });

  const invites = await listPendingCreditInvites(campaign);
  const baseUrl = config.appUrl();
  const data = csv(
    ['reference', 'campaign', 'url', 'credits', 'expiresAt'],
    invites.map((invite) => ({
      reference: invite.id.slice(0, 13).toUpperCase(),
      campaign: invite.campaign,
      url: new URL(`/invite/${invite.id}`, baseUrl).href,
      credits: invite.amount,
      expiresAt: invite.expiresAt.toISOString(),
    })),
  );
  return new Response(`\ufeff${data}`, {
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Disposition': 'attachment; filename="outreach-invitations.csv"',
      'Content-Type': 'text/csv; charset=utf-8',
    },
  });
}
