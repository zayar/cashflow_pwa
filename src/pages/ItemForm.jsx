import { useEffect, useMemo, useState } from 'react';
import { gql, useMutation, useQuery } from '@apollo/client';
import { useNavigate, useParams } from 'react-router-dom';
import { getDefaultInvoiceLocationIds } from '../lib/auth';

const CREATE_PRODUCT = gql`
  mutation CreateProduct($input: NewProduct!) {
    createProduct(input: $input) {
      id
      name
      salesPrice
      sku
    }
  }
`;

const UPDATE_PRODUCT = gql`
  mutation UpdateProduct($id: ID!, $input: NewProduct!) {
    updateProduct(id: $id, input: $input) {
      id
      name
      salesPrice
      sku
    }
  }
`;

const GET_PRODUCT_UNITS = gql`
  query ListAllProductUnit {
    listAllProductUnit {
      id
      name
      abbreviation
      isActive
    }
  }
`;

const GET_PRODUCT_CATEGORIES = gql`
  query ListAllProductCategory {
    listAllProductCategory {
      id
      name
      isActive
    }
  }
`;

const GET_BUSINESS_ACCOUNTS = gql`
  query GetBusinessAndAccounts {
    getBusiness {
      id
      baseCurrency {
        id
        symbol
      }
    }
    listAllAccount {
      id
      name
      mainType
      detailType
      systemDefaultCode
      isActive
    }
  }
`;

const GET_WAREHOUSES = gql`
  query GetWarehousesForItemForm {
    listAllWarehouse {
      id
      name
    }
  }
`;

const FIND_PRODUCT = gql`
  query FindProduct($limit: Int = 120) {
    paginateProduct(limit: $limit) {
      edges {
        node {
          id
          name
          salesPrice
          purchasePrice
          sku
          isActive
        }
      }
    }
  }
`;

function ItemForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [limit, setLimit] = useState(120);
  const [isHydrated, setIsHydrated] = useState(!isEdit);
  const [name, setName] = useState('');
  const [salesPrice, setSalesPrice] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [sku, setSku] = useState('');
  const [error, setError] = useState('');

  const { data: unitsData, loading: unitsLoading } = useQuery(GET_PRODUCT_UNITS);
  const { data: categoriesData, loading: categoriesLoading } = useQuery(GET_PRODUCT_CATEGORIES);
  const { data: businessData, loading: businessLoading } = useQuery(GET_BUSINESS_ACCOUNTS);
  const { data: warehouseData, loading: warehousesLoading } = useQuery(GET_WAREHOUSES);
  const {
    data: productData,
    loading: productLoading,
    error: productError,
    refetch: refetchProduct
  } = useQuery(FIND_PRODUCT, {
    skip: !isEdit,
    variables: { limit },
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all'
  });

  const [createProduct, createState] = useMutation(CREATE_PRODUCT);
  const [updateProduct, updateState] = useMutation(UPDATE_PRODUCT);

  const product = useMemo(() => {
    const edges = productData?.paginateProduct?.edges ?? [];
    const match = edges.find((edge) => String(edge?.node?.id || '') === String(id || ''));
    return match?.node || null;
  }, [id, productData]);

  useEffect(() => {
    if (!isEdit || isHydrated || !product) return;
    setName(product.name || '');
    setSalesPrice(product.salesPrice !== null && product.salesPrice !== undefined ? String(product.salesPrice) : '');
    setPurchasePrice(product.purchasePrice !== null && product.purchasePrice !== undefined ? String(product.purchasePrice) : '');
    setSku(product.sku || '');
    setIsHydrated(true);
  }, [isEdit, isHydrated, product]);

  useEffect(() => {
    if (!isEdit || productLoading || productError) return;
    if (!product && limit < 640) {
      setLimit((prev) => Math.min(prev * 2, 640));
    }
  }, [isEdit, limit, product, productError, productLoading]);

  const saving = createState.loading || updateState.loading;
  const loading = saving || unitsLoading || categoriesLoading || businessLoading;
  const warehouses = warehouseData?.listAllWarehouse ?? [];
  const defaults = getDefaultInvoiceLocationIds();
  const defaultWarehouseId = String(defaults.warehouseId || '');
  const hasWarehouse = warehouses.some((warehouse) => String(warehouse.id) === defaultWarehouseId);
  const selectedWarehouseId = hasWarehouse ? defaultWarehouseId : warehouses[0]?.id ? String(warehouses[0].id) : defaultWarehouseId;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Item name is required.');
      return;
    }

    const activeUnits = unitsData?.listAllProductUnit?.filter((unit) => unit.isActive) || [];
    const defaultUnitId = activeUnits[0]?.id;
    if (!defaultUnitId) {
      setError('No active unit found. Please configure units in the main application.');
      return;
    }

    const activeCategories = categoriesData?.listAllProductCategory?.filter((category) => category.isActive) || [];
    const defaultCategoryId = activeCategories[0]?.id;
    if (!defaultCategoryId) {
      setError('No active category found. Please configure categories in the main application.');
      return;
    }

    const accounts = businessData?.listAllAccount || [];
    const defaultSalesAccount = accounts.find((account) => account.mainType === 'Income' && account.isActive);
    const defaultPurchaseAccount = accounts.find((account) => account.mainType === 'Expense' && account.isActive);
    const defaultInventoryAccount = accounts.find((account) => account.detailType === 'Stock' && account.isActive);

    if (!defaultSalesAccount || !defaultPurchaseAccount) {
      setError('Required accounts not found. Please configure accounts in the main application.');
      return;
    }

    const input = {
      name: name.trim(),
      unitId: parseInt(defaultUnitId, 10),
      categoryId: parseInt(defaultCategoryId, 10),
      salesAccountId: parseInt(defaultSalesAccount.id, 10),
      purchaseAccountId: parseInt(defaultPurchaseAccount.id, 10),
      inventoryAccountId: parseInt(defaultInventoryAccount?.id || 0, 10),
      salesPrice: parseFloat(salesPrice) || 0,
      purchasePrice: parseFloat(purchasePrice) || 0,
      isSalesTaxInclusive: false,
      salesTaxId: 0,
      salesTaxType: 'I',
      purchaseTaxId: 0,
      purchaseTaxType: 'I',
      supplierId: 0,
      isBatchTracking: false,
      ...(sku.trim() && { sku: sku.trim() }),
      images: [],
      openingStocks: []
    };

    try {
      if (isEdit) {
        await updateProduct({ variables: { id, input } });
        navigate(`/items/${id}`, { replace: true, state: { updated: true } });
      } else {
        await createProduct({ variables: { input } });
        navigate('/items', { replace: true, state: { created: true } });
      }
    } catch (mutationError) {
      const message = mutationError.message || 'Failed to save item';
      setError(message);
    }
  };

  if (isEdit && ((productLoading && !productData) || (product && !isHydrated))) {
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

  if (isEdit && !productLoading && !productError && !product) {
    return (
      <div className="stack">
        <section className="state-empty" role="status">
          <p style={{ marginTop: 0, marginBottom: 10, fontWeight: 800 }}>Item not found in recent items.</p>
          <p style={{ marginTop: 0, marginBottom: 14 }}>Return to items and refresh, then try again.</p>
          <button className="btn btn-secondary" type="button" onClick={() => refetchProduct()}>
            Try again
          </button>
        </section>
      </div>
    );
  }

  if (isEdit && (productError || !product)) {
    return (
      <div className="stack">
        <section className="state-error" role="alert">
          <p style={{ marginTop: 0, marginBottom: 10, fontWeight: 800 }}>Could not load this item.</p>
          <p style={{ marginTop: 0, marginBottom: 14 }}>{productError?.message || 'Item not found.'}</p>
          <button className="btn btn-secondary" type="button" onClick={() => refetchProduct()}>
            Try again
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="invoice-page">
      <section className="flow-banner">
        <p className="kicker">Catalog</p>
        <h2 className="title" style={{ marginBottom: 6 }}>
          {isEdit ? 'Edit item' : 'Add a new item'}
        </h2>
        <p className="subtle">
          {isEdit
            ? 'Update item details like name and prices.'
            : 'Save common products or services so invoice creation is faster.'}
        </p>
      </section>

      <form className="invoice-panel" onSubmit={handleSubmit}>
        <label className="field">
          <span className="label">Item name *</span>
          <input
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g., Monthly Consulting"
            autoFocus
          />
        </label>

        <div className="invoice-meta-grid">
          <label className="field">
            <span className="label">Sales price</span>
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={salesPrice}
              onChange={(event) => setSalesPrice(event.target.value)}
              placeholder="0.00"
            />
          </label>

          <label className="field">
            <span className="label">Purchase price</span>
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={purchasePrice}
              onChange={(event) => setPurchasePrice(event.target.value)}
              placeholder="0.00"
            />
          </label>
        </div>

        <label className="field">
          <span className="label">SKU (optional)</span>
          <input
            className="input"
            value={sku}
            onChange={(event) => setSku(event.target.value)}
            placeholder="e.g., SKU-001"
          />
        </label>

        <label className="field">
          <span className="label">Warehouse (default)</span>
          {warehouses.length > 0 ? (
            <select className="input" value={selectedWarehouseId} disabled aria-readonly="true">
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name ? `${warehouse.name} (#${warehouse.id})` : `Warehouse #${warehouse.id}`}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="input"
              value={warehousesLoading ? 'Loading…' : selectedWarehouseId ? `Warehouse #${selectedWarehouseId}` : 'Account default'}
              disabled
              readOnly
            />
          )}
        </label>

        {error && <div className="inline-error">{error}</div>}

        <div className="sticky-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate(isEdit ? `/items/${id}` : '/items')}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving...' : isEdit ? 'Save changes' : 'Save item'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ItemForm;
