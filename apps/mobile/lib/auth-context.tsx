import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { User } from './api';
import * as api from './api';

type AuthState = {
  // undefined while the stored session is being checked.
  user: User | null | undefined;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  // use-effect-audit: ignore restores the session on launch and subscribes to the unauthorized handler of the API client
  useEffect(() => {
    const controller = new AbortController();
    api
      .currentUser()
      .then((current) => {
        if (!controller.signal.aborted) setUser(current);
      })
      // Offline at launch: stay signed out of the UI rather than hang on the splash screen.
      .catch(() => {
        if (!controller.signal.aborted) setUser(null);
      });
    api.setUnauthorizedHandler(() => setUser(null));
    return () => {
      controller.abort();
      api.setUnauthorizedHandler(null);
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setUser(await api.signIn(email, password));
  }, []);
  const signUp = useCallback(async (name: string, email: string, password: string) => {
    setUser(await api.signUp(name, email, password));
  }, []);
  const signOut = useCallback(async () => {
    await api.signOut();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, signIn, signUp, signOut }), [user, signIn, signUp, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
