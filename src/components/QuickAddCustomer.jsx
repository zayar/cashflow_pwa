import { useState } from 'react';
import { gql, useMutation, useQuery } from '@apollo/client';
import Modal from './Modal';

const CREATE_CUSTOMER = gql`
  mutation QuickAddCustomer($input: NewCustomer!) {
    createCustomer(input: $input) {
      id
      name
      currency {
        symbol
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

function QuickAddCustomer({ onSave, onClose }) {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  
  // Fetch business to get the correct base currency ID
  const { data: businessData, loading: businessLoading } = useQuery(GET_BUSINESS);
  
  const [mutate, { loading: mutateLoading, error }] = useMutation(CREATE_CUSTOMER);
  
  const loading = mutateLoading || businessLoading;

  const handleSave = async () => {
    if (!name) return;
    
    // Get the actual base currency ID from the business data
    const baseCurrencyId = businessData?.getBusiness?.baseCurrency?.id;
    if (!baseCurrencyId) {
      // If data isn't loaded yet, wait
      return;
    }
    
    const input = {
      name: name.trim(),
      currencyId: baseCurrencyId,
      notes: note.trim() || undefined
    };
    const { data } = await mutate({ variables: { input } });
    if (data?.createCustomer) {
      onSave(data.createCustomer);
    }
    onClose();
  };

  return (
    <Modal title="Quick add client" onClose={onClose}>
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
          <span className="label">Notes</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
          <button 
            className="btn btn-primary" 
            type="button" 
            onClick={handleSave} 
            disabled={loading || !businessData}
          >
            {loading ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {error && <p className="subtle" style={{ color: '#ef4444' }}>{error.message}</p>}
    </Modal>
  );
}

export default QuickAddCustomer;
