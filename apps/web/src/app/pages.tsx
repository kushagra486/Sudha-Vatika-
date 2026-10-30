import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { t } from '@/i18n';
import type { Strings } from '@/i18n/en';

/** Placeholder for modules that later phases will build. */
export function ComingSoonPage({ labelKey }: { labelKey: keyof Strings['nav'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.nav[labelKey]}</CardTitle>
        <CardDescription>{t.common.comingSoon}</CardDescription>
      </CardHeader>
    </Card>
  );
}

export function NotFoundPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.notFound.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline">
          <Link to="/dashboard">{t.common.backToDashboard}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
