import { createContext, createElement, useContext, useMemo, useReducer } from 'react';

const InvoiceDraftContext = createContext(null);

const today = new Date().toISOString().slice(0, 10);

export function createLine() {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    productId: '',
    name: '',
    qty: 1,
    rate: 0,
    discount: 0,
    taxable: true
  };
}

const initialInvoice = {
  invoiceId: '',
  invoiceNumber: '',
  invoiceDate: today,
  paymentTerms: 'DueOnReceipt',
  customerId: '',
  customerName: '',
  referenceNumber: '',
  notes: '',
  branchId: 1,
  warehouseId: 1,
  currencyId: 1,
  currentStatus: 'Draft',
  lines: [createLine()]
};

function invoiceReducer(state, action) {
  switch (action.type) {
    case 'setField':
      return { ...state, [action.field]: action.value };
    case 'setCustomer':
      return { ...state, customerId: action.customerId, customerName: action.customerName };
    case 'addLine':
      return { ...state, lines: [...state.lines, createLine()] };
    case 'addLineWith':
      return { ...state, lines: [...state.lines, action.line] };
    case 'removeLine':
      return { ...state, lines: state.lines.filter((line) => line.id !== action.lineId) };
    case 'updateLine':
      return {
        ...state,
        lines: state.lines.map((line) =>
          line.id === action.lineId ? { ...line, [action.field]: action.value } : line
        )
      };
    case 'setLineItem':
      return {
        ...state,
        lines: state.lines.map((line) =>
          line.id === action.lineId
            ? {
                ...line,
                productId: action.productId || '',
                name: action.name || '',
                rate: Number(action.rate ?? line.rate ?? 0)
              }
            : line
        )
      };
    case 'setInvoiceNumber':
      return { ...state, invoiceNumber: action.invoiceNumber };
    case 'setInvoiceId':
      return { ...state, invoiceId: action.invoiceId };
    case 'reset':
      return initialInvoice;
    default:
      return state;
  }
}

export function InvoiceDraftProvider({ children }) {
  const [state, dispatch] = useReducer(invoiceReducer, initialInvoice);
  const value = useMemo(() => ({ state, dispatch }), [state, dispatch]);

  return createElement(InvoiceDraftContext.Provider, { value }, children);
}

export function useInvoiceDraft() {
  const ctx = useContext(InvoiceDraftContext);
  if (!ctx) {
    throw new Error('useInvoiceDraft must be used within InvoiceDraftProvider');
  }
  return ctx;
}
