import type { Metadata } from 'next';
import { McpView } from '@/components/mcp/mcp-view';
import { JsonLd } from '@/lib/seo/jsonld';
import { mcpGraph, mcpMetadata } from '@/lib/seo/pages';

export const generateMetadata = (): Promise<Metadata> => mcpMetadata('en');

export default async function McpPage() {
  return (
    <>
      <JsonLd graph={await mcpGraph('en')} />
      <McpView locale="en" />
    </>
  );
}
