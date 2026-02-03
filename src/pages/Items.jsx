import { useQuery, gql } from '@apollo/client';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const GET_PRODUCTS = gql`
  query GetProducts($limit: Int, $after: String) {
    paginateProduct(limit: $limit, after: $after) {
      edges {
        node {
          id
          name
          salesPrice
          sku
          isActive
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;

function Items() {
  const location = useLocation();
  const [successMsg, setSuccessMsg] = useState('');
  
  const { data, loading, error } = useQuery(GET_PRODUCTS, {
    variables: { limit: 50 },
    fetchPolicy: 'cache-and-network'
  });

  // Show success message if coming from creating a new item
  useEffect(() => {
    if (location.state?.created) {
      setSuccessMsg('Item created successfully!');
      const timer = setTimeout(() => setSuccessMsg(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [location.state]);

  const products = data?.paginateProduct?.edges?.map(edge => edge.node) || [];

  if (loading && !data) {
    return (
      <div className="card">
        <p className="subtle">Catalog</p>
        <h2 className="heading">Items</h2>
        <p className="subtle">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <p className="subtle">Catalog</p>
        <h2 className="heading">Items</h2>
        <p className="subtle" style={{ color: '#ef4444' }}>Error: {error.message}</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="card">
        <p className="subtle">Catalog</p>
        <h2 className="heading">Items</h2>
        <p className="subtle">No items yet. Tap + to add your first item.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 80 }}>
        <p className="subtle">Catalog</p>
        <h2 className="heading">Items ({products.length})</h2>
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
      
      {products.map((item) => (
        <div key={item.id} className="section-card" style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600 }}>{item.name}</div>
              {item.sku && <div className="subtle" style={{ fontSize: 12 }}>SKU: {item.sku}</div>}
            </div>
            <div style={{ fontWeight: 600, color: '#2563eb' }}>
              ${parseFloat(item.salesPrice || 0).toFixed(2)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default Items;
