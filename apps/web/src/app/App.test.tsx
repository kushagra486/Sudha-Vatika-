import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('shows the setup screen when Supabase env vars are missing', () => {
    render(<App />);
    expect(screen.getByText('Configuration needed')).toBeInTheDocument();
  });
});
