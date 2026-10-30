import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { t } from '@/i18n';
import { useBookingStays } from './api';
import { StayList } from './InventoryPage';
import { StayDialog } from './StayDialog';

/** Rooms and dorm beds booked for an event (baraat, family stays). */
export function BookingStaysCard({
  booking,
  canWrite,
  money,
}: {
  booking: {
    id: string;
    event_date: string;
    guest_count: number | null;
    guest: { full_name: string | null };
  };
  canWrite: boolean;
  money: boolean;
}) {
  const stays = useBookingStays(booking.id);
  const [open, setOpen] = useState(false);
  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">{t.inventory.stays}</CardTitle>
        {canWrite && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> {t.inventory.addStay}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {stays.isPending ? (
          <p className="text-sm text-muted-foreground">{t.common.loading}</p>
        ) : (
          <StayList stays={stays.data ?? []} money={money} canWrite={canWrite} />
        )}
      </CardContent>
      {open && (
        <StayDialog
          open
          onOpenChange={setOpen}
          prefill={{
            bookingId: booking.id,
            date: booking.event_date,
            guestName: booking.guest.full_name ?? undefined,
          }}
        />
      )}
    </Card>
  );
}
