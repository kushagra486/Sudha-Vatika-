import type { LeadStage } from '@bm/shared';
import type { BadgeTone } from '@/components/ui/badge';

export const STAGE_TONES: Record<LeadStage, BadgeTone> = {
  new: 'blue',
  contacted: 'neutral',
  follow_up: 'amber',
  proposal_sent: 'violet',
  booked: 'green',
  lost: 'red',
};
