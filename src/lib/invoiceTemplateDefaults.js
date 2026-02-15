export const DEFAULT_INVOICE_TEMPLATE_CONFIG = {
  theme: {
    primaryColor: '#1677ff',
    textColor: '#111827',
    tableHeaderBg: '#f3f4f6',
    tableHeaderText: '#111827',
    borderColor: '#e5e7eb'
  },
  header: {
    showLogo: true
  },
  footer: {
    termsText: ''
  },
  layout: {
    paperSize: 'A4',
    orientation: 'portrait',
    marginsIn: { top: 1, bottom: 1, left: 0.2, right: 0.2 }
  }
};

export function getDefaultInvoiceTemplateName(baseName = 'Invoice Template') {
  const clean = String(baseName || '').trim() || 'Invoice Template';
  return clean.startsWith('Standard ') ? clean : `Standard ${clean}`;
}
