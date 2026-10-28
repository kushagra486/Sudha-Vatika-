import { describe, expect, it } from 'vitest';
import { packageListValue, serviceLineQuantity, type Service } from './api';

const svc = (id: string, price: number, unit: Service['pricing_unit']): Service => ({
  id,
  name: id,
  category_id: null,
  description: null,
  base_price: price,
  pricing_unit: unit,
  active: true,
});

describe('packageListValue', () => {
  const services = [
    svc('veg', 500, 'per_guest'),
    svc('dj', 15000, 'fixed'),
    svc('room', 2000, 'per_day'),
  ];

  it('scales per-guest services and multiplies quantities', () => {
    const items = [
      { service_id: 'veg', quantity: 1 },
      { service_id: 'dj', quantity: 1 },
      { service_id: 'room', quantity: 3 },
    ];
    expect(packageListValue(items, services, 200, 2)).toBe(500 * 200 + 15000 + 2000 * 2 * 3);
  });

  it('ignores services that no longer exist', () => {
    expect(packageListValue([{ service_id: 'gone', quantity: 1 }], services, 10)).toBe(0);
  });
});

describe('serviceLineQuantity', () => {
  it('uses the guest count for per-guest pricing', () => {
    expect(serviceLineQuantity('per_guest', 250)).toBe(250);
    expect(serviceLineQuantity('per_guest', null)).toBe(1);
    expect(serviceLineQuantity('fixed', 250)).toBe(1);
  });
});
