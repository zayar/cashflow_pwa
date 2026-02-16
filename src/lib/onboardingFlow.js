import { DEFAULT_INVOICE_TEMPLATE_CONFIG, getDefaultInvoiceTemplateName } from './invoiceTemplateDefaults.js';
import {
  createTemplate,
  getDefaultTemplate,
  listTemplates,
  setDefaultTemplate
} from './templatesApi.js';

const DEFAULT_DOCUMENT_TYPE = 'invoice';

export function isBasicsComplete(profile) {
  if (!profile) return false;
  const name = String(profile.businessName || profile.name || '').trim();
  const phone = String(profile.phone || '').trim();
  return Boolean(name && phone);
}

export function buildCompanyBasicsPayload(values = {}) {
  const normalize = (value) => String(value ?? '').trim();
  return {
    businessName: normalize(values.businessName),
    phone: normalize(values.phone),
    address: normalize(values.address),
    city: normalize(values.city),
    logoUrl: normalize(values.logoUrl)
  };
}

export function formatTelegramCommand(codeOrCommand) {
  const raw = String(codeOrCommand || '').trim();
  if (!raw) return '';
  if (raw.startsWith('/link ')) return raw;
  if (raw.startsWith('/')) return raw;
  return `/link ${raw}`;
}

export function deriveTelegramStatus(payload) {
  const linked = Boolean(payload?.telegramLinked);
  const linkedRecipients = Number(payload?.linkedRecipientsCount || 0);
  return {
    linked,
    linkedRecipients,
    statusText: linked ? 'Telegram linked' : 'Telegram not linked',
    cta: linked ? 'view-report' : 'connect'
  };
}

/**
 * Ensure the business has a default invoice template without duplicating existing ones.
 * @returns {Promise<{ template: any, created: boolean, source: 'default'|'existing'|'created' }>}
 */
export async function ensureDefaultInvoiceTemplate({
  businessId,
  documentType = DEFAULT_DOCUMENT_TYPE,
  fetchDefault = getDefaultTemplate,
  listFn = listTemplates,
  createFn = createTemplate,
  setDefaultFn = setDefaultTemplate
} = {}) {
  if (!businessId) {
    throw new Error('businessId is required');
  }

  const existingDefault = await fetchDefault(documentType, businessId);
  if (existingDefault) {
    return { template: existingDefault, created: false, source: 'default' };
  }

  const existingList = await listFn(documentType, businessId);
  if (Array.isArray(existingList) && existingList.length > 0) {
    const defaultCandidate = existingList.find((tpl) => tpl.is_default) || existingList[0];
    if (!defaultCandidate.is_default && defaultCandidate.id) {
      const updated = await setDefaultFn(defaultCandidate.id, businessId);
      return { template: updated || { ...defaultCandidate, is_default: true }, created: false, source: 'existing' };
    }
    return { template: defaultCandidate, created: false, source: 'existing' };
  }

  const created = await createFn({
    documentType,
    name: getDefaultInvoiceTemplateName('Invoice Template'),
    isDefault: true,
    config: DEFAULT_INVOICE_TEMPLATE_CONFIG,
    businessId
  });
  return { template: created, created: true, source: 'created' };
}
