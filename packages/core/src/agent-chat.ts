import { db, type Prisma } from '@easyrender/db';
import { AppError } from './errors';

export const AGENT_TITLE_MAX = 60;
export const AGENT_CHAT_LIST_LIMIT = 50;
// A chat that long is a book. The composer asks for a new one.
export const AGENT_CHAT_MESSAGE_LIMIT = 400;

export type AgentRole = 'user' | 'assistant';
export type AgentChatSummary = { id: string; title: string | null; updatedAt: string };
export type AgentMessageView = {
  id: string;
  role: AgentRole;
  // The model's content blocks as stored: text, tool calls, tool results.
  content: unknown[];
  credits: number;
  createdAt: string;
};
export type AgentChatView = AgentChatSummary & { messages: AgentMessageView[] };

const chatNotFound = () => new AppError('Chat not found', 404, 'chat_not_found');

// One line of the first thing the person said, for the chat list.
export function chatTitleFrom(text: string): string | null {
  const title = text.replace(/\s+/g, ' ').trim();
  if (!title) return null;
  return title.length > AGENT_TITLE_MAX
    ? `${title.slice(0, AGENT_TITLE_MAX - 1).trimEnd()}…`
    : title;
}

const toSummary = (chat: { id: string; title: string | null; updatedAt: Date }) => ({
  id: chat.id,
  title: chat.title,
  updatedAt: chat.updatedAt.toISOString(),
});

export async function createAgentChat(userId: string): Promise<AgentChatSummary> {
  return toSummary(await db().agentChat.create({ data: { userId } }));
}

export async function listAgentChats(userId: string): Promise<AgentChatSummary[]> {
  const chats = await db().agentChat.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: AGENT_CHAT_LIST_LIMIT,
  });
  return chats.map(toSummary);
}

// Every read is scoped to the owner: someone else's chat answers 404, like a missing one.
export async function getAgentChat(userId: string, id: string): Promise<AgentChatView> {
  const chat = await db().agentChat.findFirst({
    where: { id, userId },
    include: { messages: { orderBy: { createdAt: 'asc' }, take: AGENT_CHAT_MESSAGE_LIMIT } },
  });
  if (!chat) throw chatNotFound();
  return {
    ...toSummary(chat),
    messages: chat.messages.map((message) => ({
      id: message.id,
      role: message.role as AgentRole,
      content: Array.isArray(message.content) ? message.content : [],
      credits: message.credits,
      createdAt: message.createdAt.toISOString(),
    })),
  };
}

export async function deleteAgentChat(userId: string, id: string): Promise<void> {
  const { count } = await db().agentChat.deleteMany({ where: { id, userId } });
  if (count === 0) throw chatNotFound();
}

export async function appendAgentMessage(
  userId: string,
  chatId: string,
  message: {
    role: AgentRole;
    content: unknown[];
    inputTokens?: number;
    outputTokens?: number;
    credits?: number;
    // The text to title the chat with when it has no title yet.
    titleText?: string;
  },
): Promise<{ id: string }> {
  const chat = await db().agentChat.findFirst({
    where: { id: chatId, userId },
    select: { title: true, _count: { select: { messages: true } } },
  });
  if (!chat) throw chatNotFound();
  if (chat._count.messages >= AGENT_CHAT_MESSAGE_LIMIT) {
    throw new AppError('This chat is full. Start a new one.', 409, 'chat_full');
  }
  const title = chat.title ?? (message.titleText ? chatTitleFrom(message.titleText) : null);
  const [created] = await db().$transaction([
    db().agentMessage.create({
      data: {
        chatId,
        role: message.role,
        content: message.content as Prisma.InputJsonValue,
        inputTokens: message.inputTokens ?? 0,
        outputTokens: message.outputTokens ?? 0,
        credits: message.credits ?? 0,
      },
      select: { id: true },
    }),
    db().agentChat.update({
      where: { id: chatId },
      data: title && !chat.title ? { title } : { updatedAt: new Date() },
    }),
  ]);
  return created;
}

// Records on a message how many whole credits its turn cost, once the turn is charged.
export async function setAgentMessageCredits(
  userId: string,
  messageId: string,
  credits: number,
): Promise<void> {
  await db().agentMessage.updateMany({
    where: { id: messageId, chat: { userId } },
    data: { credits },
  });
}
