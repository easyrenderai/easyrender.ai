'use client';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { importSpendFile, type SpendImportResult } from '@/lib/admin-analytics/spend-import';

export function SpendImport({ labels }: { labels: Record<string, string> }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isPending, setPending] = useState(false);
  const [result, setResult] = useState<SpendImportResult | null>(null);
  const isImporting = useRef(false);
  const hasError = result !== null && 'error' in result;
  async function importFile() {
    if (!file || isImporting.current) return;
    isImporting.current = true;
    setPending(true);
    setResult(null);
    try {
      const receipt = await importSpendFile(file);
      setResult(receipt);
      if ('imported' in receipt) router.refresh();
    } finally {
      isImporting.current = false;
      setPending(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{labels.spendImportTitle}</CardTitle>
        <CardDescription id="admin-spend-help">{labels.spendImportHelp}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="admin-spend-file">{labels.spendImportFile}</Label>
          <Input
            id="admin-spend-file"
            type="file"
            accept=".json,application/json"
            disabled={isPending}
            aria-describedby="admin-spend-help admin-spend-status"
            aria-invalid={hasError}
            onChange={(event) => {
              setFile(event.currentTarget.files?.[0] ?? null);
              setResult(null);
            }}
          />
        </div>
        <Button variant="outline" disabled={!file || isPending} onClick={importFile}>
          {isPending ? labels.spendImportPending : labels.spendImportAction}
        </Button>
        <p
          id="admin-spend-status"
          role={hasError ? 'alert' : 'status'}
          aria-live="polite"
          className={`text-sm ${hasError ? 'text-destructive' : 'text-muted-foreground'}`}
        >
          {result
            ? 'error' in result
              ? labels[result.error]
              : labels.spendImportSuccess.replace('{count}', String(result.imported))
            : ''}
        </p>
      </CardContent>
    </Card>
  );
}
