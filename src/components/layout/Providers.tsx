'use client';

import { AuthProvider } from '@/hooks/useAuth';
import { ThemeProvider } from '@/hooks/useTheme';
import { TournamentCacheProvider } from '@/hooks/useTournamentCache';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <TournamentCacheProvider>
          {children}
        </TournamentCacheProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
