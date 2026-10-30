import { formatEventDate, formatINR, formatPhone } from '@bm/shared';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { useSetUpsellStatus, useUpsellList, type UpsellStatus } from './api';

const U = t.upsell;
const FILTERS = ['open', 'accepted', 'declined'] as const;
const TONES = { suggested: 'violet', sent: 'blue', accepted: 'green', declined: 'red' } as const;

export function UpsellPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('open');
  const list = useUpsellList(filter);
  const setStatus = useSetUpsellStatus();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <h1 className="text-xl font-semibold sm:text-2xl">{t.nav.upsell}</h1>
      <p className="text-sm text-muted-foreground">{U.hint}</p>
      <div role="tablist" className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
        {FILTERS.map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              'flex-1 rounded-md px-3 py-2 font-medium',
              filter === f ? 'bg-background shadow-sm' : 'text-muted-foreground',
            )}
          >
            {U.filters[f]}
          </button>
        ))}
      </div>
      {list.isPending ? (
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      ) : list.isError ? (
        <p className="text-sm text-destructive">{t.common.loadError}</p>
      ) : list.data.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{U.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.data.map((u) => {
            const item = u.service?.name ?? u.package?.name ?? '';
            const price = u.service
              ? Number(u.service.base_price)
              : u.package
                ? Number(u.package.price)
                : 0;
            return (
              <li key={u.id}>
                <Card className="flex flex-col gap-2 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {item}
                        {price > 0 && (
                          <span className="text-muted-foreground"> · {formatINR(price)}</span>
                        )}
                      </p>
                      <Link to={`/leads/${u.lead.id}`} className="text-sm text-primary">
                        {u.lead.guest.full_name ?? formatPhone(u.lead.guest.phone_e164)}
                        {u.lead.event_type ? ` · ${u.lead.event_type}` : ''}
                        {u.lead.event_date ? ` · ${formatEventDate(u.lead.event_date)}` : ''}
                      </Link>
                      {u.reason && <p className="text-xs text-muted-foreground">{u.reason}</p>}
                    </div>
                    <Badge tone={TONES[u.status]}>{U.statuses[u.status]}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(['sent', 'accepted', 'declined'] as UpsellStatus[])
                      .filter((s) => s !== u.status)
                      .map((s) => (
                        <Button
                          key={s}
                          size="sm"
                          variant="outline"
                          onClick={() => setStatus.mutate({ id: u.id, status: s })}
                        >
                          {U.mark[s as 'sent' | 'accepted' | 'declined']}
                        </Button>
                      ))}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
