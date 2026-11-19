import { formatDateTime } from '@bm/shared';
import type { LucideIcon } from 'lucide-react';
import {
  Brush,
  Car,
  Check,
  ConciergeBell,
  Copy,
  ExternalLink,
  Luggage,
  MessageSquare,
  Printer,
  RotateCcw,
  Star,
  UtensilsCrossed,
  Wrench,
  X,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/app/auth';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label, Select, Textarea } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import {
  CARD_URL,
  GUIDE_URL,
  ago,
  summarize,
  toE164,
  useDeleteRestaurant,
  useGuideSettings,
  useRestaurants,
  useSaveRestaurant,
  useRoomRequests,
  useRoomReviews,
  useSaveGuideSettings,
  useSetRequestStatus,
  type RequestKind,
  type Diet,
  type Restaurant,
  type RestaurantInput,
  type RequestStatus,
  type RoomRequest,
  type RoomReview,
} from './api';

const D = t.roomDesk;
type Tab = 'requests' | 'reviews' | 'restaurants' | 'guide';
type Filter = 'open' | 'done' | 'all';

const KIND_ICON: Record<RequestKind, LucideIcon> = {
  reception: ConciergeBell,
  housekeeping: Brush,
  food: UtensilsCrossed,
  luggage: Luggage,
  maintenance: Wrench,
  transport: Car,
  helpdesk: MessageSquare,
  other: MessageSquare,
};

const STATUS_TONE: Record<RequestStatus, BadgeTone> = {
  new: 'amber',
  in_progress: 'blue',
  done: 'green',
  cancelled: 'neutral',
};

export function RoomDeskPage() {
  const { profile } = useAuth();
  const role = profile?.role;
  const canHandle = role === 'owner' || role === 'manager' || role === 'ops' || role === 'sales';
  const canSeeGuide = role === 'owner' || role === 'manager' || role === 'ops';
  const [tab, setTab] = useState<Tab>('requests');
  const tabs: Tab[] = canSeeGuide
    ? ['requests', 'reviews', 'restaurants', 'guide']
    : ['requests', 'reviews', 'restaurants'];
  const label: Record<Tab, string> = {
    requests: D.requestsTab,
    reviews: D.reviewsTab,
    restaurants: D.restaurantsTab,
    guide: D.guideTab,
  };
  const requests = useRoomRequests();
  const openCount = (requests.data ?? []).filter(
    (r) => r.status === 'new' || r.status === 'in_progress',
  ).length;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">{D.title}</h1>
        <p className="text-sm text-muted-foreground">{D.subtitle}</p>
      </div>
      <div className="flex gap-2" role="tablist">
        {tabs.map((x) => (
          <Button
            key={x}
            role="tab"
            aria-selected={tab === x}
            variant={tab === x ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTab(x)}
          >
            {label[x]}
            {x === 'requests' && openCount > 0 && (
              <span className="ml-1.5 rounded-full bg-background/90 px-1.5 text-xs font-semibold text-foreground">
                {openCount}
              </span>
            )}
          </Button>
        ))}
      </div>
      {tab === 'requests' && <RequestsTab canHandle={canHandle} />}
      {tab === 'reviews' && <ReviewsTab />}
      {tab === 'restaurants' && <RestaurantsTab canEdit={role === 'owner' || role === 'manager'} />}
      {tab === 'guide' && canSeeGuide && (
        <GuideTab canEdit={role === 'owner' || role === 'manager'} />
      )}
    </div>
  );
}

function RequestsTab({ canHandle }: { canHandle: boolean }) {
  const [filter, setFilter] = useState<Filter>('open');
  const q = useRoomRequests();
  const set = useSetRequestStatus();
  const all = q.data ?? [];
  const shown = all.filter((r) =>
    filter === 'all'
      ? true
      : filter === 'open'
        ? r.status === 'new' || r.status === 'in_progress'
        : r.status === 'done' || r.status === 'cancelled',
  );
  const filters: Filter[] = ['open', 'done', 'all'];
  const filterLabel: Record<Filter, string> = { open: D.open, done: D.done, all: D.all };

  return (
    <>
      <div className="flex gap-2">
        {filters.map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? 'secondary' : 'ghost'}
            onClick={() => setFilter(f)}
          >
            {filterLabel[f]}
          </Button>
        ))}
      </div>
      {q.isError && <p className="text-sm text-destructive">{D.error}</p>}
      {q.isSuccess && shown.length === 0 && (
        <p className="py-8 text-center text-muted-foreground">{D.noRequests}</p>
      )}
      <ul className="flex flex-col gap-3">
        {shown.map((r) => (
          <RequestCard
            key={r.id}
            r={r}
            canHandle={canHandle}
            busy={set.isPending && set.variables?.id === r.id}
            onSet={(status) => set.mutate({ id: r.id, status })}
          />
        ))}
      </ul>
    </>
  );
}

