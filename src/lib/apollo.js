import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client';
import { onError } from '@apollo/client/link/error';
import { setContext } from '@apollo/client/link/context';
import { getToken, handleUnauthorized } from './auth';

const httpLink = new HttpLink({
  uri: '/query'
});

const errorLink = onError(({ graphQLErrors, networkError }) => {
  const knownSubscriptionCodes = new Set([
    'BUSINESS_SUBSCRIPTION_EXPIRED',
    'PLAN_UPGRADE_REQUIRED_WEB',
    'CLIENT_NOT_ALLOWED'
  ]);
  const extractCode = () => {
    for (const err of graphQLErrors || []) {
      const code = String(err?.extensions?.code || err?.message || '').trim().toUpperCase();
      if (knownSubscriptionCodes.has(code)) return code;
    }
    const networkCode = String(networkError?.result?.error || '').trim().toUpperCase();
    if (knownSubscriptionCodes.has(networkCode)) return networkCode;
    return '';
  };
  const subscriptionCode = extractCode();
  if (subscriptionCode) {
    if (typeof window !== 'undefined') {
      const target = `/subscription-access?reason=${encodeURIComponent(subscriptionCode)}`;
      if (window.location.pathname !== '/subscription-access') {
        window.location.replace(target);
      }
    }
    return;
  }

  const hasGraphQlAuthError = graphQLErrors?.some(
    (err) =>
      err?.extensions?.code === 'UNAUTHENTICATED' ||
      String(err?.message || '').toLowerCase().includes('unauthenticated') ||
      String(err?.message || '').toLowerCase().includes('not authorized')
  );
  const hasNetworkAuthError = Boolean(networkError && 'statusCode' in networkError && networkError.statusCode === 401);
  if (hasGraphQlAuthError || hasNetworkAuthError) {
    handleUnauthorized();
  }
});

const authLink = setContext((_, { headers }) => {
  const token = getToken();
  return {
    headers: {
      ...headers,
      'X-Client-App': 'pwa',
      ...(token ? { token } : {})
    }
  };
});

export function createApolloClient() {
  return new ApolloClient({
    link: from([errorLink, authLink, httpLink]),
    cache: new InMemoryCache()
  });
}
