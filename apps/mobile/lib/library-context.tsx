import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { isInFlight } from '@/components/status';
import { listLibrary, type RenderView } from './api';
import { useAuth } from './auth-context';

type LibraryState = {
  renders: RenderView[];
  balance: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  upsert: (render: RenderView) => void;
};

const LibraryContext = createContext<LibraryState | null>(null);
const POLL_MS = 5000;

// The signed-in user's catalog and credit balance, shared by the tabs and the detail screen.
export function LibraryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [renders, setRenders] = useState<RenderView[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const data = await listLibrary();
      setRenders(data.renders);
      setBalance(data.balance);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load your library');
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, []);

  // use-effect-audit: ignore loads the library when the signed-in user changes; the mobile app has no query library
  useEffect(() => {
    if (!user) {
      setRenders([]);
      setBalance(0);
      return;
    }
    setLoading(true);
    void refresh();
  }, [user, refresh]);

  const inFlight = renders.some(isInFlight);
  // use-effect-audit: ignore timer that polls the library while a render is in flight
  useEffect(() => {
    if (!user || !inFlight) return;
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [user, inFlight, refresh]);

  const upsert = useCallback((render: RenderView) => {
    setRenders((current) =>
      current.some((item) => item.id === render.id)
        ? current.map((item) => (item.id === render.id ? render : item))
        : [render, ...current],
    );
  }, []);

  const value = useMemo(
    () => ({ renders, balance, loading, error, refresh, upsert }),
    [renders, balance, loading, error, refresh, upsert],
  );
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryState {
  const value = useContext(LibraryContext);
  if (!value) throw new Error('useLibrary must be used inside <LibraryProvider>');
  return value;
}
