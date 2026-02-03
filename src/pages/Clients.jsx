import { useQuery, gql } from '@apollo/client';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const GET_CUSTOMERS = gql`
  query GetCustomers($limit: Int, $after: String) {
    paginateCustomer(limit: $limit, after: $after) {
      edges {
        node {
          id
          name
          email
          phone
          totalOutstandingReceivable
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;

function Clients() {
  const location = useLocation();
  const [successMsg, setSuccessMsg] = useState('');
  
  const { data, loading, error } = useQuery(GET_CUSTOMERS, {
    variables: { limit: 50 },
    fetchPolicy: 'cache-and-network'
  });

  // Show success message if coming from creating a new client
  useEffect(() => {
    if (location.state?.created) {
      setSuccessMsg('Client created successfully!');
      const timer = setTimeout(() => setSuccessMsg(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [location.state]);

  const customers = data?.paginateCustomer?.edges?.map(edge => edge.node) || [];

  if (loading && !data) {
    return (
      <div className="card">
        <p className="subtle">Customers</p>
        <h2 className="heading">Clients</h2>
        <p className="subtle">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <p className="subtle">Customers</p>
        <h2 className="heading">Clients</h2>
        <p className="subtle" style={{ color: '#ef4444' }}>Error: {error.message}</p>
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <div className="card">
        <p className="subtle">Customers</p>
        <h2 className="heading">Clients</h2>
        <p className="subtle">No clients yet. Tap + to add your first client.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 80 }}>
        <p className="subtle">Customers</p>
        <h2 className="heading">Clients ({customers.length})</h2>
        {successMsg && (
          <div style={{ 
            marginTop: 8, 
            padding: '8px 12px', 
            background: '#dcfce7', 
            color: '#166534',
            borderRadius: 8,
            fontSize: 14 
          }}>
            {successMsg}
          </div>
        )}
      </div>
      
      {customers.map((client) => (
        <div key={client.id} className="section-card" style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600 }}>{client.name}</div>
              {client.email && <div className="subtle" style={{ fontSize: 12 }}>{client.email}</div>}
              {!client.email && client.phone && <div className="subtle" style={{ fontSize: 12 }}>{client.phone}</div>}
            </div>
            {client.totalOutstandingReceivable > 0 && (
              <div style={{ fontWeight: 600, color: '#ef4444' }}>
                ${parseFloat(client.totalOutstandingReceivable || 0).toFixed(2)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default Clients;
