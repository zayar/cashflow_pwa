import { useState } from 'react';
import { gql, useMutation, useQuery } from '@apollo/client';
import Modal from './Modal';
import { useI18n } from '../i18n';

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
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [address, setAddress] = useState('');
  
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
      notes: note.trim() || undefined,
      billingAddress: address.trim() ? { address: address.trim() } : undefined,
      shippingAddress: address.trim() ? { address: address.trim() } : undefined
    };
    const { data } = await mutate({ variables: { input } });
    if (data?.createCustomer) {
      onSave(data.createCustomer);
    }
    onClose();
  };

  return (
    <Modal title={t('picker.quickAddClientTitle')} onClose={onClose}>
      <div className="form-grid">
        <label className="field">
          <span className="label">{t('fields.nameRequired')}</span>
          <input 
            className="input" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            autoFocus
          />
        </label>
        <label className="field">
          <span className="label">{t('fields.notes')}</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <label className="field">
          <span className="label">{t('fields.addressOptional')}</span>
          <textarea className="input" rows={3} value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>
        <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" type="button" onClick={onClose}>{t('common.cancel')}</button>
          <button 
            className="btn btn-primary" 
            type="button" 
            onClick={handleSave} 
            disabled={loading || !businessData}
          >
            {loading ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>

      {error && <p className="subtle" style={{ color: '#ef4444' }}>{error.message}</p>}
    </Modal>
  );
}

export default QuickAddCustomer;
