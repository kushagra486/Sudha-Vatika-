import { followUpState, formatDateTime, telHref, whatsappHref, type LeadStage } from '@bm/shared';
import { MessageCircle, Phone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { STAGE_TONES } from './stageTones';

export function StageBadge({ stage }: { stage: LeadStage }) {
  return <Badge tone={STAGE_TONES[stage]}>{t.leadStages[stage]}</Badge>;
}

const FOLLOW_UP_TONES = {
  overdue: 'red',
  today: 'amber',
  upcoming: 'neutral',
  none: 'neutral',
} as const;

export function FollowUpBadge({ at }: { at: string | null }) {
  const state = followUpState(at);
  if (state === 'none') return null;
  return (
    <Badge tone={FOLLOW_UP_TONES[state]} className="self-start">
      {t.leads.followUp[state]}
      {state !== 'today' && at ? ` · ${formatDateTime(at)}` : ''}
    </Badge>
  );
}

export function ContactButtons({
  phone,
  whatsapp,
  whatsappAllowed,
  size = 'icon',
  className,
}: {
  phone: string;
  /** The guest's WhatsApp number when it differs from their phone. */
  whatsapp?: string | null;
  whatsappAllowed: boolean;
  size?: 'icon' | 'sm';
  className?: string;
}) {
  const labelled = size === 'sm';
  return (
    <div className={cn('flex gap-2', className)}>
      <Button asChild variant="outline" size={size} aria-label={t.common.call}>
        <a href={telHref(phone)} onClick={(e) => e.stopPropagation()}>
          <Phone className="h-4 w-4" />
          {labelled && t.common.call}
        </a>
      </Button>
      {whatsappAllowed && (
        <Button asChild variant="outline" size={size} aria-label={t.common.whatsapp}>
          <a
            href={whatsappHref(whatsapp || phone)}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            <MessageCircle className="h-4 w-4" />
            {labelled && t.common.whatsapp}
          </a>
        </Button>
      )}
    </div>
  );
}
