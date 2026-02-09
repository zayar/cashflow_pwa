import { useEffect, useMemo, useState } from 'react';
import { gql, useMutation, useQuery } from '@apollo/client';
import { useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '../i18n';

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
          billingAddress {
            address
          }
          shippingAddress {
            address
          }
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
  const { t } = useI18n();
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
    setBillingAddress(customer.billingAddress?.address || '');
    setShippingAddress(customer.shippingAddress?.address || '');
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
      setError(t('clientForm.customerNameRequired'));
      return;
    }

    const baseCurrencyId = businessData?.getBusiness?.baseCurrency?.id;
    if (!baseCurrencyId) {
      setError(t('clientForm.unableFetchCurrency'));
      return;
    }

    const input = {
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      billingAddress: billingAddress.trim() ? { address: billingAddress.trim() } : undefined,
      shippingAddress: shippingAddress.trim() ? { address: shippingAddress.trim() } : undefined,
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
      setError(mutationError.message || t('clientForm.failedSave'));
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
          <p style={{ marginTop: 0, marginBottom: 10, fontWeight: 800 }}>{t('clientForm.notFoundTitle')}</p>
          <p style={{ marginTop: 0, marginBottom: 14 }}>{t('clientForm.notFoundMessage')}</p>
          <button className="btn btn-secondary" type="button" onClick={() => refetchCustomer()}>
            {t('common.tryAgain')}
          </button>
        </section>
      </div>
    );
  }

  if (isEdit && (customerError || !customer)) {
    return (
      <div className="stack">
        <section className="state-error" role="alert">
          <p style={{ marginTop: 0, marginBottom: 10, fontWeight: 800 }}>{t('clientForm.couldNotLoadTitle')}</p>
          <p style={{ marginTop: 0, marginBottom: 14 }}>{customerError?.message || t('clientForm.clientNotFound')}</p>
          <button className="btn btn-secondary" type="button" onClick={() => refetchCustomer()}>
            {t('common.tryAgain')}
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="invoice-page">
      <section className="flow-banner">
        <p className="kicker">{t('clientForm.bannerKicker')}</p>
        <h2 className="title" style={{ marginBottom: 6 }}>
          {isEdit ? t('clientForm.bannerTitleEdit') : t('clientForm.bannerTitleNew')}
        </h2>
        <p className="subtle">
          {isEdit ? t('clientForm.bannerCopyEdit') : t('clientForm.bannerCopyNew')}
        </p>
      </section>

      <form className="invoice-panel" onSubmit={handleSubmit}>
        <label className="field">
          <span className="label">{t('clientForm.customerName')}</span>
          <input
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </label>

        <label className="field">
          <span className="label">{t('clientForm.email')}</span>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className="field">
          <span className="label">{t('clientForm.phone')}</span>
          <input
            className="input"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </label>

        <label className="field">
          <span className="label">{t('clientForm.billingAddressOptional')}</span>
          <textarea
            className="input"
            rows={3}
            value={billingAddress}
            onChange={(event) => setBillingAddress(event.target.value)}
          />
        </label>

        <label className="field">
          <span className="label">{t('clientForm.shippingAddressOptional')}</span>
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
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? t('common.saving') : isEdit ? t('clientForm.saveChanges') : t('clientForm.saveClient')}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ClientForm;
