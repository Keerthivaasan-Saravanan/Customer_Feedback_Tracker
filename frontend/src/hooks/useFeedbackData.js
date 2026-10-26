import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import { useApp } from "../context/AppContext.jsx";

/**
 * Generic request hook. Keeps the previous data visible while a refetch runs
 * and ignores responses that arrive after the inputs have changed.
 */
export function useRequest(fetcher, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  const key = JSON.stringify(deps);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));
    fetcher()
      .then((data) => {
        if (active) setState({ data, error: null, loading: false });
      })
      .catch((error) => {
        if (active) setState((current) => ({ data: current.data, error, loading: false }));
      });
    return () => {
      active = false;
    };
    // The key captures the dependency values; fetcher is intentionally re-read on key change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

export function useSummary() {
  const { version } = useApp();
  return useRequest(() => api.getSummary(), [version]);
}

export function useTrend(weeks = 8) {
  const { version } = useApp();
  return useRequest(() => api.getTrend(weeks), [version, weeks]);
}

export function useFeedbackRecord(id) {
  const { version } = useApp();
  return useRequest(() => api.getFeedback(id), [version, id]);
}

export function useMeta() {
  const { version } = useApp();
  return useRequest(() => api.getMeta(), [version]);
}

export function useFeedbackList(params) {
  const { version } = useApp();
  return useRequest(() => api.listFeedback(params), [version, params]);
}
