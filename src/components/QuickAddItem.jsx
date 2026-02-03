import { useState } from 'react';
import { gql, useMutation, useQuery } from '@apollo/client';
import Modal from './Modal';

const CREATE_PRODUCT = gql`
  mutation QuickAddProduct($input: NewProduct!) {
    createProduct(input: $input) {
      id
      name
      sku
      barcode
      salesPrice
    }
  }
`;

const GET_PRODUCT_DEFAULTS = gql`
  query GetProductDefaults {
    listAllProductUnit {
      id
      name
      abbreviation
      isActive
    }
    listAllProductCategory {
      id
      name
      isActive
    }
    listAllAccount {
      id
      name
      mainType
      detailType
      isActive
    }
  }
`;

function QuickAddItem({ onSave, onClose }) {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  
  // Fetch required data for dropdowns and defaults
  const { data: defaultsData, loading: defaultsLoading } = useQuery(GET_PRODUCT_DEFAULTS);
  
  const [mutate, { loading: mutateLoading, error }] = useMutation(CREATE_PRODUCT);
  
  const loading = mutateLoading || defaultsLoading;

  const handleSave = async () => {
    if (!name) return;
    
    // Get the first active unit ID (required field)
    const activeUnits = defaultsData?.listAllProductUnit?.filter(u => u.isActive) || [];
    const defaultUnitId = activeUnits[0]?.id;
    
    // Get the first active category ID (required field for items)
    const activeCategories = defaultsData?.listAllProductCategory?.filter(c => c.isActive) || [];
    const defaultCategoryId = activeCategories[0]?.id;
    
    // Get default accounts
    const accounts = defaultsData?.listAllAccount || [];
    const defaultSalesAccount = accounts.find(a => a.mainType === 'Income' && a.isActive);
    const defaultPurchaseAccount = accounts.find(a => a.mainType === 'Expense' && a.isActive);
    const defaultInventoryAccount = accounts.find(a => a.detailType === 'Stock' && a.isActive);
    
    if (!defaultUnitId || !defaultCategoryId || !defaultSalesAccount || !defaultPurchaseAccount) {
      // If required data isn't loaded yet, wait
      return;
    }
    
    const input = {
      name: name.trim(),
      unitId: parseInt(defaultUnitId, 10),
      categoryId: parseInt(defaultCategoryId, 10),
      salesAccountId: parseInt(defaultSalesAccount.id, 10),
      purchaseAccountId: parseInt(defaultPurchaseAccount.id, 10),
      inventoryAccountId: parseInt(defaultInventoryAccount?.id || 0, 10),
      salesPrice: parseFloat(price) || 0,
      purchasePrice: 0,
      salesTaxId: 0,
      salesTaxType: "I",
      purchaseTaxId: 0,
      purchaseTaxType: "I",
      supplierId: 0,
      isSalesTaxInclusive: false,
      isBatchTracking: false,
      images: [],
      openingStocks: [],
      ...(sku.trim() && { sku: sku.trim() })
    };
    console.log('QuickAddItem creating product with input:', JSON.stringify(input, null, 2));
    const { data } = await mutate({ variables: { input } });
    if (data?.createProduct) {
      onSave(data.createProduct);
    }
    onClose();
  };

  return (
    <Modal title="Quick add item" onClose={onClose}>
      <div className="form-grid">
        <label className="field">
          <span className="label">Name *</span>
          <input 
            className="input" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            autoFocus
          />
        </label>
        <label className="field">
          <span className="label">SKU</span>
          <input className="input" value={sku} onChange={(e) => setSku(e.target.value)} />
        </label>
        <label className="field">
          <span className="label">Price</span>
          <input
            className="input"
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>
        <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
          <button 
            className="btn btn-secondary" 
            type="button" 
            onClick={onClose}
          >
            Cancel
          </button>
          <button 
            className="btn btn-primary" 
            type="button" 
            onClick={handleSave} 
            disabled={loading || !defaultsData}
          >
            {loading ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {error && <p className="subtle" style={{ color: '#ef4444' }}>{error.message}</p>}
    </Modal>
  );
}

export default QuickAddItem;
