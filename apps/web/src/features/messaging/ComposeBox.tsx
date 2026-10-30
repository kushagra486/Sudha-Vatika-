import { fillTemplate, templateValues, type TemplateField } from '@bm/shared';
import { Send } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, Textarea } from '@/components/ui/form';
import { config } from '@/config';
import { t } from '@/i18n';
import { openInWhatsApp, useSendWhatsApp, useTemplates, type ChatGuest } from './api';

const C = t.chats;

/** Message box with template picker. Used in chats and on the lead page. */
export function ComposeBox({
  guest,
  leadId,
  context,
  initial = '',
}: {
  guest: ChatGuest;
  leadId: string | null;
  context: Partial<Record<TemplateField, string | null>>;
  initial?: string;
}) {
  const templates = useTemplates();
  const send = useSendWhatsApp();
  const [body, setBody] = useState(initial);
  const [templateId, setTemplateId] = useState<string | null>(null);

  if (!guest.whatsapp_opt_in) return <p className="text-sm text-muted-foreground">{C.optedOut}</p>;

  const pick = (id: string) => {
    const tp = templates.data?.find((x) => x.id === id);
    setTemplateId(tp?.id ?? null);
    if (tp) setBody(fillTemplate(tp.body, templateValues(tp.variables, context)));
  };

  const submit = () => {
    const text = body.trim();
    if (!text) return;
    openInWhatsApp(guest.phone_e164, text);
    send.mutate(
      { guest, body: text, lead_id: leadId, template_id: templateId },
      {
        onSuccess: () => {
          setBody('');
          setTemplateId(null);
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-2">
      {!!templates.data?.length && (
        <Select
          aria-label={C.useTemplate}
          value={templateId ?? ''}
          onChange={(e) => pick(e.target.value)}
        >
          <option value="">{C.useTemplate}</option>
          {templates.data.map((tp) => (
            <option key={tp.id} value={tp.id}>
              {tp.name}
            </option>
          ))}
        </Select>
      )}
      <Textarea
        aria-label={C.message}
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={C.placeholder}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {config.features.whatsappEnabled ? C.apiMode : C.manualMode}
        </p>
        <Button onClick={submit} disabled={!body.trim() || send.isPending}>
          <Send className="h-4 w-4" /> {C.send}
        </Button>
      </div>
      {send.isError && <p className="text-sm text-destructive">{C.sendError}</p>}
    </div>
  );
}
