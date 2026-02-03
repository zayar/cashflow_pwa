import { useState } from 'react';
import { gql, useMutation, useQuery } from '@apollo/client';
import { useNavigate } from 'react-router-dom';

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

function ItemForm() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [salesPrice, setSalesPrice] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [sku, setSku] = useState('');
  const [error, setError] = useState('');
  
  // Fetch required data for dropdowns and defaults
  const { data: unitsData, loading: unitsLoading } = useQuery(GET_PRODUCT_UNITS);
  const { data: categoriesData, loading: categoriesLoading } = useQuery(GET_PRODUCT_CATEGORIES);
  const { data: businessData, loading: businessLoading } = useQuery(GET_BUSINESS_ACCOUNTS);
  
  const [createProduct, { loading: createLoading }] = useMutation(CREATE_PRODUCT, {
    onCompleted: () => {
      navigate('/items', { replace: true, state: { created: true } });
    },
    onError: (err) => {
      // Show the actual error message from the server
      console.error('Create product error:', err);
      const message = err.message || 'Failed to create item';
      setError(message);
    }
  });

  const loading = createLoading || unitsLoading || categoriesLoading || businessLoading;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    
    if (!name.trim()) {
      setError('Item name is required');
      return;
    }

    // Get the first active unit ID (required field)
    const activeUnits = unitsData?.listAllProductUnit?.filter(u => u.isActive) || [];
    const defaultUnitId = activeUnits[0]?.id;
    if (!defaultUnitId) {
      setError('No active unit found. Please configure units in the main application.');
      return;
    }

    // Get the first active category ID (required field for items)
    const activeCategories = categoriesData?.listAllProductCategory?.filter(c => c.isActive) || [];
    const defaultCategoryId = activeCategories[0]?.id;
    if (!defaultCategoryId) {
      setError('No active category found. Please configure categories in the main application.');
      return;
    }

    // Get default accounts from business data
    const accounts = businessData?.listAllAccount || [];
    const defaultSalesAccount = accounts.find(a => a.mainType === 'Income' && a.isActive);
    const defaultPurchaseAccount = accounts.find(a => a.mainType === 'Expense' && a.isActive);
    const defaultInventoryAccount = accounts.find(a => a.detailType === 'Stock' && a.isActive);

    if (!defaultSalesAccount || !defaultPurchaseAccount) {
      setError('Required accounts not found. Please configure accounts in the main application.');
      return;
    }

    // Build input with all required fields
    // Using actual IDs from the database instead of hardcoded values
    // Note: Backend expects 0 for optional IDs, not null
    // Explicitly convert all IDs to integers to prevent null conversion
    const input = {
      name: name.trim(),
      // Unit - required, use first active unit
      unitId: parseInt(defaultUnitId, 10),
      // Category - required, use first active category  
      categoryId: parseInt(defaultCategoryId, 10),
      // Accounts - use actual account IDs from database
      salesAccountId: parseInt(defaultSalesAccount.id, 10),
      purchaseAccountId: parseInt(defaultPurchaseAccount.id, 10),
      inventoryAccountId: parseInt(defaultInventoryAccount?.id || 0, 10),
      // Pricing
      salesPrice: parseFloat(salesPrice) || 0,
      purchasePrice: parseFloat(purchasePrice) || 0,
      isSalesTaxInclusive: false,
      // Tax IDs - 0 means no tax
      salesTaxId: 0,
      salesTaxType: "I",
      purchaseTaxId: 0,
      purchaseTaxType: "I",
      // Supplier - 0 means no supplier (must be integer, not null)
      supplierId: 0,
      // Inventory
      isBatchTracking: false,
      // Optional fields - only include if they have values
      ...(sku.trim() && { sku: sku.trim() }),
      // Images and opening stocks
      images: [],
      openingStocks: []
    };

    console.log('Creating product with input:', JSON.stringify(input, null, 2));
    createProduct({ variables: { input } });
  };

  return (
    <div className="invoice-page">
      <div className="section-card">
        <h2 className="heading">New Item</h2>
        <p className="subtle">Add a new product or service</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="section-card">
          <label className="field">
            <span className="label">Item Name *</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Strawberry"
              autoFocus
            />
          </label>

          <label className="field">
            <span className="label">Sales Price</span>
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={salesPrice}
              onChange={(e) => setSalesPrice(e.target.value)}
              placeholder="0.00"
            />
          </label>

          <label className="field">
            <span className="label">Purchase Price (Cost)</span>
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              placeholder="0.00"
            />
          </label>

          <label className="field">
            <span className="label">SKU (optional)</span>
            <input
              className="input"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="e.g., PROD-001"
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
            onClick={() => navigate('/items')}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving…' : 'Save Item'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ItemForm;
