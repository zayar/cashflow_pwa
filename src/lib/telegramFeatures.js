export const TELEGRAM_FEATURE_TODAY_REPORT = 'today_report';
export const TELEGRAM_FEATURE_YESTERDAY_REPORT = 'yesterday_report';
export const TELEGRAM_FEATURE_WEEKLY_REPORT = 'weekly_report';
export const TELEGRAM_FEATURE_INVENTORY_SUMMARY = 'inventory_summary';
export const TELEGRAM_FEATURE_LOW_INVENTORY = 'low_inventory_report';

export const TELEGRAM_REPORT_CODE_TO_FEATURE = {
  TODAY_REPORT: TELEGRAM_FEATURE_TODAY_REPORT,
  YESTERDAY_REPORT: TELEGRAM_FEATURE_YESTERDAY_REPORT,
  WEEKLY_REPORT: TELEGRAM_FEATURE_WEEKLY_REPORT,
  INVENTORY_SUMMARY: TELEGRAM_FEATURE_INVENTORY_SUMMARY,
  LOW_INVENTORY_SUMMARY: TELEGRAM_FEATURE_LOW_INVENTORY
};

const LITE_ALLOWED_FEATURES = [
  TELEGRAM_FEATURE_TODAY_REPORT,
  TELEGRAM_FEATURE_YESTERDAY_REPORT,
  TELEGRAM_FEATURE_WEEKLY_REPORT
];

const ALL_FEATURES = Object.freeze([
  TELEGRAM_FEATURE_TODAY_REPORT,
  TELEGRAM_FEATURE_YESTERDAY_REPORT,
  TELEGRAM_FEATURE_WEEKLY_REPORT,
  TELEGRAM_FEATURE_INVENTORY_SUMMARY,
  TELEGRAM_FEATURE_LOW_INVENTORY
]);

function normalizePlan(plan) {
  const normalized = String(plan || '').trim().toUpperCase();
  if (normalized === 'LITE') return 'LITE';
  return 'PRO';
}

export function isPro(plan) {
  return normalizePlan(plan) === 'PRO';
}

export function getTelegramAllowedFeatures(plan) {
  return isPro(plan) ? ['*'] : [...LITE_ALLOWED_FEATURES];
}

export function getTelegramAllFeatures() {
  return [...ALL_FEATURES];
}

export function getTelegramFeatureFromReportCode(reportCode) {
  const normalized = String(reportCode || '').trim().toUpperCase();
  return TELEGRAM_REPORT_CODE_TO_FEATURE[normalized] || '';
}

export function isTelegramFeatureAllowed(plan, feature) {
  if (isPro(plan)) return true;
  return LITE_ALLOWED_FEATURES.includes(String(feature || '').trim().toLowerCase());
}

export function isTelegramReportCodeAllowed(plan, reportCode) {
  const feature = getTelegramFeatureFromReportCode(reportCode);
  if (!feature) return isPro(plan);
  return isTelegramFeatureAllowed(plan, feature);
}
