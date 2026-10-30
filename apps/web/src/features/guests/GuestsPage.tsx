import { formatPhone } from '@bm/shared';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ContactButtons } from '@/features/leads/LeadBits';
import { t } from '@/i18n';
import { useDebounced } from '@/lib/useDebounced';
import { useGuests } from './api';

const G = t.guests;

export function GuestsPage() {
  const [search, setSearch] = useState('');
  const term = useDebounced(search, 300);
  const guests = useGuests(term);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <h1 className="text-xl font-semibold sm:text-2xl">{t.nav.guests}</h1>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          className="pl-9"
          placeholder={G.search}
          aria-label={G.search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {guests.isPending ? (
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      ) : guests.isError ? (
        <p className="text-sm text-destructive">{t.common.loadError}</p>
      ) : guests.data.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{G.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {guests.data.map((g) => {
            const bookings = g.bookings[0]?.count ?? 0;
            const leads = g.leads[0]?.count ?? 0;
            return (
              <li key={g.id}>
                <Card className="flex items-center justify-between gap-3 p-3">
                  <Link to={`/guests/${g.id}`} className="min-w-0 flex-1">
                    <p className="truncate font-medium">{g.full_name ?? t.leads.unnamed}</p>
                    <p className="text-xs text-muted-foreground">{formatPhone(g.phone_e164)}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {bookings > 0 && <Badge tone="green">{G.bookings(bookings)}</Badge>}
                      {leads > 0 && <Badge>{G.enquiries(leads)}</Badge>}
                      {bookings > 1 && <Badge tone="violet">{G.repeat}</Badge>}
                      {!g.whatsapp_opt_in && <Badge tone="red">{G.optedOut}</Badge>}
                    </div>
                  </Link>
                  <ContactButtons phone={g.phone_e164} whatsappAllowed={g.whatsapp_opt_in} />
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
