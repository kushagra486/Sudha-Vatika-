import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewBookingDialog } from './NewBookingDialog';

const mutateAsync = vi.fn();
let createError: unknown = null;
let taken: { id: string; shift: string }[] = [];

vi.mock('./api', () => ({
  useCreateBooking: () => ({
    mutateAsync,
    reset: vi.fn(),
    get isError() {
      return createError !== null;
    },
    get error() {
      return createError;
    },
  }),
  useOrgSettings: () => ({ data: { tax_percent: 18, min_advance: 21000 } }),
  useTakenShifts: () => ({ data: taken }),
}));
vi.mock('@/features/leads/api', () => ({
  useEventSpaces: () => ({
    data: [
      { id: 'u-hall', name: 'Ashoka Hall', kind: 'hall', floating_capacity: 300, upcoming: false },
      {
        id: 'u-pandaal',
        name: 'Pandaal',
        kind: 'pandaal',
        floating_capacity: 1500,
        upcoming: false,
      },
    ],
  }),
}));
const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));

function renderDialog(prefill = {}) {
  render(
    <MemoryRouter>
      <NewBookingDialog open onOpenChange={vi.fn()} prefill={prefill} />
    </MemoryRouter>,
  );
}

describe('NewBookingDialog', () => {
  beforeEach(() => {
    mutateAsync.mockReset();
    navigate.mockReset();
    createError = null;
    taken = [];
  });

  it('books from a lead with GST added on the discounted price', async () => {
    const user = userEvent.setup();
    mutateAsync.mockResolvedValue('b-1');
    renderDialog({
      lead: { id: 'lead-1', guestName: 'Riya Sharma' },
      unitId: 'u-pandaal',
      date: '2027-02-10',
      eventType: 'Wedding',
      guestCount: 900,
    });

    expect(screen.getByText(/For Riya Sharma/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Guest phone')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Shift'), 'full_day');
    await user.type(screen.getByLabelText('Price (₹)'), '500000');
    await user.type(screen.getByLabelText('Discount (₹)'), '20000');
    await user.click(screen.getByLabelText('Add GST (18%)'));
    expect(screen.getByText('₹5,66,400')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hold the date' }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync.mock.calls[0]![0]).toEqual({
      unit_id: 'u-pandaal',
      event_date: '2027-02-10',
      shift: 'full_day',
      lead_id: 'lead-1',
      phone_e164: null,
      full_name: null,
      event_type: 'Wedding',
      guest_count: 900,
      subtotal: 500000,
      discount: 20000,
      tax: 86400,
    });
    expect(navigate).toHaveBeenCalledWith('/bookings/b-1');
  });

  it('needs a valid phone for a walk-in booking', async () => {
    const user = userEvent.setup();
    mutateAsync.mockResolvedValue('b-2');
    renderDialog({ unitId: 'u-hall', date: '2027-03-01' });

    await user.click(screen.getByRole('button', { name: 'Hold the date' }));
    expect(await screen.findByText('Enter a valid phone number')).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Guest phone'), '98765 43210');
    await user.type(screen.getByLabelText('Guest name'), 'Rotary Club');
    await user.click(screen.getByRole('button', { name: 'Hold the date' }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync.mock.calls[0]![0]).toMatchObject({
      phone_e164: '+919876543210',
      full_name: 'Rotary Club',
      lead_id: null,
      tax: 0,
    });
  });

  it('rejects a discount larger than the price', async () => {
    const user = userEvent.setup();
    renderDialog({ lead: { id: 'l', guestName: 'X' }, unitId: 'u-hall', date: '2027-03-01' });
    await user.type(screen.getByLabelText('Price (₹)'), '1000');
    await user.type(screen.getByLabelText('Discount (₹)'), '5000');
    await user.click(screen.getByRole('button', { name: 'Hold the date' }));
    expect(await screen.findByText('Discount cannot exceed the price')).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('warns about shifts already taken and explains a clash', async () => {
    const user = userEvent.setup();
    taken = [{ id: 'x', shift: 'dinner' }];
    mutateAsync.mockImplementation(async () => {
      createError = { code: '23P01' };
      throw createError;
    });
    renderDialog({ lead: { id: 'l', guestName: 'X' }, unitId: 'u-hall', date: '2027-03-01' });

    expect(screen.getByText('Already booked on this date: Dinner')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Hold the date' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('already booked');
    expect(navigate).not.toHaveBeenCalled();
  });
});
