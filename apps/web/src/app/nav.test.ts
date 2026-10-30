import { describe, expect, it } from 'vitest';
import { NAV_ITEMS, navItemsFor } from './nav';

const paths = (role: Parameters<typeof navItemsFor>[0]) => navItemsFor(role).map((i) => i.path);

describe('navItemsFor', () => {
  it('gives owners every module', () => {
    expect(paths('owner')).toHaveLength(NAV_ITEMS.length);
  });

  it('shows settings to every role (password change)', () => {
    expect(paths('viewer')).toContain('/settings');
    expect(paths('sales')).toContain('/settings');
  });

  it('matches the sales role in section 4', () => {
    expect(paths('sales')).toEqual(
      expect.arrayContaining(['/leads', '/chats', '/guests', '/bookings', '/upsell', '/templates']),
    );
    expect(paths('sales')).not.toContain('/payments');
    expect(paths('sales')).not.toContain('/media');
  });

  it('matches the ops role in section 4', () => {
    expect(paths('ops')).toEqual(
      expect.arrayContaining([
        '/bookings',
        '/inventory',
        '/payments',
        '/services',
        '/packages',
        '/media',
      ]),
    );
    expect(paths('ops')).not.toContain('/leads');
  });

  it('every item includes the dashboard roles hierarchy: owner sees all', () => {
    for (const item of NAV_ITEMS) expect(item.roles).toContain('owner');
  });
});
