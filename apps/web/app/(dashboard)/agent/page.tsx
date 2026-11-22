import { listAgentChats } from '@easyrender/core';
import { agentAvailable } from '@easyrender/mcp/agent';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { AgentWorkspace } from '@/components/agent/agent-workspace';
import { currentUser } from '@/lib/actor';
import { localizedSignInPath } from '@/lib/app-locale';

export const dynamic = 'force-dynamic';
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Agent');
  return { title: t('metaTitle') };
}

export default async function AgentPage() {
  const user = await currentUser();
  if (!user) redirect(localizedSignInPath(await getLocale(), '/agent'));
  const chats = await listAgentChats(user.id);
  return <AgentWorkspace initialChats={chats} initialChat={null} isAvailable={agentAvailable()} />;
}
