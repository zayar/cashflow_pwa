import { useState } from 'react';
import { gql, useMutation, useQuery } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
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

function ItemForm() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [salesPrice, setSalesPrice] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [sku, setSku] = useState('');
  const [error, setError] = useState('');

  const { data: unitsData, loading: unitsLoading } = useQuery(GET_PRODUCT_UNITS);
  const { data: categoriesData, loading: categoriesLoading } = useQuery(GET_PRODUCT_CATEGORIES);
  const { data: businessData, loading: businessLoading } = useQuery(GET_BUSINESS_ACCOUNTS);
  const { data: warehouseData, loading: warehousesLoading } = useQuery(GET_WAREHOUSES);

  const [createProduct, { loading: createLoading }] = useMutation(CREATE_PRODUCT, {
    onCompleted: () => {
      navigate('/items', { replace: true, state: { created: true } });
    },
    onError: (mutationError) => {
      const message = mutationError.message || 'Failed to create item';
      setError(message);
    }
  });

  const loading = createLoading || unitsLoading || categoriesLoading || businessLoading;
  const warehouses = warehouseData?.listAllWarehouse ?? [];
  const defaults = getDefaultInvoiceLocationIds();
  const defaultWarehouseId = String(defaults.warehouseId || '');
  const hasWarehouse = warehouses.some((warehouse) => String(warehouse.id) === defaultWarehouseId);
  const selectedWarehouseId = hasWarehouse ? defaultWarehouseId : warehouses[0]?.id ? String(warehouses[0].id) : defaultWarehouseId;

  const handleSubmit = (event) => {
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

    createProduct({ variables: { input } });
  };

  return (
    <div className="invoice-page">
      <section className="flow-banner">
        <p className="kicker">Catalog</p>
        <h2 className="title" style={{ marginBottom: 6 }}>
          Add a new item
        </h2>
        <p className="subtle">Save common products or services so invoice creation is faster.</p>
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
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/items')}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving...' : 'Save item'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ItemForm;
