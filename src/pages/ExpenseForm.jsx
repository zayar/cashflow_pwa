import { gql, useMutation, useQuery } from '@apollo/client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/Modal';
import QuickAddCustomer from '../components/QuickAddCustomer';
import { useI18n } from '../i18n';
import { getDefaultInvoiceCurrencyId, getDefaultInvoiceLocationIds } from '../lib/auth';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { completeUpload, resolveStorageAccessUrl, signUpload, uploadToSignedUrl } from '../lib/uploadApi';

const GET_BUSINESS = gql`
  query GetBusinessForExpense {
    getBusiness {
      id
      baseCurrency {
        id
        name
        symbol
        decimalPlaces
      }
    }
  }
`;

const LIST_BRANCHES = gql`
  query ListAllBranchForExpense {
    listAllBranch {
      id
      name
      isActive
    }
  }
`;

const LIST_CURRENCIES = gql`
  query ListAllCurrencyForExpense {
    listAllCurrency {
      id
      symbol
      name
      decimalPlaces
      isActive
    }
  }
`;

const LIST_ACCOUNTS = gql`
  query ListAllAccountForExpense {
    listAllAccount {
      id
      detailType
      mainType
      name
      code
      isActive
      currency {
        id
        name
        symbol
        decimalPlaces
      }
    }
  }
`;

const LIST_TAXES = gql`
  query ListAllTaxForExpense {
    listAllTax {
      id
      name
      rate
      isActive
    }
  }
`;

const LIST_TAX_GROUPS = gql`
  query ListAllTaxGroupForExpense {
    listAllTaxGroup {
      id
      name
      rate
      isActive
    }
  }
`;

const LIST_CUSTOMERS = gql`
  query ListCustomersForExpense($name: String) {
    listCustomer(name: $name) {
      id
      name
    }
  }
`;

const PAGINATE_SUPPLIERS = gql`
  query PaginateSupplierForExpense($limit: Int = 20, $after: String, $name: String, $isActive: Boolean) {
    paginateSupplier(limit: $limit, after: $after, name: $name, isActive: $isActive) {
      edges {
        cursor
        node {
          id
          name
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;

const CREATE_SUPPLIER = gql`
  mutation QuickAddSupplier($input: NewSupplier!) {
    createSupplier(input: $input) {
      id
      name
    }
  }
`;

const CREATE_EXPENSE = gql`
  mutation CreateExpenseForPwa($input: NewExpense!) {
    createExpense(input: $input) {
      id
    }
  }
`;

const UPDATE_EXPENSE = gql`
  mutation UpdateExpenseForPwa($id: ID!, $input: NewExpense!) {
    updateExpense(id: $id, input: $input) {
      id
    }
  }
