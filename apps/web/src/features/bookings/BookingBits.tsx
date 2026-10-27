import type { BookingStatus } from '@bm/shared';
import { Badge } from '@/components/ui/badge';
import { t } from '@/i18n';

const TONES = {
  tentative: 'amber',
  confirmed: 'green',
  cancelled: 'red',
  completed: 'neutral',
} as const;

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return <Badge tone={TONES[status]}>{t.bookingStatuses[status]}</Badge>;
}