function RequestCard({
  r,
  canHandle,
  busy,
  onSet,
}: {
  r: RoomRequest;
  canHandle: boolean;
  busy: boolean;
  onSet: (status: RequestStatus) => void;
}) {
  const Icon = KIND_ICON[r.kind] ?? MessageSquare;
  const active = r.status === 'new' || r.status === 'in_progress';
  return (
    <li>
      <Card className={cn('flex flex-col gap-3 p-4', r.status === 'new' && 'border-amber-400')}>
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-muted">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold">{D.room(r.room_number)}</span>
              <Badge tone={STATUS_TONE[r.status]}>{D.status[r.status]}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {D.kind[r.kind]} · {r.guest_name}
            </p>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">{ago(r.created_at)}</span>
        </div>
        {(r.item || r.details) && (
          <div className="rounded-md bg-muted/60 p-3 text-sm">
            {r.item && (
              <p>
                <span className="text-muted-foreground">{D.needs}: </span>
                <span className="font-medium">{r.item}</span>
              </p>
            )}
            {r.details && (
              <p>
                <span className="text-muted-foreground">{D.note}: </span>
                {r.details}
              </p>
            )}
          </div>
        )}
        {canHandle && (
          <div className="flex flex-wrap gap-2">
            {r.status === 'new' && (
              <Button size="sm" disabled={busy} onClick={() => onSet('in_progress')}>
                {D.start}
              </Button>
            )}
            {active && (
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => onSet('done')}>
                <Check className="mr-1 h-4 w-4" aria-hidden />
                {D.finish}
              </Button>
            )}
            {active && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => onSet('cancelled')}>
                <X className="mr-1 h-4 w-4" aria-hidden />
                {D.cancel}
              </Button>
            )}
            {!active && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => onSet('new')}>
                <RotateCcw className="mr-1 h-4 w-4" aria-hidden />
                {D.reopen}
              </Button>
            )}
          </div>
        )}
      </Card>
    </li>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex" aria-label={t.followups.stars(value)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            'h-4 w-4',
            n <= value ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40',
          )}
          aria-hidden
        />
      ))}
    </span>
  );
}

