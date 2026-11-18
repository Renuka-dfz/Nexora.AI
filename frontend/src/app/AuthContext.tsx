import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  clearAccessToken,
  getAccessToken,
  getCurrentUser,
  login as loginRequest,
  register as registerRequest,
  setAccessToken,
} from "../services/api";
import type { User } from "../types/api";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const currentUser = await getCurrentUser();
    setUser(currentUser);
  }, []);

  const signOut = useCallback(() => {
    clearAccessToken();
    setUser(null);
  }, []);

  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener("nexora:unauthorized", onUnauthorized);

    if (!getAccessToken()) {
      setLoading(false);
    } else {
      void getCurrentUser()
        .then(setUser)
        .catch(() => {
          clearAccessToken();
          setUser(null);
        })
        .finally(() => setLoading(false));
    }

    return () => {
      window.removeEventListener("nexora:unauthorized", onUnauthorized);
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await loginRequest(email, password);
    setAccessToken(result.access_token);
    try {
      setUser(await getCurrentUser());
    } catch (error) {
      clearAccessToken();
      throw error;
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const result = await registerRequest(email, password);
    setAccessToken(result.access_token);
    setUser(result.user);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, signUp, signOut, refreshUser }),
    [user, loading, signIn, signUp, signOut, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
