import {
  formatEventDate,
  formatPhone,
  LEAD_SOURCES,
  LEAD_STAGES,
  type LeadSource,
} from '@bm/shared';
import { Plus, Search, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { t } from '@/i18n';
import {
  useLeads,
  type LeadFilters,
  type LeadListItem,
  type LeadView,
  type StageFilter,
} from './api';
import { ContactButtons, FollowUpBadge, StageBadge } from './LeadBits';
import { QuickAddDialog } from './QuickAddDialog';

type Controls = Omit<LeadFilters, 'view'>;
const DEFAULT_CONTROLS: Controls = { stage: 'open', source: 'any', search: '' };

function readView(raw: string | null): LeadView {
  return raw === 'due' || raw === 'new' ? raw : 'all';
}

export function LeadsPage() {
  const [params, setParams] = useSearchParams();
  const view = readView(params.get('view'));
  const [controls, setFilters] = useState<Controls>(DEFAULT_CONTROLS);
  const filters: LeadFilters = { ...controls, view };
  const [adding, setAdding] = useState(false);
  const leads = useLeads(filters);
  const filtered =
    view !== 'all' || filters.stage !== 'open' || filters.source !== 'any' || filters.search !== '';

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold sm:text-2xl">{t.leads.title}</h1>
        <Button onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" />
          {t.leads.add}
        </Button>
      </div>

      {view !== 'all' && (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-secondary px-3 py-2 text-sm">
          <span className="font-medium">{t.leads.views[view]}</span>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setParams({})}>
            <X className="h-4 w-4" aria-hidden />
            {t.leads.clearView}
          </Button>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label={t.leads.searchPlaceholder}
            placeholder={t.leads.searchPlaceholder}
            className="pl-9"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:contents">
          <Select
            aria-label={t.leads.filterStage}
            value={filters.stage}
            onChange={(e) => setFilters((f) => ({ ...f, stage: e.target.value as StageFilter }))}
          >
            <option value="open">{t.leads.allOpen}</option>
            {LEAD_STAGES.map((s) => (
              <option key={s} value={s}>
                {t.leadStages[s]}
              </option>
            ))}
            <option value="all">{t.leads.all}</option>
          </Select>
          <Select
            aria-label={t.leads.filterSource}
            value={filters.source}
            onChange={(e) =>
              setFilters((f) => ({ ...f, source: e.target.value as LeadSource | 'any' }))
            }
          >
            <option value="any">{t.leads.anySource}</option>
            {LEAD_SOURCES.map((s) => (
              <option key={s} value={s}>
                {t.leadSources[s]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {leads.isPending ? (
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      ) : leads.isError ? (
        <div className="flex items-center gap-3 text-sm text-destructive">
          {t.common.loadError}
          <Button variant="outline" size="sm" onClick={() => leads.refetch()}>
            {t.common.retry}
          </Button>
        </div>
      ) : leads.data.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {filtered ? t.leads.emptyFiltered : t.leads.empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {leads.data.map((lead) => (
            <li key={lead.id}>
              <LeadRow lead={lead} />
            </li>
          ))}
        </ul>
      )}

      <QuickAddDialog open={adding} onOpenChange={setAdding} />
    </div>
  );
}

function LeadRow({ lead }: { lead: LeadListItem }) {
  const facts = [
    lead.event_type,
    lead.event_date ? formatEventDate(lead.event_date) : t.leads.noDate,
    lead.guest_count ? t.leads.guests(lead.guest_count) : null,
    lead.preferred_unit?.name,
  ].filter(Boolean);

  return (
    <Card className="flex items-center gap-3 p-3 transition-colors hover:bg-muted/50">
      <Link to={`/leads/${lead.id}`} className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{lead.guest.full_name ?? t.leads.unnamed}</span>
          <StageBadge stage={lead.stage} />
        </div>
        <span className="text-sm text-muted-foreground">
          {formatPhone(lead.guest.phone_e164)} · {t.leadSources[lead.source]}
        </span>
        <span className="truncate text-sm">{facts.join(' · ')}</span>
        <FollowUpBadge at={lead.next_follow_up_at} />
      </Link>
      <ContactButtons
        phone={lead.guest.phone_e164}
        whatsapp={lead.guest.whatsapp_e164}
        whatsappAllowed={lead.guest.whatsapp_opt_in}
        className="shrink-0 flex-col sm:flex-row"
      />
    </Card>
  );
}
