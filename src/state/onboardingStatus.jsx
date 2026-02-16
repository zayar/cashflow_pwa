import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getToken } from '../lib/auth';
import { getOnboardingStatus, updateOnboardingStatus } from '../lib/onboardingApi';

const OnboardingStatusContext = createContext({
  status: { step: 0, completed: false },
  loading: false,
  error: '',
  refreshStatus: async () => {},
  saveStatus: async () => {}
});

export function OnboardingStatusProvider({ children }) {
  const [status, setStatus] = useState({ step: 0, completed: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tokenSnapshot, setTokenSnapshot] = useState(() => getToken() || '');

  const refreshStatus = useCallback(async () => {
    const token = getToken() || '';
    if (!token) {
      setStatus({ step: 0, completed: false });
      setTokenSnapshot('');
      return { step: 0, completed: false };
    }
    setLoading(true);
    setError('');
    try {
      const payload = await getOnboardingStatus();
      setStatus({
        step: Number.isFinite(payload?.step) ? payload.step : 0,
        completed: Boolean(payload?.completed)
      });
      setTokenSnapshot(token);
      return payload;
    } catch (err) {
      setError(err?.message || 'Failed to load onboarding status.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const saveStatus = useCallback(async ({ step, completed }) => {
    const token = getToken() || '';
    if (!token) return null;
    setLoading(true);
    setError('');
    try {
      const payload = await updateOnboardingStatus({
        step: Number.isFinite(step) ? step : status.step,
        completed: typeof completed === 'boolean' ? completed : status.completed
      });
      setStatus({
        step: Number.isFinite(payload?.step) ? payload.step : status.step,
        completed: Boolean(payload?.completed)
      });
      setTokenSnapshot(token);
      return payload;
    } catch (err) {
      setError(err?.message || 'Failed to save onboarding progress.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    if (!getToken()) {
      setStatus({ step: 0, completed: false });
      setTokenSnapshot('');
      setError('');
      return;
    }
    // Only auto-load once per token change.
    const token = getToken() || '';
    if (token !== tokenSnapshot) {
      refreshStatus().catch(() => {});
    }
  }, [refreshStatus, tokenSnapshot]);

  const value = useMemo(
    () => ({
      status,
      loading,
      error,
      refreshStatus,
      saveStatus
    }),
    [error, loading, refreshStatus, saveStatus, status]
  );

  return <OnboardingStatusContext.Provider value={value}>{children}</OnboardingStatusContext.Provider>;
}

export function useOnboardingStatus() {
  return useContext(OnboardingStatusContext);
}
