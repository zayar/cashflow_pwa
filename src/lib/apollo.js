import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client';
import { onError } from '@apollo/client/link/error';
import { setContext } from '@apollo/client/link/context';
import { getToken, handleUnauthorized } from './auth';

const httpLink = new HttpLink({
  uri: '/query'
});

const errorLink = onError(({ graphQLErrors, networkError }) => {
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