function ReviewsTab() {
  const q = useRoomReviews();
  const reviews: RoomReview[] = q.data ?? [];
  const s = summarize(reviews);
  const parts: [string, number | null][] = [
    [D.cleanliness, s.cleanliness],
    [D.staff, s.staff],
    [D.comfort, s.comfort],
  ];
  return (
    <>
      {q.isError && <p className="text-sm text-destructive">{D.error}</p>}
      {q.isSuccess && reviews.length === 0 && (
        <p className="py-8 text-center text-muted-foreground">{D.noReviews}</p>
      )}
      {s.overall !== null && (
        <Card className="flex flex-wrap items-center gap-x-8 gap-y-3 p-4">
          <div>
            <p className="text-sm text-muted-foreground">{D.average}</p>
            <p className="text-3xl font-semibold">
              {s.overall.toFixed(1)}
              <span className="text-base font-normal text-muted-foreground"> / 5</span>
            </p>
            <p className="text-xs text-muted-foreground">{D.reviewCount(s.count)}</p>
          </div>
          <div className="flex flex-1 flex-wrap gap-x-6 gap-y-2">
            {parts.map(
              ([name, v]) =>
                v !== null && (
                  <div key={name}>
                    <p className="text-xs text-muted-foreground">{name}</p>
                    <p className="font-semibold">{v.toFixed(1)}</p>
                  </div>
                ),
            )}
          </div>
        </Card>
      )}
      <ul className="flex flex-col gap-3">
        {reviews.map((r) => (
          <li key={r.id}>
            <Card className="flex flex-col gap-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Stars value={r.rating} />
                  <span className="font-medium">{r.guest_name}</span>
                  <span className="text-sm text-muted-foreground">{D.room(r.room_number)}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(r.created_at)}
                </span>
              </div>
              {r.comment && <p className="text-sm">{r.comment}</p>}
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}

function GuideTab({ canEdit }: { canEdit: boolean }) {
  const q = useGuideSettings();
  const save = useSaveGuideSettings();
  const [form, setForm] = useState({
    wifi_name: '',
    wifi_password: '',
    checkout_time: '',
    note: '',
  });
  const [copied, setCopied] = useState(false);
  const row = q.data;
  useEffect(() => {
    if (q.isSuccess)
      setForm({
        wifi_name: row?.wifi_name ?? '',
        wifi_password: row?.wifi_password ?? '',
        checkout_time: row?.checkout_time ?? '',
        note: row?.note ?? '',
      });
  }, [q.isSuccess, row]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate({ existing: row ?? null, values: form });
  };
  const field = (k: keyof typeof form) => ({
    value: form[k],
    disabled: !canEdit,
    onChange: (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value }),
  });

  return (
    <>
      <Card className="flex flex-col gap-3 p-4">
        <p className="text-sm text-muted-foreground">{D.guideHelp}</p>
        <div>
          <Label>{D.pageLink}</Label>
          <div className="mt-1 flex gap-2">
            <Input readOnly value={GUIDE_URL} onFocus={(e) => e.currentTarget.select()} />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Copy"
              onClick={() => {
                void navigator.clipboard?.writeText(GUIDE_URL);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={GUIDE_URL} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-1 h-4 w-4" aria-hidden />
              {D.openPage}
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={CARD_URL} target="_blank" rel="noreferrer">
              <Printer className="mr-1 h-4 w-4" aria-hidden />
              {D.printCard}
            </a>
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 font-semibold">{D.guideTitle}</h2>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div>
            <Label htmlFor="wifi-name">{D.wifiName}</Label>
            <Input id="wifi-name" maxLength={60} {...field('wifi_name')} />
          </div>
          <div>
            <Label htmlFor="wifi-pass">{D.wifiPassword}</Label>
            <Input id="wifi-pass" maxLength={80} {...field('wifi_password')} />
          </div>
          <div>
            <Label htmlFor="checkout">{D.checkout}</Label>
            <Input
              id="checkout"
              maxLength={30}
              placeholder={D.checkoutHint}
              {...field('checkout_time')}
            />
          </div>
          <div>
            <Label htmlFor="note">{D.guideNote}</Label>
            <Textarea id="note" maxLength={500} {...field('note')} />
          </div>
          {canEdit ? (
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={save.isPending}>
                {D.save}
              </Button>
              {save.isSuccess && <span className="text-sm text-emerald-700">{D.saved}</span>}
              {save.isError && <span className="text-sm text-destructive">{D.saveError}</span>}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{D.readOnly}</p>
          )}
        </form>
      </Card>
    </>
  );
}

const DIETS: Diet[] = ['veg', 'nonveg', 'mixed'];
const DIET_LABEL: Record<Diet, string> = { veg: D.veg, nonveg: D.nonveg, mixed: D.mixed };

interface RestaurantForm {
  id?: string;
  name: string;
  area: string;
  cuisine: string;
  diet: Diet;
  phone: string;
  hours: string;
  menu_url: string;
  note: string;
  sort: string;
  active: boolean;
}

const blankForm = (): RestaurantForm => ({
  name: '',
  area: '',
  cuisine: '',
  diet: 'mixed',
  phone: '',
  hours: '',
  menu_url: '',
  note: '',
  sort: '100',
  active: true,
});

const toForm = (r: Restaurant): RestaurantForm => ({
  id: r.id,
  name: r.name,
  area: r.area ?? '',
  cuisine: r.cuisine ?? '',
  diet: r.diet,
  phone: r.phone ?? '',
  hours: r.hours ?? '',
  menu_url: r.menu_url ?? '',
  note: r.note ?? '',
  sort: String(r.sort),
  active: r.active,
});

function RestaurantsTab({ canEdit }: { canEdit: boolean }) {
  const q = useRestaurants();
  const save = useSaveRestaurant();
  const del = useDeleteRestaurant();
  const [form, setForm] = useState<RestaurantForm | null>(null);
  const [phoneBad, setPhoneBad] = useState(false);
  const list = q.data ?? [];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const phone = form.phone.trim() ? toE164(form.phone) : null;
    if (form.phone.trim() && !phone) {
      setPhoneBad(true);
      return;
    }
    setPhoneBad(false);
    const clean = (v: string) => (v.trim() ? v.trim() : null);
    const input: RestaurantInput = {
      id: form.id,
      name: form.name.trim(),
      area: clean(form.area),
      cuisine: clean(form.cuisine),
      diet: form.diet,
      phone,
      hours: clean(form.hours),
      menu_url: clean(form.menu_url),
      note: clean(form.note),
      sort: Number.parseInt(form.sort, 10) || 100,
      active: form.active,
    };
    save.mutate(input, { onSuccess: () => setForm(null) });
  };
  const set = (patch: Partial<RestaurantForm>) => form && setForm({ ...form, ...patch });

  return (
    <>
      <p className="text-sm text-muted-foreground">{D.restaurantsHelp}</p>
      {q.isError && <p className="text-sm text-destructive">{D.error}</p>}
      {canEdit && !form && (
        <div>
          <Button size="sm" onClick={() => setForm(blankForm())}>
            {D.addRestaurant}
          </Button>
        </div>
      )}
      {form && (
        <Card className="p-4">
          <form onSubmit={submit} className="flex flex-col gap-3">
            <div>
              <Label htmlFor="r-name">{D.restName}</Label>
              <Input
                id="r-name"
                required
                maxLength={80}
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="r-area">{D.restArea}</Label>
                <Input
                  id="r-area"
                  maxLength={120}
                  value={form.area}
                  onChange={(e) => set({ area: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="r-cuisine">{D.restCuisine}</Label>
                <Input
                  id="r-cuisine"
                  maxLength={80}
                  value={form.cuisine}
                  onChange={(e) => set({ cuisine: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="r-diet">{D.restDiet}</Label>
                <Select
                  id="r-diet"
                  value={form.diet}
                  onChange={(e) => set({ diet: e.target.value as Diet })}
                >
                  {DIETS.map((d) => (
                    <option key={d} value={d}>
                      {DIET_LABEL[d]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="r-phone">{D.restPhone}</Label>
                <Input
                  id="r-phone"
                  inputMode="tel"
                  placeholder={D.restPhoneHint}
                  value={form.phone}
                  onChange={(e) => set({ phone: e.target.value })}
                />
                {phoneBad && <p className="mt-1 text-xs text-destructive">{D.restPhoneBad}</p>}
              </div>
              <div>
                <Label htmlFor="r-hours">{D.restHours}</Label>
                <Input
                  id="r-hours"
                  maxLength={60}
                  value={form.hours}
                  onChange={(e) => set({ hours: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="r-sort">{D.restSort}</Label>
                <Input
                  id="r-sort"
                  inputMode="numeric"
                  value={form.sort}
                  onChange={(e) => set({ sort: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="r-menu">{D.restMenu}</Label>
              <Input
                id="r-menu"
                type="url"
                pattern="https://.*"
                value={form.menu_url}
                onChange={(e) => set({ menu_url: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="r-note">{D.restNote}</Label>
              <Textarea
                id="r-note"
                maxLength={200}
                value={form.note}
                onChange={(e) => set({ note: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => set({ active: e.target.checked })}
              />
              {D.restActive}
            </label>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={save.isPending}>
                {D.save}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setForm(null)}>
                {D.cancelEdit}
              </Button>
              {save.isError && <span className="text-sm text-destructive">{D.saveError}</span>}
            </div>
          </form>
        </Card>
      )}
      {q.isSuccess && list.length === 0 && (
        <p className="py-6 text-center text-muted-foreground">{D.noRestaurants}</p>
      )}
      <ul className="flex flex-col gap-3">
        {list.map((r) => (
          <li key={r.id}>
            <Card className={cn('flex flex-col gap-2 p-4', !r.active && 'opacity-60')}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{r.name}</span>
                <Badge tone={r.diet === 'veg' ? 'green' : r.diet === 'nonveg' ? 'red' : 'amber'}>
                  {DIET_LABEL[r.diet]}
                </Badge>
                {!r.active && <Badge>{D.hidden}</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">
                {[r.cuisine, r.area, r.hours].filter(Boolean).join(' · ')}
              </p>
              {r.phone && <p className="text-sm font-medium">{r.phone}</p>}
              {r.note && <p className="text-sm">{r.note}</p>}
              {canEdit && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setForm(toForm(r))}>
                    {D.editRestaurant}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={del.isPending}
                    onClick={() => {
                      if (window.confirm(D.deleteAsk)) del.mutate(r.id);
                    }}
                  >
                    {D.delete}
                  </Button>
                </div>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
