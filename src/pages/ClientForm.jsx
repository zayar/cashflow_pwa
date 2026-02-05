import { useEffect, useMemo, useState } from 'react';
import { gql, useMutation, useQuery } from '@apollo/client';
import { useNavigate, useParams } from 'react-router-dom';

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

const UPDATE_CUSTOMER = gql`
  mutation UpdateCustomer($id: ID!, $input: NewCustomer!) {
    updateCustomer(id: $id, input: $input) {
      id
      name
      email
      phone
    }
  }
`;

const FIND_CUSTOMER = gql`
  query FindCustomer($limit: Int = 80) {
    paginateCustomer(limit: $limit) {
      edges {
        node {
          id
          name
          email
          phone
          billingAddress
          shippingAddress
        }
      }
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
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [limit, setLimit] = useState(80);
  const [isHydrated, setIsHydrated] = useState(!isEdit);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [error, setError] = useState('');

  const { data: businessData, loading: businessLoading } = useQuery(GET_BUSINESS);
  const {
    data: customerData,
    loading: customerLoading,
    error: customerError,
    refetch: refetchCustomer
  } = useQuery(FIND_CUSTOMER, {
    skip: !isEdit,
    variables: { limit },
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all'
  });

  const [createCustomer, createState] = useMutation(CREATE_CUSTOMER);
  const [updateCustomer, updateState] = useMutation(UPDATE_CUSTOMER);

  const customer = useMemo(() => {
    const edges = customerData?.paginateCustomer?.edges ?? [];
    const match = edges.find((edge) => String(edge?.node?.id || '') === String(id || ''));
    return match?.node || null;
  }, [customerData, id]);

  useEffect(() => {
    if (!isEdit || isHydrated || !customer) return;
    setName(customer.name || '');
    setEmail(customer.email || '');
    setPhone(customer.phone || '');
    setBillingAddress(customer.billingAddress || '');
    setShippingAddress(customer.shippingAddress || '');
    setIsHydrated(true);
  }, [customer, isEdit, isHydrated]);

  useEffect(() => {
    if (!isEdit || customerLoading || customerError) return;
    if (!customer && limit < 640) {
      setLimit((prev) => Math.min(prev * 2, 640));
    }
  }, [customer, customerError, customerLoading, isEdit, limit]);

  const saving = createState.loading || updateState.loading;
  const loading = saving || businessLoading;

  const handleSubmit = async (event) => {
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

    try {
      if (isEdit) {
        await updateCustomer({ variables: { id, input } });
        navigate(`/clients/${id}`, { replace: true, state: { updated: true } });
      } else {
        await createCustomer({ variables: { input } });
        navigate('/clients', { replace: true, state: { created: true } });
      }
    } catch (mutationError) {
      setError(mutationError.message || 'Failed to save client.');
    }
  };

  if (isEdit && ((customerLoading && !customerData) || (customer && !isHydrated))) {
    return (
      <div className="stack">
        <section className="state-loading" aria-live="polite">
          <div className="skeleton-card">
            <div className="skeleton skeleton-line long" />
            <div className="skeleton skeleton-line short" />
          </div>
          <div className="skeleton-card">
            <div className="skeleton skeleton-line long" />
            <div className="skeleton skeleton-line short" />
          </div>
        </section>
      </div>
    );
  }

  if (isEdit && !customerLoading && !customerError && !customer) {
    return (
      <div className="stack">
        <section className="state-empty" role="status">
          <p style={{ marginTop: 0, marginBottom: 10, fontWeight: 800 }}>Client not found in recent clients.</p>
          <p style={{ marginTop: 0, marginBottom: 14 }}>Return to clients and refresh, then try again.</p>
          <button className="btn btn-secondary" type="button" onClick={() => refetchCustomer()}>
            Try again
          </button>
        </section>
      </div>
    );
  }

  if (isEdit && (customerError || !customer)) {
    return (
      <div className="stack">
        <section className="state-error" role="alert">
          <p style={{ marginTop: 0, marginBottom: 10, fontWeight: 800 }}>Could not load this client.</p>
          <p style={{ marginTop: 0, marginBottom: 14 }}>{customerError?.message || 'Client not found.'}</p>
          <button className="btn btn-secondary" type="button" onClick={() => refetchCustomer()}>
            Try again
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="invoice-page">
      <section className="flow-banner">
        <p className="kicker">Customers</p>
        <h2 className="title" style={{ marginBottom: 6 }}>
          {isEdit ? 'Edit client' : 'Add a new client'}
        </h2>
        <p className="subtle">
          {isEdit ? 'Update customer details for this client.' : 'Create a customer profile so invoicing takes only a few taps.'}
        </p>
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
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate(isEdit ? `/clients/${id}` : '/clients')}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving...' : isEdit ? 'Save changes' : 'Save client'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ClientForm;
