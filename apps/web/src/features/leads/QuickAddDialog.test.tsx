import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuickAddDialog } from './QuickAddDialog';

const mutateAsync = vi.fn();
let existingGuest: { id: string; full_name: string | null; openLeadIds: string[] } | null = null;

vi.mock('./api', () => ({
  useCreateEnquiry: () => ({ mutateAsync, isError: false, reset: vi.fn() }),
  useEventSpaces: () => ({
    data: [
      {
        id: 'u-pandaal',
        name: 'Pandaal',
        kind: 'pandaal',
        floating_capacity: 1500,
        upcoming: false,
      },
      { id: 'u-pool', name: 'Pool', kind: 'pool', floating_capacity: null, upcoming: true },
    ],
  }),
  useGuestByPhone: (phone: string | null) => ({ data: phone ? existingGuest : null }),
}));

const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));

function renderDialog() {
  const onOpenChange = vi.fn();
  render(
    <MemoryRouter>
      <QuickAddDialog open onOpenChange={onOpenChange} />
    </MemoryRouter>,
  );
  return { onOpenChange };
}

describe('QuickAddDialog', () => {
  beforeEach(() => {
    mutateAsync.mockReset();
    navigate.mockReset();
    existingGuest = null;
  });

  it('needs only a valid phone number', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: 'Save enquiry' }));
    expect(await screen.findByText('Enter a valid phone number')).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();

    mutateAsync.mockResolvedValue('lead-1');
    await user.type(screen.getByLabelText('Phone number'), '98765 43210');
    await user.click(screen.getByRole('button', { name: 'Save enquiry' }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith({
      phone_e164: '+919876543210',
      full_name: null,
      source: 'call',
      event_type: null,
      event_date: null,
      guest_count: null,
      preferred_unit_id: null,
      next_follow_up_at: null,
      note: null,
    });
    expect(navigate).toHaveBeenCalledWith('/leads/lead-1');
  });

  it('sends every filled field, with the follow-up in IST', async () => {
    const user = userEvent.setup();
    mutateAsync.mockResolvedValue('lead-2');
    renderDialog();

    await user.type(screen.getByLabelText('Phone number'), '+91 98111 22233');
    await user.type(screen.getByLabelText('Name'), '  Riya Sharma ');
    await user.selectOptions(screen.getByLabelText('How did they reach us?'), 'referral');
    await user.type(screen.getByLabelText('Event type'), 'Wedding');
    await user.type(screen.getByLabelText('Event date'), '2027-02-10');
    await user.type(screen.getByLabelText('Guests'), '900');
    await user.selectOptions(screen.getByLabelText('Preferred space'), 'u-pandaal');
    await user.type(screen.getByLabelText('Next follow-up'), '2026-10-28T11:30');
    await user.type(screen.getByLabelText('Call notes'), 'Wants veg menu');
    await user.click(screen.getByRole('button', { name: 'Save enquiry' }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync.mock.calls[0]![0]).toEqual({
      phone_e164: '+919811122233',
      full_name: 'Riya Sharma',
      source: 'referral',
      event_type: 'Wedding',
      event_date: '2027-02-10',
      guest_count: 900,
      preferred_unit_id: 'u-pandaal',
      next_follow_up_at: '2026-10-28T11:30:00+05:30',
      note: 'Wants veg menu',
    });
  });

  it('marks upcoming spaces', () => {
    renderDialog();
    expect(screen.getByRole('option', { name: 'Pool (Opening soon)' })).toBeInTheDocument();
  });

  it('warns when the caller is already a guest with open enquiries', async () => {
    const user = userEvent.setup();
    existingGuest = { id: 'g1', full_name: 'Aman Gupta', openLeadIds: ['lead-9'] };
    renderDialog();

    await user.type(screen.getByLabelText('Phone number'), '9822222222');
    expect(
      await screen.findByText(/Aman Gupta is already a guest with 1 open enquiry/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View' })).toHaveAttribute('href', '/leads/lead-9');
  });

  it('keeps the form open when saving fails', async () => {
    const user = userEvent.setup();
    mutateAsync.mockRejectedValue(new Error('offline'));
    const { onOpenChange } = renderDialog();

    await user.type(screen.getByLabelText('Phone number'), '9876543210');
    await user.click(screen.getByRole('button', { name: 'Save enquiry' }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(navigate).not.toHaveBeenCalled();
  });
});
