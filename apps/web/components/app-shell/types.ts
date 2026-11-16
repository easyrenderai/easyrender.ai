// What the app layout reads on the server and hands to the shell. Dates are ISO strings so the
// object can cross into the client component.
export type ShellRender = {
  id: string;
  name: string | null;
  prompt: string | null;
  status: string;
  createdAt: string;
};

export type ShellData = {
  email: string;
  name: string;
  stats: { total: number; ready: number; inFlight: number; byAgent: number };
  renders: ShellRender[];
  // When the server read this, in ms. Relative times use it so server and client markup agree.
  now: number;
};

const KNOWN_STATUSES = ['drafting', 'preview_ready', 'rendering', 'ready', 'failed'] as const;
export type RenderStatus = (typeof KNOWN_STATUSES)[number];
export const isKnownStatus = (value: string): value is RenderStatus =>
  (KNOWN_STATUSES as readonly string[]).includes(value);
export const isInFlight = (status: string) => status === 'drafting' || status === 'rendering';
export const displayName = (render: Pick<ShellRender, 'name' | 'prompt'>) =>
  render.name?.trim() || render.prompt?.trim() || '';
