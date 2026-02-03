import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { getToken } from './auth';

const httpLink = new HttpLink({
  uri: '/query'
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
    link: from([authLink, httpLink]),
    cache: new InMemoryCache()
  });
}
