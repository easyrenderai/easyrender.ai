'use client';

import type { ComponentProps } from 'react';
import { SiteLink } from '@/components/site-link';
import { captureBrowser } from '@/lib/analytics/browser';

/** Fixed event fields only: never collect link URLs, key text or account identifiers. */
export function IntegrationLink({
  channel,
  action,
  onClick,
  ...props
}: ComponentProps<typeof SiteLink> & {
  channel: 'api' | 'mcp';
  action: 'setup' | 'sample_download' | 'example_python' | 'example_typescript' | 'reference';
}) {
  return (
    <SiteLink
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) captureBrowser('integration_action', { channel, action });
      }}
    />
  );
}
