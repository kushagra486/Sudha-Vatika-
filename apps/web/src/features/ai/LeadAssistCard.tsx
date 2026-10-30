import { formatEventDate, type EnquiryExtraction } from '@bm/shared';
import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/form';
import { useOrgSettings } from '@/features/bookings/api';
import { useUpdateLead, type Lead } from '@/features/leads/api';
import { ComposeBox } from '@/features/messaging/ComposeBox';
import { t } from '@/i18n';
import { AiSourceNote } from './AiBadge';
import { useDraftReply, useExtract, useUpsellIdeas } from './api';

const A = t.ai;

/** Lead page helper: draft a reply, fill details from a message, suggest extras. */
export function LeadAssistCard({ lead }: { lead: Lead }) {
  const draft = useDraftReply();
  const extract = useExtract();
  const upsell = useUpsellIdeas();
  const update = useUpdateLead(lead.id);
  const org = useOrgSettings();
  const [instruction, setInstruction] = useState('');
  const [pasted, setPasted] = useState('');
  const [draftKey, setDraftKey] = useState(0);

  const applyExtraction = () => {
    const x = extract.data?.extraction;
    if (!x) return;
    // Only fill what the lead doesn't have yet; never overwrite staff input.
    update.mutate({
      event_type: lead.event_type ?? x.event_type,
      event_date: lead.event_date ?? x.event_date,
      guest_count: lead.guest_count ?? x.guest_count,
      budget_min: lead.budget_min ?? x.budget_min,
      budget_max: lead.budget_max ?? x.budget_max,
      preferred_unit_id: lead.preferred_unit_id ?? extract.data?.preferred_unit_id ?? null,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-violet-600" /> {A.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* Draft a reply */}
        <section className="flex flex-col gap-2">
          <p className="text-sm font-medium">{A.draftTitle}</p>
          <Textarea
            aria-label={A.instruction}
            rows={2}
            placeholder={A.instruction}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
          />
          <Button
            variant="outline"
            className="self-start"
            disabled={draft.isPending}
            onClick={() =>
              draft.mutate(
                { lead_id: lead.id, instruction: instruction.trim() || undefined },
                { onSuccess: () => setDraftKey((k) => k + 1) },
              )
            }
          >
            {draft.isPending ? A.thinking : A.draft}
          </Button>
          {draft.isError && <p className="text-sm text-destructive">{A.error}</p>}
          {draft.data && (
            <>
              <AiSourceNote source={draft.data.source} />
              <ComposeBox
                key={draftKey}
                guest={{
                  id: lead.guest.id,
                  full_name: lead.guest.full_name,
                  phone_e164: lead.guest.phone_e164,
                  whatsapp_opt_in: lead.guest.whatsapp_opt_in,
                }}
                leadId={lead.id}
                initial={draft.data.text}
                context={{
                  guest_name: lead.guest.full_name,
                  event_type: lead.event_type,
                  event_date: lead.event_date ? formatEventDate(lead.event_date) : null,
                  venue: org.data?.name ?? null,
                }}
              />
            </>
          )}
        </section>

        {/* Fill details from a message */}
        <section className="flex flex-col gap-2 border-t pt-4">
          <p className="text-sm font-medium">{A.extractTitle}</p>
          <Textarea
            aria-label={A.pasteLabel}
            rows={3}
            placeholder={A.pasteLabel}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
          />
          <Button
            variant="outline"
            className="self-start"
            disabled={!pasted.trim() || extract.isPending}
            onClick={() => extract.mutate(pasted.trim())}
          >
            {extract.isPending ? A.thinking : A.read}
          </Button>
          {extract.isError && <p className="text-sm text-destructive">{A.error}</p>}
          {extract.data && (
            <div className="flex flex-col gap-2 rounded-md bg-muted p-3 text-sm">
              <AiSourceNote source={extract.data.source} />
              <ExtractionSummary x={extract.data.extraction} />
              <Button
                size="sm"
                className="self-start"
                disabled={update.isPending}
                onClick={applyExtraction}
              >
                {update.isSuccess ? A.applied : A.apply}
              </Button>
              <p className="text-xs text-muted-foreground">{A.applyHint}</p>
            </div>
          )}
        </section>

        {/* Upsell */}
        <section className="flex flex-col gap-2 border-t pt-4">
          <p className="text-sm font-medium">{A.upsellTitle}</p>
          <Button
            variant="outline"
            className="self-start"
            disabled={upsell.isPending}
            onClick={() => upsell.mutate({ lead_id: lead.id })}
          >
            {upsell.isPending ? A.thinking : A.suggest}
          </Button>
          {upsell.isError && <p className="text-sm text-destructive">{A.error}</p>}
          {upsell.data && (
            <>
              <AiSourceNote source={upsell.data.source} />
              {upsell.data.ideas.length === 0 ? (
                <p className="text-sm text-muted-foreground">{A.noIdeas}</p>
              ) : (
                <ul className="flex flex-col gap-1 text-sm">
                  {upsell.data.ideas.map((i) => (
                    <li key={i.id}>
                      <span className="font-medium">{i.name}</span>
                      <span className="text-muted-foreground"> · {i.reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </CardContent>
    </Card>
  );
}

export function ExtractionSummary({ x }: { x: EnquiryExtraction }) {
  const rows: [string, string | null][] = [
    [A.fields.name, x.full_name],
    [A.fields.event, x.event_type],
    [A.fields.date, x.event_date ? formatEventDate(x.event_date) : null],
    [A.fields.guests, x.guest_count ? String(x.guest_count) : null],
    [
      A.fields.budget,
      x.budget_max
        ? `₹${x.budget_min ? `${x.budget_min.toLocaleString('en-IN')}–` : ''}${x.budget_max.toLocaleString('en-IN')}`
        : null,
    ],
    [A.fields.space, x.preferred_space],
    [A.fields.extras, x.services.length ? x.services.join(', ') : null],
  ];
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
      {rows
        .filter(([, v]) => v)
        .map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      {x.summary && <dd className="col-span-2 mt-1 italic text-muted-foreground">{x.summary}</dd>}
    </dl>
  );
}
