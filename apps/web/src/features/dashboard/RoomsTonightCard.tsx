import { BedDouble } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { t } from '@/i18n';
import { useTrends } from './trends';

const T = t.insights;

export function RoomsTonightCard() {
  const q = useTrends();
  const rooms = q.data?.rooms_tonight ?? [];
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">{T.roomsTonight}</CardTitle>
          <CardDescription>{T.roomsSub}</CardDescription>
        </div>
        <Link to="/inventory" className="text-sm font-medium text-primary hover:underline">
          {t.dashboard.seeAll}
        </Link>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {q.isPending && <p className="text-sm text-muted-foreground">{t.common.loading}</p>}
        {rooms.map((r) => {
          const pct = r.quantity ? Math.round((r.taken / r.quantity) * 100) : 0;
          return (
            <div key={r.id} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="flex items-center gap-1.5 font-medium">
                  <BedDouble className="h-4 w-4 text-muted-foreground" aria-hidden /> {r.name}
                </span>
                <span className="tabular-nums">{T.occupied(r.taken, r.quantity)}</span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-muted"
                role="meter"
                aria-valuemin={0}
                aria-valuemax={r.quantity}
                aria-valuenow={r.taken}
                aria-label={`${r.name}: ${T.occupied(r.taken, r.quantity)}`}
              >
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
              {(r.arriving > 0 || r.leaving > 0) && (
                <p className="text-xs text-muted-foreground">{T.moves(r.arriving, r.leaving)}</p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
