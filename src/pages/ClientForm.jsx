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
  const [billingAddress, setBillingAddress] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [error, setError] = useState('');

  const { data: businessData, loading: businessLoading } = useQuery(GET_BUSINESS);

  const [createCustomer, { loading: createLoading }] = useMutation(CREATE_CUSTOMER, {
    onCompleted: () => {
      navigate('/clients', { replace: true, state: { created: true } });
    },
    onError: (mutationError) => {
      setError(mutationError.message);
    }
  });

  const loading = createLoading || businessLoading;

  const handleSubmit = (event) => {
    event.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Customer name is required.');
      return;
    }

    const baseCurrencyId = businessData?.getBusiness?.baseCurrency?.id;
    if (!baseCurrencyId) {
      setError('Unable to fetch business currency. Please try again.');
      return;
    }

    const input = {
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      billingAddress: billingAddress.trim() || undefined,
      shippingAddress: shippingAddress.trim() || undefined,
      currencyId: baseCurrencyId,
      customerPaymentTerms: 'DueOnReceipt'
    };

    createCustomer({ variables: { input } });
  };

  return (
    <div className="invoice-page">
      <section className="flow-banner">
        <p className="kicker">Customers</p>
        <h2 className="title" style={{ marginBottom: 6 }}>
          Add a new client
        </h2>
        <p className="subtle">Create a customer profile so invoicing takes only a few taps.</p>
      </section>

      <form className="invoice-panel" onSubmit={handleSubmit}>
        <label className="field">
          <span className="label">Customer name *</span>
          <input
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </label>

        <label className="field">
          <span className="label">Email</span>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className="field">
          <span className="label">Phone</span>
          <input
            className="input"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </label>

        <label className="field">
          <span className="label">Billing address (optional)</span>
          <textarea
            className="input"
            rows={3}
            value={billingAddress}
            onChange={(event) => setBillingAddress(event.target.value)}
          />
        </label>

        <label className="field">
          <span className="label">Shipping address (optional)</span>
          <textarea
            className="input"
            rows={3}
            value={shippingAddress}
            onChange={(event) => setShippingAddress(event.target.value)}
          />
        </label>

        {error && <div className="inline-error">{error}</div>}

        <div className="sticky-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/clients')}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving...' : 'Save client'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ClientForm;
