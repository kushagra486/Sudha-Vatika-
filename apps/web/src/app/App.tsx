import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { FullPageMessage } from '@/components/FullPageMessage';
import { isSupabaseConfigured } from '@/config';
import { t } from '@/i18n';
import { AuthProvider } from './auth';
import { router } from './router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

export function App() {
  if (!isSupabaseConfigured) return <FullPageMessage title={t.setup.title} body={t.setup.body} />;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
