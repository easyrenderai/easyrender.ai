'use client';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function RendersError({ reset }: { reset: () => void }) {
  const t = useTranslations('AdminInventory');
  return (
    <Card>
      <CardHeader>
        <CardTitle role="alert">{t('loadError')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={reset}>
          {t('retry')}
        </Button>
      </CardContent>
    </Card>
  );
}
