import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useApolloClient } from '@apollo/client';
import { getToken } from '../lib/auth';
import {
  fetchBusinessEntitlement,
  fetchBusinessProfile,
  isProfileComplete,
  updateBusinessProfile
} from '../lib/businessProfileService';

const BusinessProfileContext = createContext({
  profile: null,
  entitlement: null,
  loading: false,
  error: '',
  loadProfile: async () => null,
  refreshProfile: async () => null,
  saveProfile: async () => null,
  profileComplete: false
});

export function BusinessProfileProvider({ children }) {
  const client = useApolloClient();
  const [profile, setProfile] = useState(null);
  const [entitlement, setEntitlement] = useState(null);
  const [profileToken, setProfileToken] = useState(() => getToken() || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadProfile = useCallback(
    async ({ force = false } = {}) => {
      const token = getToken() || '';
      if (!token) {
        setProfile(null);
        setProfileToken('');
        return null;
      }

      const tokenChanged = token !== profileToken;
      if (!force && !tokenChanged && profile) return profile;

      setLoading(true);
      setError('');
      try {
        const next = await fetchBusinessProfile(client, {
          fetchPolicy: force || tokenChanged ? 'network-only' : 'cache-first'
        });
        const nextEntitlement = await fetchBusinessEntitlement(client, {
          fetchPolicy: force || tokenChanged ? 'network-only' : 'cache-first'
        });
        setProfile(next || null);
        setEntitlement(nextEntitlement || null);
        setProfileToken(token);
        return next || null;
      } catch (err) {
        setError(err?.message || 'Failed to load business profile.');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [client, profile, profileToken]
  );

  const refreshProfile = useCallback(async () => loadProfile({ force: true }), [loadProfile]);

  const saveProfile = useCallback(
    async (updates) => {
      const token = getToken() || '';
      if (!token) return null;

      setLoading(true);
      setError('');
      try {
        const currentProfile = token === profileToken ? profile : null;
        const next = await updateBusinessProfile(client, { currentProfile, updates });
        setProfile(next || null);
        setProfileToken(token);
        const nextEntitlement = await fetchBusinessEntitlement(client, { fetchPolicy: 'network-only' });
        setEntitlement(nextEntitlement || null);
        return next || null;
      } catch (err) {
        setError(err?.message || 'Failed to update business profile.');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [client, profile, profileToken]
  );

  useEffect(() => {
    if (!getToken()) {
      setProfile(null);
      setEntitlement(null);
      setProfileToken('');
      setError('');
      return;
    }
    loadProfile().catch(() => {
      // Page-level components already render contextual errors.
    });
  }, [loadProfile]);

  const value = useMemo(
    () => ({
      profile,
      entitlement,
      loading,
      error,
      loadProfile,
      refreshProfile,
      saveProfile,
      profileComplete: isProfileComplete(profile)
    }),
    [entitlement, error, loadProfile, loading, profile, refreshProfile, saveProfile]
  );

  return <BusinessProfileContext.Provider value={value}>{children}</BusinessProfileContext.Provider>;
}

export function useBusinessProfile() {
  return useContext(BusinessProfileContext);
}
