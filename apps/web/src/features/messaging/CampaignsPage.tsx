import {
  fillTemplate,
  formatDateTime,
  formatEventDate,
  formatPhone,
  LEAD_STAGES,
  templateValues,
  type LeadStage,
} from '@bm/shared';
import { ArrowLeft, Plus, Send } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Select } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { config } from '@/config';
import { useOrgSettings } from '@/features/bookings/api';
import { t } from '@/i18n';
import {
  EMPTY_AUDIENCE,
  openInWhatsApp,
  useAudience,
  useCampaigns,
  useCampaignSentGuests,
  useSaveCampaign,
  useSendWhatsApp,
  useTemplates,
  type Audience,
  type Campaign,
  type Recipient,
  type Template,
} from './api';

const P = t.campaigns;

export function CampaignsPage() {
  const campaigns = useCampaigns();
  const [open, setOpen] = useState<Campaign | 'new' | null>(null);
  if (open === 'new') return <CampaignEditor onDone={() => setOpen(null)} />;
  if (open) return <CampaignRunner campaign={open} onBack={() => setOpen(null)} />;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold sm:text-2xl">{t.nav.campaigns}</h1>
        <Button onClick={() => setOpen('new')}>
          <Plus className="h-4 w-4" /> {P.add}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{P.hint}</p>
      {campaigns.isPending ? (
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      ) : campaigns.isError ? (
        <p className="text-sm text-destructive">{t.common.loadError}</p>
      ) : campaigns.data.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{P.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {campaigns.data.map((c) => (
            <li key={c.id}>
              <Card
                className="flex cursor-pointer items-center justify-between gap-3 p-3 hover:bg-muted/50"
                onClick={() => setOpen(c)}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(c.created_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {P.sentCount(c.sent[0]?.count ?? 0)}
                  </span>
                  <Badge
                    tone={
                      c.status === 'done' ? 'green' : c.status === 'running' ? 'amber' : 'neutral'
                    }
                  >
                    {P.statuses[c.status]}
                  </Badge>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CampaignEditor({ onDone }: { onDone: () => void }) {
  const templates = useTemplates();
  const save = useSaveCampaign();
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [audience, setAudience] = useState<Audience>(EMPTY_AUDIENCE);
  const recipients = useAudience(audience);
  const [error, setError] = useState<string | null>(null);

  const toggleStage = (s: LeadStage, on: boolean) =>
    setAudience((a) => ({ ...a, stages: on ? [...a.stages, s] : a.stages.filter((x) => x !== s) }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !templateId) return setError(t.bookings.form.required);
    save.mutate(
      { name: name.trim(), template_id: templateId, audience, status: 'ready' },
      { onSuccess: onDone, onError: () => setError(t.common.saveError) },
    );
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <button className="flex items-center gap-1 text-sm text-muted-foreground" onClick={onDone}>
        <ArrowLeft className="h-4 w-4" /> {t.nav.campaigns}
      </button>
      <h1 className="text-xl font-semibold">{P.add}</h1>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label={P.name} htmlFor="cp-name">
          <Input
            id="cp-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={P.namePlaceholder}
          />
        </Field>
        <Field
          label={P.template}
          htmlFor="cp-tp"
          hint={templates.data?.length ? undefined : P.noTemplates}
        >
          <Select id="cp-tp" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            <option value="">{t.quote.choose}</option>
            {templates.data?.map((tp) => (
              <option key={tp.id} value={tp.id}>
                {tp.name}
              </option>
            ))}
          </Select>
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{P.who}</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={audience.past_guests}
              onChange={(e) => setAudience((a) => ({ ...a, past_guests: e.target.checked }))}
            />
            {P.pastGuests}
          </label>
          <p className="text-xs text-muted-foreground">{P.leadsIn}</p>
          <div className="flex flex-wrap gap-3">
            {LEAD_STAGES.map((s) => (
              <label key={s} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={audience.stages.includes(s)}
                  onChange={(e) => toggleStage(s, e.target.checked)}
                />
                {t.leadStages[s]}
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={P.eventFrom} htmlFor="cp-from">
              <Input
                id="cp-from"
                type="date"
                value={audience.event_from ?? ''}
                onChange={(e) => setAudience((a) => ({ ...a, event_from: e.target.value || null }))}
              />
            </Field>
            <Field label={P.eventTo} htmlFor="cp-to">
              <Input
                id="cp-to"
                type="date"
                value={audience.event_to ?? ''}
                onChange={(e) => setAudience((a) => ({ ...a, event_to: e.target.value || null }))}
              />
            </Field>
          </div>
        </fieldset>
        <p className="text-sm font-medium">
          {recipients.isFetching ? t.common.loading : P.reach(recipients.data?.length ?? 0)}
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="self-start" disabled={save.isPending}>
          {P.create}
        </Button>
      </form>
    </div>
  );
}

function CampaignRunner({ campaign: c, onBack }: { campaign: Campaign; onBack: () => void }) {
  const templates = useTemplates();
  const recipients = useAudience(c.audience);
  const sent = useCampaignSentGuests(c.id);
  const save = useSaveCampaign();
  const tp = templates.data?.find((x) => x.id === c.template_id);
  const pending = (recipients.data ?? []).filter((r) => !sent.data?.has(r.id));
  const done = (recipients.data?.length ?? 0) - pending.length;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <button className="flex items-center gap-1 text-sm text-muted-foreground" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> {t.nav.campaigns}
      </button>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{c.name}</h1>
        <Badge tone={c.status === 'done' ? 'green' : 'amber'}>{P.statuses[c.status]}</Badge>
      </div>
      {tp && (
        <Card className="p-3 text-sm">
          <p className="mb-1 font-mono text-xs text-muted-foreground">{tp.name}</p>
          <p className="whitespace-pre-wrap">{tp.body}</p>
        </Card>
      )}
      <p className="text-sm">
        {P.progress(done, recipients.data?.length ?? 0)}{' '}
        {!config.features.whatsappEnabled && P.manualNote}
      </p>
      {recipients.isPending || sent.isPending ? (
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      ) : pending.length === 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">{P.allSent}</p>
          {c.status !== 'done' && (
            <Button
              className="self-start"
              onClick={() => save.mutate({ ...c, status: 'done' }, { onSuccess: onBack })}
            >
              {P.markDone}
            </Button>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {pending.slice(0, 50).map((r) => (
            <RecipientRow key={r.id} r={r} template={tp} campaign={c} />
          ))}
        </ul>
      )}
    </div>
  );
}

function RecipientRow({
  r,
  template,
  campaign,
}: {
  r: Recipient;
  template?: Template;
  campaign: Campaign;
}) {
  const send = useSendWhatsApp();
  const save = useSaveCampaign();
  const org = useOrgSettings();
  const body = template
    ? fillTemplate(
        template.body,
        templateValues(template.variables, {
          guest_name: r.full_name,
          event_type: r.event_type,
          event_date: r.event_date ? formatEventDate(r.event_date) : null,
          venue: org.data?.name ?? null,
        }),
      )
    : '';
  return (
    <li>
      <Card className="flex items-center justify-between gap-3 p-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{r.full_name ?? formatPhone(r.phone_e164)}</p>
          <p className="truncate text-xs text-muted-foreground">{body}</p>
        </div>
        <Button
          size="sm"
          disabled={!template || send.isPending || send.isSuccess}
          onClick={() => {
            openInWhatsApp(r.phone_e164, body);
            send.mutate({ guest: r, body, template_id: template!.id, campaign_id: campaign.id });
            if (campaign.status !== 'running') save.mutate({ ...campaign, status: 'running' });
          }}
        >
          <Send className="h-4 w-4" /> {send.isSuccess ? P.sent : P.send}
        </Button>
      </Card>
    </li>
  );
}