`;

function toIsoDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function toPositiveInt(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.trunc(number);
}

function extractFilename(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const withoutQuery = raw.split('?')[0] || raw;
  const parts = withoutQuery.split('/').filter(Boolean);
  return parts[parts.length - 1] || raw;
}

function parseTaxSelection(selection) {
  const raw = String(selection || '').trim();
  if (!raw) return { taxType: 'I', taxId: 0 };
  const taxType = raw.startsWith('G') ? 'G' : 'I';
  const taxId = toPositiveInt(raw.replace(/[IG]/g, ''));
  return { taxType, taxId };
}

function ExpenseForm({ mode = 'create', expense = null }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const isEdit = mode === 'edit';

  const [status, setStatus] = useState('');
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const [showMore, setShowMore] = useState(false);
  const [showBranchPicker, setShowBranchPicker] = useState(false);
  const [showExpenseAccountPicker, setShowExpenseAccountPicker] = useState(false);
  const [showPaidThroughPicker, setShowPaidThroughPicker] = useState(false);
  const [showSupplierPicker, setShowSupplierPicker] = useState(false);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showQuickAddSupplier, setShowQuickAddSupplier] = useState(false);
  const [showQuickAddCustomer, setShowQuickAddCustomer] = useState(false);

  const [branchId, setBranchId] = useState(() => toPositiveInt(expense?.branch?.id) || getDefaultInvoiceLocationIds().branchId);
  const [expenseAccountId, setExpenseAccountId] = useState(() => toPositiveInt(expense?.expenseAccount?.id));
  const [paidThroughId, setPaidThroughId] = useState(() => toPositiveInt(expense?.assetAccount?.id));
  const [supplier, setSupplier] = useState(() => (expense?.supplier?.id ? expense.supplier : null));
  const [customer, setCustomer] = useState(() => (expense?.customer?.id ? expense.customer : null));

  const [expenseDate, setExpenseDate] = useState(() => toIsoDate(expense?.expenseDate) || toIsoDate(new Date()));
  const [amount, setAmount] = useState(() => (expense?.amount != null ? String(expense.amount) : ''));
  const [bankCharges, setBankCharges] = useState(() => (expense?.bankCharges != null ? String(expense.bankCharges) : ''));
  const [referenceNumber, setReferenceNumber] = useState(() => String(expense?.referenceNumber || ''));
  const [notes, setNotes] = useState(() => String(expense?.notes || ''));

  const [currencyId, setCurrencyId] = useState(() => toPositiveInt(expense?.currency?.id) || 0);
  const [exchangeRate, setExchangeRate] = useState(() => (expense?.exchangeRate != null ? String(expense.exchangeRate) : ''));

  const [taxSelection, setTaxSelection] = useState(() => String(expense?.expenseTax?.id || ''));
  const [isTaxInclusive, setIsTaxInclusive] = useState(() => Boolean(expense?.isTaxInclusive));

  const fileInputRef = useRef(null);
  const [attachments, setAttachments] = useState(() => {
    const docs = expense?.documents ?? [];
    return docs
      .filter((d) => d?.documentUrl)
      .map((d) => ({
        id: d.id || '',
        objectKey: d.documentUrl,
        name: extractFilename(d.documentUrl) || 'Attachment',
        mimeType: ''
      }));
  });
  const [uploading, setUploading] = useState(false);

  const { data: businessData } = useQuery(GET_BUSINESS, { fetchPolicy: 'cache-first', nextFetchPolicy: 'cache-first' });
  const { data: branchData } = useQuery(LIST_BRANCHES, { fetchPolicy: 'cache-first', nextFetchPolicy: 'cache-first' });
  const { data: currencyData } = useQuery(LIST_CURRENCIES, { fetchPolicy: 'cache-first', nextFetchPolicy: 'cache-first' });
  const { data: accountData } = useQuery(LIST_ACCOUNTS, { fetchPolicy: 'cache-first', nextFetchPolicy: 'cache-first' });
  const { data: taxData } = useQuery(LIST_TAXES, { fetchPolicy: 'cache-first', nextFetchPolicy: 'cache-first' });
  const { data: taxGroupData } = useQuery(LIST_TAX_GROUPS, { fetchPolicy: 'cache-first', nextFetchPolicy: 'cache-first' });

  const baseCurrency = businessData?.getBusiness?.baseCurrency;
  const baseCurrencyId = toPositiveInt(baseCurrency?.id) || toPositiveInt(getDefaultInvoiceCurrencyId());

  const branches = useMemo(() => (branchData?.listAllBranch ?? []).filter((b) => b?.isActive !== false), [branchData]);
  const currencies = useMemo(() => (currencyData?.listAllCurrency ?? []).filter((c) => c?.isActive !== false), [currencyData]);
  const accounts = useMemo(() => (accountData?.listAllAccount ?? []).filter((a) => a?.isActive !== false), [accountData]);

  const expenseAccounts = useMemo(() => accounts.filter((a) => String(a?.mainType || '').toLowerCase() === 'expense'), [accounts]);
  const paymentAccounts = useMemo(
    () => accounts.filter((a) => ['bank', 'cash'].includes(String(a?.detailType || '').toLowerCase())),
    [accounts]
  );

  const selectedBranch = useMemo(() => branches.find((b) => toPositiveInt(b.id) === toPositiveInt(branchId)), [branches, branchId]);
  const selectedExpenseAccount = useMemo(
    () => expenseAccounts.find((a) => toPositiveInt(a.id) === toPositiveInt(expenseAccountId)),
    [expenseAccounts, expenseAccountId]
  );
  const selectedPaidThrough = useMemo(
    () => paymentAccounts.find((a) => toPositiveInt(a.id) === toPositiveInt(paidThroughId)),
    [paymentAccounts, paidThroughId]
  );

  useEffect(() => {
    if (currencyId) return;
    const next = toPositiveInt(expense?.currency?.id) || baseCurrencyId;
    if (next) setCurrencyId(next);
  }, [baseCurrencyId, currencyId, expense?.currency?.id]);

  useEffect(() => {
    if (!branches.length) return;
    if (selectedBranch) return;
    const fallback = branches[0];
    if (fallback?.id) setBranchId(toPositiveInt(fallback.id));
  }, [branches, selectedBranch]);

  useEffect(() => {
    if (!status) return undefined;
    const timer = setTimeout(() => setStatus(''), 3000);
    return () => clearTimeout(timer);
  }, [status]);

  const [createExpense, createState] = useMutation(CREATE_EXPENSE);
  const [updateExpense, updateState] = useMutation(UPDATE_EXPENSE);
  const saving = createState.loading || updateState.loading;

  const [supplierSearch, setSupplierSearch] = useState('');
  const supplierDebounced = useDebouncedValue(supplierSearch, 250);
  const supplierQuery = useQuery(PAGINATE_SUPPLIERS, {
    variables: { limit: 20, after: undefined, name: '', isActive: true },
    fetchPolicy: 'cache-and-network',
    skip: !showSupplierPicker
  });
  useEffect(() => {
    if (!showSupplierPicker) return;
    supplierQuery.refetch({ limit: 20, after: undefined, name: supplierDebounced || '', isActive: true });
  }, [showSupplierPicker, supplierDebounced]); // eslint-disable-line react-hooks/exhaustive-deps
  const suppliers = useMemo(
    () => supplierQuery.data?.paginateSupplier?.edges?.map((edge) => edge?.node).filter(Boolean) ?? [],
    [supplierQuery.data]
  );

  const [customerSearch, setCustomerSearch] = useState('');
  const customerDebounced = useDebouncedValue(customerSearch, 250);
  const customerQuery = useQuery(LIST_CUSTOMERS, {
    variables: { name: '' },
    fetchPolicy: 'cache-and-network',
    skip: !showCustomerPicker
  });
  useEffect(() => {
    if (!showCustomerPicker) return;
    customerQuery.refetch({ name: customerDebounced || '' });
  }, [showCustomerPicker, customerDebounced]); // eslint-disable-line react-hooks/exhaustive-deps
  const customers = useMemo(() => customerQuery.data?.listCustomer ?? [], [customerQuery.data]);

  const [createSupplier, createSupplierState] = useMutation(CREATE_SUPPLIER);

  const taxOptions = useMemo(() => {
    const taxes = (taxData?.listAllTax ?? []).filter((tax) => tax?.isActive !== false).map((tax) => ({ ...tax, id: `I${tax.id}` }));
    const groups = (taxGroupData?.listAllTaxGroup ?? [])
      .filter((group) => group?.isActive !== false)
      .map((group) => ({ ...group, id: `G${group.id}` }));
    return [
      { title: t('expenseForm.tax.single'), items: taxes },
      { title: t('expenseForm.tax.group'), items: groups }
    ];
  }, [taxData, taxGroupData, t]);

  const selectedCurrency = useMemo(() => {
    const fromList = currencies.find((c) => toPositiveInt(c.id) === toPositiveInt(currencyId));
    if (fromList) return fromList;
    if (baseCurrencyId && toPositiveInt(baseCurrency?.id) === baseCurrencyId) return baseCurrency;
    return fromList || baseCurrency;
  }, [baseCurrency, baseCurrencyId, currencies, currencyId]);

  const resetErrors = () => {
    setFormError('');
    setFieldErrors({});
  };

  const validate = () => {
    const nextErrors = {};
    const amountValue = Number(amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) nextErrors.amount = t('expenseForm.validation.amount');
    if (!toPositiveInt(expenseAccountId)) nextErrors.expenseAccountId = t('expenseForm.validation.expenseAccount');
    if (!toPositiveInt(paidThroughId)) nextErrors.paidThroughId = t('expenseForm.validation.paidThrough');
    if (!toPositiveInt(branchId)) nextErrors.branchId = t('expenseForm.validation.branch');
    if (!expenseDate) nextErrors.expenseDate = t('expenseForm.validation.date');

    const currId = toPositiveInt(currencyId) || baseCurrencyId;
    if (!currId) nextErrors.currencyId = t('expenseForm.validation.currency');

    const exchangeValue = exchangeRate.trim() ? Number(exchangeRate) : 0;
    if (currId && baseCurrencyId && currId !== baseCurrencyId) {
      if (!Number.isFinite(exchangeValue) || exchangeValue <= 0) nextErrors.exchangeRate = t('expenseForm.validation.exchangeRate');
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = async () => {
    resetErrors();
    setStatus('');
    if (!validate()) return;

    const currId = toPositiveInt(currencyId) || baseCurrencyId;
    const exchangeValue = exchangeRate.trim() ? Number(exchangeRate) : 0;
    const normalizedExchangeRate = currId && baseCurrencyId && currId !== baseCurrencyId ? exchangeValue : 1;

    const { taxType, taxId } = parseTaxSelection(taxSelection);

    const input = {
      expenseAccountId: toPositiveInt(expenseAccountId),
      assetAccountId: toPositiveInt(paidThroughId),
      branchId: toPositiveInt(branchId),
      expenseDate,
      currencyId: currId,
      exchangeRate: normalizedExchangeRate,
      amount: Number(amount),
      supplierId: supplier?.id ? toPositiveInt(supplier.id) : 0,
      customerId: customer?.id ? toPositiveInt(customer.id) : 0,
      referenceNumber: referenceNumber.trim() || '',
      bankCharges: bankCharges.trim() ? Number(bankCharges) : 0,
      notes: notes.trim() || '',
      expenseTaxId: taxId,
      expenseTaxType: taxType,
      isTaxInclusive: Boolean(taxSelection) ? Boolean(isTaxInclusive) : false,
      documents: attachments.map((a) => ({ documentUrl: a.objectKey }))
    };

    try {
      if (isEdit) {
        await updateExpense({ variables: { id: expense?.id, input } });
        setStatus(t('expenseForm.updated'));
        navigate(`/expenses/${encodeURIComponent(String(expense?.id))}`, { replace: true });
        return;
      }

      const { data } = await createExpense({ variables: { input } });
      const id = data?.createExpense?.id;
      setStatus(t('expenseForm.saved'));
      if (id) {
        navigate(`/expenses/${encodeURIComponent(String(id))}`, { replace: true });
      } else {
        navigate('/expenses', { replace: true });
      }
    } catch (err) {
      setFormError(err?.message || t('expenseForm.saveFailed'));
    }
  };

  const handleAddAttachments = async (files) => {
    if (!files || files.length === 0) return;
    setFormError('');

    const maxFiles = 3;
    const current = attachments.length;
    const incoming = Array.from(files).slice(0, Math.max(0, maxFiles - current));
    if (incoming.length === 0) {
      setFormError(t('expenseForm.attachmentsMax', { count: maxFiles }));
      return;
    }

    for (const file of incoming) {
      const isLt5M = file.size / 1024 / 1024 < 5;
      if (!isLt5M) {
        setFormError(t('expenseForm.attachmentTooLarge'));
        return;
      }
    }

    setUploading(true);
    try {
      const next = [];
      for (const file of incoming) {
        const context = { entityType: 'expense_documents', field: 'document' };
        const signed = await signUpload({ file, context });
        await uploadToSignedUrl({ signed, file });
        const completed = await completeUpload({ objectKey: signed.objectKey, mimeType: file.type, context });
        const objectKey = completed?.objectKey || signed.objectKey;
        next.push({
          id: '',
          objectKey,
          name: file.name || extractFilename(objectKey) || t('expenseForm.attachment'),
          mimeType: file.type || ''
        });
      }
      setAttachments((prev) => [...prev, ...next]);
    } catch (err) {
      setFormError(err?.message || t('expenseForm.uploadFailed'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const canChangeBranch = branches.length > 1;
  const canChangeCurrency = currencies.length > 1;

  return (
    <div className="stack">
      {status && <div className="toast">{status}</div>}
      {formError && (
        <section className="state-error" role="alert">
          <p className="state-title">{t('expenseForm.problemTitle')}</p>
          <p className="state-message">{formError}</p>
        </section>
      )}

      <section className="card">
        <p className="kicker">{isEdit ? t('expenseForm.editKicker') : t('expenseForm.newKicker')}</p>
        <h2 className="title" style={{ marginBottom: 6 }}>
          {isEdit ? t('expenseForm.editTitle') : t('expenseForm.newTitle')}
        </h2>
        <p className="subtle" style={{ marginTop: 0 }}>
          {t('expenseForm.subtitle')}
        </p>
      </section>

      <section className="card">
        <div className="form-grid">
          <label className="field">
            <span className="label">{t('expenseForm.amountLabel')}</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: 10 }}>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder={t('expenseForm.amountPlaceholder')}
                style={{ fontSize: 24, fontWeight: 900 }}
              />
              {canChangeCurrency ? (
                <select className="input" value={currencyId || ''} onChange={(event) => setCurrencyId(toPositiveInt(event.target.value))}>
                  {currencies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.symbol ? `${c.symbol} ${c.name}` : c.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="input" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                  {selectedCurrency?.symbol || selectedCurrency?.name || '—'}
                </div>
              )}
            </div>
            {fieldErrors.amount && <div className="inline-error">{fieldErrors.amount}</div>}
          </label>

          <label className="field">
            <span className="label">{t('expenseForm.expenseAccountLabel')}</span>
            <button
              type="button"
              className="input"
              onClick={() => setShowExpenseAccountPicker(true)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span>{selectedExpenseAccount?.name || t('expenseForm.selectExpenseAccount')}</span>
              <span className="meta-chip">{t('common.open')}</span>
            </button>
            {fieldErrors.expenseAccountId && <div className="inline-error">{fieldErrors.expenseAccountId}</div>}
          </label>

          <label className="field">
            <span className="label">{t('expenseForm.paidThroughLabel')}</span>
            <button
              type="button"
              className="input"
              onClick={() => setShowPaidThroughPicker(true)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span>{selectedPaidThrough?.name || t('expenseForm.selectPaidThrough')}</span>
              <span className="meta-chip">{t('common.open')}</span>
            </button>
            {fieldErrors.paidThroughId && <div className="inline-error">{fieldErrors.paidThroughId}</div>}
          </label>

          <label className="field">
            <span className="label">{t('expenseForm.supplierLabel')}</span>
            <button
              type="button"
              className="input"
              onClick={() => setShowSupplierPicker(true)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span>{supplier?.name || t('expenseForm.supplierOptional')}</span>
              <span className="meta-chip">{t('common.open')}</span>
            </button>
          </label>

          <label className="field">
            <span className="label">{t('expenseForm.dateLabel')}</span>
            <input className="input" type="date" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} />
            {fieldErrors.expenseDate && <div className="inline-error">{fieldErrors.expenseDate}</div>}
          </label>

          <div className="surface-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <p className="kicker">{t('expenseForm.branchKicker')}</p>
                <p style={{ margin: 0, fontWeight: 800 }}>{selectedBranch?.name || t('expenseForm.branchFallback')}</p>
              </div>
              {canChangeBranch && (
                <button className="btn btn-secondary" type="button" onClick={() => setShowBranchPicker(true)}>
                  {t('expenseForm.change')}
                </button>
              )}
            </div>
            {fieldErrors.branchId && <div className="inline-error">{fieldErrors.branchId}</div>}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="toolbar" style={{ justifyContent: 'space-between' }}>
          <div>
            <p className="kicker" style={{ marginBottom: 4 }}>
              {t('expenseForm.moreKicker')}
            </p>
            <p style={{ margin: 0, fontWeight: 800 }}>{t('expenseForm.moreTitle')}</p>
          </div>
          <button className="btn btn-secondary" type="button" onClick={() => setShowMore((prev) => !prev)}>
            {showMore ? t('expenseForm.hide') : t('expenseForm.show')}
          </button>
        </div>

        {showMore && (
          <div className="form-grid" style={{ marginTop: 12 }}>
            <label className="field">
              <span className="label">{t('expenseForm.customerLabel')}</span>
              <button
                type="button"
                className="input"
                onClick={() => setShowCustomerPicker(true)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span>{customer?.name || t('expenseForm.customerOptional')}</span>
                <span className="meta-chip">{t('common.open')}</span>
              </button>
            </label>

            <label className="field">
              <span className="label">{t('expenseForm.taxLabel')}</span>
              <select className="input" value={taxSelection || ''} onChange={(event) => setTaxSelection(event.target.value)}>
                <option value="">{t('expenseForm.taxNone')}</option>
                {taxOptions.map((group) => (
                  <optgroup key={group.title} label={group.title}>
                    {group.items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({Number(item.rate || 0)}%)
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {taxSelection && (
                <div className="pill-tabs" style={{ marginTop: 10 }} role="tablist" aria-label={t('expenseForm.taxOptionAria')}>
                  <button
                    type="button"
                    className={`pill ${isTaxInclusive ? 'active' : ''}`}
                    onClick={() => setIsTaxInclusive(true)}
                    role="tab"
                    aria-selected={isTaxInclusive}
                  >
                    {t('expenseForm.taxInclusive')}
                  </button>
                  <button
                    type="button"
                    className={`pill ${!isTaxInclusive ? 'active' : ''}`}
                    onClick={() => setIsTaxInclusive(false)}
                    role="tab"
                    aria-selected={!isTaxInclusive}
                  >
                    {t('expenseForm.taxExclusive')}
                  </button>
                </div>
              )}
            </label>

            {baseCurrencyId && currencyId && toPositiveInt(currencyId) !== baseCurrencyId && (
              <label className="field">
                <span className="label">{t('expenseForm.exchangeRateLabel')}</span>
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.0001"
                  value={exchangeRate}
                  onChange={(event) => setExchangeRate(event.target.value)}
                  placeholder={t('expenseForm.exchangeRatePlaceholder')}
                />
                {fieldErrors.exchangeRate && <div className="inline-error">{fieldErrors.exchangeRate}</div>}
              </label>
            )}

            <label className="field">
              <span className="label">{t('expenseForm.referenceLabel')}</span>
              <input className="input" value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} />
            </label>

            <label className="field">
              <span className="label">{t('expenseForm.bankChargesLabel')}</span>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={bankCharges}
                onChange={(event) => setBankCharges(event.target.value)}
                placeholder={t('expenseForm.bankChargesPlaceholder')}
              />
            </label>

            <label className="field">
              <span className="label">{t('expenseForm.notesLabel')}</span>
              <textarea className="input" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>

            <div className="field">
              <span className="label">{t('expenseForm.attachmentsLabel')}</span>
              <input
                ref={fileInputRef}
                className="input"
                type="file"
                multiple
                onChange={(event) => handleAddAttachments(event.target.files)}
                disabled={uploading}
              />
              <p className="subtle" style={{ marginTop: 0, marginBottom: 0 }}>
                {t('expenseForm.attachmentsHint')}
              </p>
              {attachments.length > 0 && (
                <div className="picker-list" style={{ marginTop: 10 }}>
                  {attachments.map((a) => (
                    <div key={`${a.objectKey}-${a.name}`} className="picker-item" style={{ cursor: 'default' }}>
                      <div style={{ minWidth: 0 }}>
                        <div className="picker-item-title" style={{ wordBreak: 'break-word' }}>
                          {a.name}
                        </div>
                        <div className="picker-item-meta">
                          <a href={resolveStorageAccessUrl(a.objectKey)} target="_blank" rel="noreferrer">
                            {t('common.open')}
                          </a>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setAttachments((prev) => prev.filter((x) => x.objectKey !== a.objectKey))}
                      >
                        {t('common.remove')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <div className="sticky-actions" style={{ gridTemplateColumns: '1fr' }}>
        <button className="btn btn-primary" type="button" onClick={handleSave} disabled={saving || uploading}>
          {saving ? t('expenseForm.saving') : t('expenseForm.save')}
        </button>
      </div>

      {showBranchPicker && (
        <Modal title={t('expenseForm.pickBranchTitle')} onClose={() => setShowBranchPicker(false)}>
          <div className="picker-section">
            <p className="picker-section-title">{t('expenseForm.pickBranchKicker')}</p>
            <div className="picker-list">
              {branches.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className="picker-item"
                  onClick={() => {
                    setBranchId(toPositiveInt(b.id));
                    setShowBranchPicker(false);
                  }}
                >
                  <div className="picker-item-title">{b.name || `#${b.id}`}</div>
                  <span className="meta-chip">{t('picker.select')}</span>
                </button>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {showExpenseAccountPicker && (
        <AccountPickerModal
          title={t('expenseForm.pickExpenseAccountTitle')}
          placeholder={t('expenseForm.searchAccounts')}
          accounts={expenseAccounts}
          onClose={() => setShowExpenseAccountPicker(false)}
          onSelect={(acc) => {
            setExpenseAccountId(toPositiveInt(acc.id));
            setShowExpenseAccountPicker(false);
          }}
        />
      )}

      {showPaidThroughPicker && (
        <AccountPickerModal
          title={t('expenseForm.pickPaidThroughTitle')}
          placeholder={t('expenseForm.searchAccounts')}
          accounts={paymentAccounts}
          onClose={() => setShowPaidThroughPicker(false)}
          onSelect={(acc) => {
            setPaidThroughId(toPositiveInt(acc.id));
            setShowPaidThroughPicker(false);
          }}
        />
      )}

      {showSupplierPicker && (
        <Modal title={t('expenseForm.pickSupplierTitle')} onClose={() => setShowSupplierPicker(false)}>
          <div className="form-grid">
            <div className="search-wrap">
              <SearchIcon />
              <input
                className="input"
                placeholder={t('expenseForm.searchSuppliers')}
                value={supplierSearch}
                onChange={(event) => setSupplierSearch(event.target.value)}
              />
            </div>

            <div className="toolbar" style={{ justifyContent: 'space-between' }}>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => {
                  setSupplier(null);
                  setShowSupplierPicker(false);
                }}
              >
                {t('expenseForm.clear')}
              </button>
              <button className="btn btn-primary" type="button" onClick={() => setShowQuickAddSupplier(true)}>
                {t('picker.add')}
              </button>
            </div>

            {supplierQuery.loading && !supplierQuery.data && (
              <section className="state-loading" role="status" aria-live="polite">
                <p className="state-message">{t('expenseForm.loadingSuppliers')}</p>
              </section>
            )}

            {supplierQuery.error && (
              <section className="state-error" role="alert">
                <p className="state-title">{t('expenseForm.supplierLoadFail')}</p>
                <p className="state-message">{supplierQuery.error.message}</p>
              </section>
            )}

            {!supplierQuery.error && (
              <div className="picker-list">
                {suppliers.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="picker-item"
                    onClick={() => {
                      setSupplier(s);
                      setShowSupplierPicker(false);
                    }}
                  >
                    <div className="picker-item-title">{s.name}</div>
                    <span className="meta-chip">{t('picker.select')}</span>
                  </button>
                ))}
              </div>
            )}

            {!supplierQuery.loading && !supplierQuery.error && suppliers.length === 0 && (
              <p className="empty" style={{ marginTop: 10 }}>
                {t('expenseForm.noSuppliersFound')}
              </p>
            )}
          </div>
        </Modal>
      )}

      {showCustomerPicker && (
        <Modal title={t('expenseForm.pickCustomerTitle')} onClose={() => setShowCustomerPicker(false)}>
          <div className="form-grid">
            <div className="search-wrap">
              <SearchIcon />
              <input
                className="input"
                placeholder={t('expenseForm.searchCustomers')}
                value={customerSearch}
                onChange={(event) => setCustomerSearch(event.target.value)}
              />
            </div>

            <div className="toolbar" style={{ justifyContent: 'space-between' }}>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => {
                  setCustomer(null);
                  setShowCustomerPicker(false);
                }}
              >
                {t('expenseForm.clear')}
              </button>
              <button className="btn btn-primary" type="button" onClick={() => setShowQuickAddCustomer(true)}>
                {t('picker.add')}
              </button>
            </div>

            {customerQuery.loading && !customerQuery.data && (
              <section className="state-loading" role="status" aria-live="polite">
                <p className="state-message">{t('expenseForm.loadingCustomers')}</p>
              </section>
            )}

            {customerQuery.error && (
              <section className="state-error" role="alert">
                <p className="state-title">{t('expenseForm.customerLoadFail')}</p>
                <p className="state-message">{customerQuery.error.message}</p>
              </section>
            )}

            {!customerQuery.error && (
              <div className="picker-list">
                {customers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="picker-item"
                    onClick={() => {
                      setCustomer(c);
                      setShowCustomerPicker(false);
                    }}
                  >
                    <div className="picker-item-title">{c.name}</div>
                    <span className="meta-chip">{t('picker.select')}</span>
                  </button>
                ))}
              </div>
            )}

            {!customerQuery.loading && !customerQuery.error && customers.length === 0 && (
              <p className="empty" style={{ marginTop: 10 }}>
                {t('expenseForm.noCustomersFound')}
              </p>
            )}
          </div>
        </Modal>
      )}

      {showQuickAddSupplier && (
        <Modal title={t('expenseForm.quickAddSupplierTitle')} onClose={() => setShowQuickAddSupplier(false)}>
          <QuickAddSupplier
            baseCurrencyId={baseCurrencyId}
            onClose={() => setShowQuickAddSupplier(false)}
            loading={createSupplierState.loading}
            error={createSupplierState.error}
            onSave={async ({ name }) => {
              if (!name) return;
              const input = {
                name: String(name).trim(),
                currencyId: baseCurrencyId,
                notes: ''
              };
              const { data } = await createSupplier({ variables: { input } });
              const created = data?.createSupplier;
              if (created?.id) {
                setSupplier(created);
                setShowQuickAddSupplier(false);
                setShowSupplierPicker(false);
                setStatus(t('expenseForm.supplierCreated'));
              }
            }}
          />
        </Modal>
      )}

      {showQuickAddCustomer && (
        <QuickAddCustomer
          onClose={() => setShowQuickAddCustomer(false)}
          onSave={(created) => {
            if (created?.id) setCustomer(created);
            setShowQuickAddCustomer(false);
            setShowCustomerPicker(false);
            setStatus(t('expenseForm.customerCreated'));
          }}
        />
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg className="search-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function AccountPickerModal({ title, placeholder, accounts, onSelect, onClose }) {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search, 250);

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) => {
      const parts = [a?.name, a?.code, a?.detailType].filter(Boolean).join(' ').toLowerCase();
      return parts.includes(q);
    });
  }, [accounts, debounced]);

  return (
    <Modal title={title} onClose={onClose}>
      <div className="form-grid">
        <div className="search-wrap">
          <SearchIcon />
          <input className="input" placeholder={placeholder} value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>

        <div className="picker-list">
          {filtered.map((acc) => (
            <button key={acc.id} type="button" className="picker-item" onClick={() => onSelect(acc)}>
              <div>
                <div className="picker-item-title">{acc.name}</div>
                <div className="picker-item-meta">{acc.detailType || acc.mainType || ''}</div>
              </div>
              <span className="meta-chip">{t('picker.select')}</span>
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="empty" style={{ marginTop: 0 }}>
            {t('expenseForm.noAccountsFound')}
          </p>
        )}
      </div>
    </Modal>
  );
}

function QuickAddSupplier({ baseCurrencyId, onSave, onClose }) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [localError, setLocalError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) return;
    if (!baseCurrencyId) return;
    setLocalError('');
    try {
      await onSave({ name: name.trim() });
    } catch (err) {
      setLocalError(err?.message || t('expenseForm.supplierCreateFailed'));
    }
  };

  return (
    <div className="form-grid">
      <label className="field">
        <span className="label">{t('fields.nameRequired')}</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </label>
      {localError && <div className="inline-error">{localError}</div>}
      <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" type="button" onClick={onClose}>
          {t('common.cancel')}
        </button>
        <button className="btn btn-primary" type="button" onClick={handleSave} disabled={!name.trim() || !baseCurrencyId}>
          {t('common.save')}
        </button>
      </div>
    </div>
  );
}

export default ExpenseForm;
