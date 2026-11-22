import { AppError, getAgentChat, listAgentChats } from '@easyrender/core';
import { agentAvailable, pendingApprovals } from '@easyrender/mcp/agent';
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

export default async function AgentChatPage({ params }: PageProps<'/agent/[id]'>) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect(localizedSignInPath(await getLocale(), `/agent/${id}`));
  const [chats, chat] = await Promise.all([
    listAgentChats(user.id),
    getAgentChat(user.id, id).catch((error: unknown) => {
      // Someone else's chat answers like a missing one: back to the Agent start page.
      if (error instanceof AppError && error.status === 404) return null;
      throw error;
    }),
  ]);
  if (!chat) redirect('/agent');
  // The price of a paid step is read again now; a failed read leaves the chat without buttons.
  const approvals = await pendingApprovals({ userId: user.id }, id).catch(() => []);
  return (
    <AgentWorkspace
      key={id}
      initialChats={chats}
      initialChat={{
        id,
        messages: chat.messages.map(({ id: messageId, role, content, credits }) => ({
          id: messageId,
          role,
          content,
          credits,
        })),
        approvals,
      }}
      isAvailable={agentAvailable()}
    />
  );
}
