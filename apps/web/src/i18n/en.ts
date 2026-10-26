// All UI strings live here so Hindi (hi.ts) can be added with the same keys.

export const en = {
  common: {
    loading: 'Loading…',
    signOut: 'Sign out',
    comingSoon: 'This module is being built.',
    backToDashboard: 'Back to dashboard',
    menu: 'Menu',
    closeMenu: 'Close menu',
  },
  nav: {
    dashboard: 'Dashboard',
    leads: 'Leads',
    chats: 'Chats',
    guests: 'Guests',
    bookings: 'Bookings',
    inventory: 'Inventory',
    payments: 'Payments',
    services: 'Services',
    packages: 'Packages',
    media: 'Media',
    campaigns: 'Campaigns',
    templates: 'Templates',
    upsell: 'Upsell',
    settings: 'Settings',
  },
  auth: {
    title: 'Sign in',
    subtitle: 'We will email you a sign-in link.',
    emailLabel: 'Work email',
    emailPlaceholder: 'you@example.com',
    submit: 'Send sign-in link',
    sending: 'Sending…',
    sent: 'Check your inbox for the sign-in link.',
    invalidEmail: 'Enter a valid email address',
    noProfileTitle: 'Account not set up',
    noProfileBody:
      'You are signed in, but your account is not linked to an organization yet. Ask your owner or manager to add you.',
  },
  setup: {
    title: 'Configuration needed',
    body: 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file, then restart the dev server. See README.md.',
  },
  notFound: {
    title: 'Page not found',
  },
  leadSources: {
    call: 'Phone call',
    whatsapp: 'WhatsApp',
    web: 'Website',
    walk_in: 'Office visit',
    manual: 'Other',
    instagram: 'Instagram',
    referral: 'Word of mouth',
  },
  roles: {
    owner: 'Owner',
    manager: 'Manager',
    sales: 'Sales',
    ops: 'Operations',
    viewer: 'Viewer',
  },
} as const;

export type Strings = typeof en;
