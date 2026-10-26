import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

const AppContext = createContext(null);
const TOAST_TIMEOUT_MS = 4500;

/**
 * Holds cross-page state: a data version (bumped after mutations so every
 * list and summary refetches) and the toast notification queue.
 */
export function AppProvider({ children }) {
  const [version, setVersion] = useState(0);
  const [toasts, setToasts] = useState([]);
  const nextToastId = useRef(1);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (tone, title, message) => {
      const id = nextToastId.current++;
      setToasts((current) => [...current, { id, tone, title, message }]);
      window.setTimeout(() => dismiss(id), TOAST_TIMEOUT_MS);
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({ version, refresh, notify, toasts, dismiss }),
    [version, refresh, notify, toasts, dismiss]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used inside AppProvider");
  }
  return context;
}
