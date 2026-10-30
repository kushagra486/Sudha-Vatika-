import type { Role } from '@bm/shared';
import type { LucideIcon } from 'lucide-react';
import {
  BedDouble,
  CalendarCheck,
  CalendarDays,
  FileText,
  Image,
  IndianRupee,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  Package,
  PhoneCall,
  Settings,
  Sparkles,
  Users,
  UserSearch,
} from 'lucide-react';
import type { Strings } from '@/i18n/en';

export interface NavItem {
  path: string;
  labelKey: keyof Strings['nav'];
  icon: LucideIcon;
  roles: readonly Role[];
}

const ALL: readonly Role[] = ['owner', 'manager', 'sales', 'ops', 'viewer'];
const MANAGEMENT: readonly Role[] = ['owner', 'manager'];

// Access follows section 4 of the brief. The database enforces the same rules
// with RLS; hiding a link is only a convenience.
export const NAV_ITEMS: readonly NavItem[] = [
  { path: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard, roles: ALL },
  {
    path: '/leads',
    labelKey: 'leads',
    icon: UserSearch,
    roles: [...MANAGEMENT, 'sales', 'viewer'],
  },
  { path: '/calls', labelKey: 'calls', icon: PhoneCall, roles: [...MANAGEMENT, 'sales'] },
  { path: '/chats', labelKey: 'chats', icon: MessageCircle, roles: [...MANAGEMENT, 'sales'] },
  { path: '/guests', labelKey: 'guests', icon: Users, roles: [...MANAGEMENT, 'sales', 'viewer'] },
  { path: '/bookings', labelKey: 'bookings', icon: CalendarCheck, roles: ALL },
  { path: '/inventory', labelKey: 'inventory', icon: CalendarDays, roles: ALL },
  {
    path: '/payments',
    labelKey: 'payments',
    icon: IndianRupee,
    roles: [...MANAGEMENT, 'ops', 'viewer'],
  },
  {
    path: '/services',
    labelKey: 'services',
    icon: BedDouble,
    roles: [...MANAGEMENT, 'ops', 'viewer'],
  },
  {
    path: '/packages',
    labelKey: 'packages',
    icon: Package,
    roles: [...MANAGEMENT, 'ops', 'viewer'],
  },
  { path: '/media', labelKey: 'media', icon: Image, roles: [...MANAGEMENT, 'ops'] },
  { path: '/campaigns', labelKey: 'campaigns', icon: Megaphone, roles: MANAGEMENT },
  { path: '/templates', labelKey: 'templates', icon: FileText, roles: [...MANAGEMENT, 'sales'] },
  { path: '/upsell', labelKey: 'upsell', icon: Sparkles, roles: [...MANAGEMENT, 'sales'] },
  // Everyone can change their own password; owner-only sections are gated inside.
  { path: '/settings', labelKey: 'settings', icon: Settings, roles: ALL },
];

export function navItemsFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
