'use client';

import { createContext, useCallback, useContext, useRef, ReactNode } from 'react';
import type { Tournament } from '@/types';

interface TournamentCacheContextType {
  get: (id: string) => Tournament | undefined;
  setAll: (tournaments: Tournament[]) => void;
  set: (tournament: Tournament) => void;
}

const TournamentCacheContext = createContext<TournamentCacheContextType>({
  get: () => undefined,
  setAll: () => {},
  set: () => {},
});

export function TournamentCacheProvider({ children }: { children: ReactNode }) {
  const cacheRef = useRef(new Map<string, Tournament>());

  const get = useCallback((id: string) => cacheRef.current.get(id), []);

  const setAll = useCallback((tournaments: Tournament[]) => {
    const next = new Map<string, Tournament>();
    for (const t of tournaments) next.set(t.id, t);
    cacheRef.current = next;
  }, []);

  const set = useCallback((tournament: Tournament) => {
    cacheRef.current.set(tournament.id, tournament);
  }, []);

  return (
    <TournamentCacheContext.Provider value={{ get, setAll, set }}>
      {children}
    </TournamentCacheContext.Provider>
  );
}

export function useTournamentCache() {
  return useContext(TournamentCacheContext);
}
