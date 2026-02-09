import { gql, useMutation, useQuery } from '@apollo/client';
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n';

const LIST_BANK_ACCOUNTS = gql`
  query ListBankingAccount {
    listBankingAccount {
      listBankingAccount {
        id
        name
        detailType
        mainType
        isActive
        balance
        accountNumber
        currency {
          id
          decimalPlaces
          name
          symbol
          isActive
        }
        branches
      }
    }
  }
`;

const LIST_CURRENCIES = gql`
  query GetAllCurrencies {
    listAllCurrency {
      id
      symbol
      name
      decimalPlaces
      isActive
    }
  }
`;

const LIST_BRANCHES = gql`
  query GetAllBranches {
    listAllBranch {
      id
      name
      isActive
    }
  }
`;

const GET_BUSINESS = gql`
  query GetBusinessBaseCurrency {
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

const CREATE_ACCOUNT = gql`
  mutation CreateAccount($input: NewAccount!) {
    createAccount(input: $input) {
      id
      name
      detailType
      mainType
    }
  }
`;

function BankAccounts() {
  const { t } = useI18n();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [status, setStatus] = useState('');
  const [formError, setFormError] = useState('');
  const [name, setName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [currencyId, setCurrencyId] = useState('');
  const [errors, setErrors] = useState({});

  const {
    data: accountsData,
    loading: accountsLoading,
    error: accountsError,
    refetch: refetchAccounts
  } = useQuery(LIST_BANK_ACCOUNTS, { fetchPolicy: 'cache-first', nextFetchPolicy: 'cache-first' });

  const { data: currencyData } = useQuery(LIST_CURRENCIES, { fetchPolicy: 'cache-first', nextFetchPolicy: 'cache-first' });
  const { data: branchData } = useQuery(LIST_BRANCHES, { fetchPolicy: 'cache-first', nextFetchPolicy: 'cache-first' });
  const { data: businessData } = useQuery(GET_BUSINESS, { fetchPolicy: 'cache-first', nextFetchPolicy: 'cache-first' });

  const [createAccount, { loading: creating }] = useMutation(CREATE_ACCOUNT, {
    errorPolicy: 'all'
  });

  useEffect(() => {
    if (!status) return undefined;
    const timer = setTimeout(() => setStatus(''), 3000);
    return () => clearTimeout(timer);
  }, [status]);

  const currencies = useMemo(() => {
    return (currencyData?.listAllCurrency || []).filter((currency) => currency.isActive);
  }, [currencyData]);

  const branches = useMemo(() => {
    return (branchData?.listAllBranch || []).filter((branch) => branch.isActive);
  }, [branchData]);

  const bankAccounts = useMemo(() => {
    const rows = accountsData?.listBankingAccount?.listBankingAccount || [];
    return rows.filter((account) => account.detailType === 'Bank');
  }, [accountsData]);

  const formatBalance = (account) => {
    const amount = Number(account?.balance || 0);
    const symbol = account?.currency?.symbol || '';
    return `${symbol ? `${symbol} ` : ''}${amount.toLocaleString()}`;
  };

  const sortedCurrencies = useMemo(() => {
    if (!currencies.length) return [];
    const mmkIndex = currencies.findIndex((currency) => {
      const symbol = String(currency.symbol || '').toUpperCase();
      const name = String(currency.name || '').toLowerCase();
      return symbol === 'MMK' || name.includes('kyat');
    });
    if (mmkIndex <= 0) return currencies;
    return [currencies[mmkIndex], ...currencies.slice(0, mmkIndex), ...currencies.slice(mmkIndex + 1)];
  }, [currencies]);

  useEffect(() => {
    if (currencyId) return;
    const mmkCurrency = sortedCurrencies[0];
    const fallback = mmkCurrency?.id || businessData?.getBusiness?.baseCurrency?.id || '';
    if (fallback) setCurrencyId(String(fallback));
  }, [businessData, currencyId, sortedCurrencies]);

  const resetForm = () => {
    setName('');
    setAccountNumber('');
    setCurrencyId('');
    setErrors({});
    setFormError('');
  };

  const openSheet = () => {
    setIsSheetOpen(true);
    setFormError('');
    setErrors({});
  };

  const closeSheet = () => {
    setIsSheetOpen(false);
    resetForm();
  };

  const validate = () => {
    const nextErrors = {};
    if (!name.trim()) nextErrors.name = t('bankAccounts.accountNameRequired');
    if (!accountNumber.trim()) nextErrors.accountNumber = t('bankAccounts.accountNumberRequired');
    if (!currencyId) nextErrors.currencyId = t('bankAccounts.currencyRequired');
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    setFormError('');
    if (!validate()) return;

    if (!branches.length) {
      setFormError(t('bankAccounts.atLeastOneBranch'));
      return;
    }

    try {
      const input = {
        detailType: 'Bank',
        mainType: 'Asset',
        code: '',
        name: name.trim(),
        parentAccountId: 0,
        accountNumber: accountNumber.trim(),
        branches: branches.map((branch) => branch.name).join(' | '),
        currencyId: Number(currencyId)
      };

      await createAccount({ variables: { input } });
      setStatus(t('bankAccounts.created'));
      closeSheet();
      refetchAccounts();
    } catch (error) {
      setFormError(error?.message || t('bankAccounts.createFailed'));
    }
  };

  if (accountsLoading && !accountsData) {
    return (
      <div className="stack">
        <section className="state-loading" aria-live="polite">
          {Array.from({ length: 3 }).map((_, index) => (
            <div className="skeleton-card" key={index}>
              <div className="skeleton skeleton-line long" />
              <div className="skeleton skeleton-line short" />
            </div>
          ))}
        </section>
      </div>
    );
  }

  if (accountsError) {
    return (
      <div className="stack">
        <section className="state-error" role="alert">
          <p className="state-title">{t('bankAccounts.couldNotLoad')}</p>
          <p className="state-message">{accountsError.message}</p>
          <div className="state-actions">
            <button className="btn btn-secondary" type="button" onClick={() => refetchAccounts()}>
              {t('common.tryAgain')}
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="stack">
      <section className="card">
        <div className="card-header">
          <div>
            <p className="kicker">{t('bankAccounts.kicker')}</p>
            <h2 className="title">{t('bankAccounts.title')}</h2>
            <p className="subtle" style={{ marginTop: 4 }}>
              {t('bankAccounts.subtitle')}
            </p>
          </div>
          <button className="btn btn-primary" type="button" onClick={openSheet}>
            {t('bankAccounts.addBank')}
          </button>
        </div>

        <div className="toolbar" style={{ justifyContent: 'space-between' }}>
          <span className="subtle">{t('bankAccounts.count', { count: bankAccounts.length })}</span>
          <button className="btn btn-secondary" type="button" onClick={() => refetchAccounts()}>
            {t('common.refresh')}
          </button>
        </div>

        {status && <div className="toast" style={{ marginTop: 10 }}>{status}</div>}
      </section>

      {bankAccounts.length === 0 && (
        <section className="state-empty" role="status">
          <p className="state-title">{t('bankAccounts.noAccountsTitle')}</p>
          <p className="state-message">{t('bankAccounts.noAccountsMessage')}</p>
          <div className="state-actions">
            <button className="btn btn-primary" type="button" onClick={openSheet}>
              {t('bankAccounts.addBankAccount')}
            </button>
          </div>
        </section>
      )}

      {bankAccounts.length > 0 && (
        <ul className="list" aria-live="polite">
          {bankAccounts.map((account) => (
            <li key={account.id} className="list-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 800 }}>{account.name}</p>
                  <p className="subtle" style={{ marginTop: 4, marginBottom: 0 }}>
                    {account.accountNumber || t('bankAccounts.noAccountNumber')}
                  </p>
                  <div className="list-meta" style={{ marginTop: 8 }}>
                    {account.currency?.symbol && (
                      <span className="meta-chip">
                        {account.currency.name} ({account.currency.symbol})
                      </span>
                    )}
                    {account.isActive === false && <span className="meta-chip">{t('bankAccounts.inactive')}</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="meta-chip">{t('bankAccounts.bank')}</span>
                  <p className="bank-balance">{formatBalance(account)}</p>
                  <p className="bank-caption">{t('bankAccounts.availableBalance')}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className={`sheet-backdrop ${isSheetOpen ? 'open' : ''}`} onClick={closeSheet} />
      <section
        className={`sheet ${isSheetOpen ? 'open' : ''}`}
        aria-hidden={!isSheetOpen}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-header">
          <h3 className="title" style={{ margin: 0 }}>
            {t('bankAccounts.newBankTitle')}
          </h3>
          <button className="btn btn-secondary" type="button" onClick={closeSheet}>
            {t('common.close')}
          </button>
        </div>

        <div className="form-grid">
          <p className="subtle" style={{ marginTop: 0 }}>
            {t('bankAccounts.newBankSubtitle')}
          </p>
          <label className="field">
            <span className="label">{t('bankAccounts.accountName')}</span>
            <input
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. KBZ Savings"
            />
            {errors.name && <div className="inline-error">{errors.name}</div>}
          </label>

          <label className="field">
            <span className="label">{t('bankAccounts.accountNumber')}</span>
            <input
              className="input"
              value={accountNumber}
              onChange={(event) => setAccountNumber(event.target.value)}
              placeholder={t('bankAccounts.accountNumberPlaceholder')}
            />
            {errors.accountNumber && <div className="inline-error">{errors.accountNumber}</div>}
          </label>

          <label className="field">
            <span className="label">{t('bankAccounts.currency')}</span>
            <select
              className="input"
              value={currencyId}
              onChange={(event) => setCurrencyId(event.target.value)}
            >
              <option value="">{t('bankAccounts.selectCurrency')}</option>
              {sortedCurrencies.map((currency) => (
                <option key={currency.id} value={currency.id}>
                  {currency.name} ({currency.symbol})
                </option>
              ))}
            </select>
            {errors.currencyId && <div className="inline-error">{errors.currencyId}</div>}
          </label>

          {formError && <div className="state-error" role="alert">{formError}</div>}

          <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" type="button" onClick={closeSheet} disabled={creating}>
              {t('common.cancel')}
            </button>
            <button className="btn btn-primary" type="button" onClick={handleSubmit} disabled={creating}>
              {creating ? t('common.saving') : t('bankAccounts.saveBankAccount')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default BankAccounts;
