import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import messages from '@/messages/en.json';
import { importSpendFile } from './spend-import';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { SpendImport } from '@/components/admin-analytics/spend-import';

describe('admin spend file import', () => {
  it('renders a labelled JSON picker and disabled action before a file is selected', () => {
    const html = renderToStaticMarkup(
      createElement(SpendImport, { labels: messages.AdminAnalytics.labels }),
    );
    expect(html).toContain('type="file"');
    expect(html).toContain('accept=".json,application/json"');
    expect(html).toContain('for="admin-spend-file"');
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-live="polite"');
  });
  it('rejects oversized or invalid JSON locally without uploading', async () => {
    const fetcher = vi.fn<typeof fetch>();
    expect(await importSpendFile(new File(['x'.repeat(512001)], 'large.json'), fetcher)).toEqual({
      error: 'spendImportTooLarge',
    });
    expect(await importSpendFile(new File(['{'], 'broken.json'), fetcher)).toEqual({
      error: 'spendImportInvalid',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('returns the server receipt using the existing same-origin session', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ imported: 2 }));
    expect(await importSpendFile(new File(['{"records":[]}'], 'spend.json'), fetcher)).toEqual({
      imported: 2,
    });
    expect(fetcher).toHaveBeenCalledWith(
      '/api/admin/analytics/ad-spend',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        body: '{"records":[]}',
      }),
    );
  });
  it('maps expired permission, rejected records and network failure to safe translated errors', async () => {
    const file = new File(['{}'], 'spend.json');
    expect(
      await importSpendFile(
        file,
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(Response.json({ error: 'secret server detail' }, { status: 403 })),
      ),
    ).toEqual({ error: 'spendImportDenied' });
    expect(
      await importSpendFile(
        file,
        vi.fn<typeof fetch>().mockResolvedValue(Response.json({}, { status: 400 })),
      ),
    ).toEqual({ error: 'spendImportInvalid' });
    expect(
      await importSpendFile(file, vi.fn<typeof fetch>().mockRejectedValue(new Error('network'))),
    ).toEqual({ error: 'spendImportFailed' });
    expect(
      await importSpendFile(
        file,
        vi.fn<typeof fetch>().mockResolvedValue(Response.json({ imported: 'invalid' })),
      ),
    ).toEqual({ error: 'spendImportFailed' });
  });
});
