import { useState } from 'react';
import { gql, useMutation, useQuery } from '@apollo/client';
import { useNavigate } from 'react-router-dom';

const CREATE_CUSTOMER = gql`
  mutation CreateCustomer($input: NewCustomer!) {
    createCustomer(input: $input) {
      id
      name
      email
      phone
    }
  }
`;

const GET_BUSINESS = gql`
  query GetBusiness {
    getBusiness {
      id
      baseCurrency {
        id
        name
        symbol
      }
    }
  }
`;

function ClientForm() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  
  // Fetch business to get the correct base currency ID
  const { data: businessData, loading: businessLoading } = useQuery(GET_BUSINESS);
  
  const [createCustomer, { loading: createLoading }] = useMutation(CREATE_CUSTOMER, {
    onCompleted: () => {
      navigate('/clients', { replace: true, state: { created: true } });
    },
    onError: (err) => {
      setError(err.message);
    }
  });

  const loading = createLoading || businessLoading;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    
    if (!name.trim()) {
      setError('Customer name is required');
      return;
    }

    // Get the actual base currency ID from the business data
    const baseCurrencyId = businessData?.getBusiness?.baseCurrency?.id;
    if (!baseCurrencyId) {
      setError('Unable to fetch business currency. Please try again.');
      return;
    }

    const input = {
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      // Use the actual base currency ID from business data
      currencyId: baseCurrencyId,
      customerPaymentTerms: 'DueOnReceipt'
    };

    createCustomer({ variables: { input } });
  };

  return (
    <div className="invoice-page">
      <div className="section-card">
        <h2 className="heading">New Client</h2>
        <p className="subtle">Add a new customer</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="section-card">
          <label className="field">
            <span className="label">Customer Name *</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., ABC Company"
              autoFocus
            />
          </label>

          <label className="field">
            <span className="label">Email</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@example.com"
            />
          </label>

          <label className="field">
            <span className="label">Phone</span>
            <input
              className="input"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 234 567 890"
            />
          </label>

          {error && (
            <div className="inline-error" style={{ marginTop: 12 }}>
              {error}
            </div>
          )}
        </div>

        <div className="sticky-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/clients')}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving…' : 'Save Client'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ClientForm;
