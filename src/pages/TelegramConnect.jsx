import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getActiveTelegramLinkCode,
  generateTelegramLinkCode,
  getTelegramAutoReportSettings,
  upsertTelegramAutoReportSchedule,
  sendTelegramAutoReportTest,
  getLinkedRecipients,
  disconnectRecipient
} from '../lib/telegramLinkApi';
import { useBusinessProfile } from '../state/businessProfile';
import {
  TELEGRAM_FEATURE_INVENTORY_SUMMARY,
  TELEGRAM_FEATURE_LOW_INVENTORY,
  getTelegramAllowedFeatures,
  isTelegramFeatureAllowed,
  isTelegramReportCodeAllowed
} from '../lib/telegramFeatures';
import { useI18n } from '../i18n';

const DEFAULT_TIMEZONE = 'Asia/Yangon';
const DEFAULT_DAILY_TIME = '08:00';
const DEFAULT_WEEKLY_TIME = '08:00';
const DEFAULT_WEEKLY_DAY = 'SUN';
const DEFAULT_LOW_STOCK_THRESHOLD = 4;
const DEFAULT_LOW_STOCK_MAX_ITEMS = 10;
const LOW_STOCK_MAX_OPTIONS = [10, 20, 50];
const COMMON_TIMEZONES = ['Asia/Yangon', 'Asia/Bangkok', 'Asia/Singapore', 'Asia/Kolkata', 'UTC'];
const DAY_OPTIONS = [
  { value: 'MON', label: 'Monday' },
  { value: 'TUE', label: 'Tuesday' },
  { value: 'WED', label: 'Wednesday' },
  { value: 'THU', label: 'Thursday' },
  { value: 'FRI', label: 'Friday' },
  { value: 'SAT', label: 'Saturday' },
  { value: 'SUN', label: 'Sunday' }
];
const FREQ_DAILY = 'DAILY';
const FREQ_WEEKLY = 'WEEKLY';
const REPORT_CODE_YESTERDAY = 'YESTERDAY_REPORT';
const REPORT_CODE_TODAY = 'TODAY_REPORT';
const REPORT_CODE_WEEKLY = 'WEEKLY_REPORT';
const REPORT_CODE_INVENTORY_SUMMARY = 'INVENTORY_SUMMARY';
const REPORT_CODE_LOW_INVENTORY = 'LOW_INVENTORY_SUMMARY';

const inferReportCode = (row) => {
  const explicit = String(row?.reportCode || '').trim().toUpperCase();
  if (explicit) return explicit;
  if (row?.type === 'YESTERDAY_DAILY') return REPORT_CODE_YESTERDAY;
  if (row?.type === 'WEEKLY') return REPORT_CODE_WEEKLY;
  return REPORT_CODE_TODAY;
};

const formatDateTime = (epochMs) => {
  if (!epochMs) return '-';
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(epochMs));
  } catch (e) {
    return String(epochMs);
  }
};

const normalizeLowThreshold = (value) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return DEFAULT_LOW_STOCK_THRESHOLD;
  }
  return parsed;
};

const normalizeLowMaxItems = (value) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return LOW_STOCK_MAX_OPTIONS.includes(parsed) ? parsed : DEFAULT_LOW_STOCK_MAX_ITEMS;
};

function TelegramConnect() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { entitlement } = useBusinessProfile();
  const [activeCode, setActiveCode] = useState(null);
  const [isLoadingLinkCode, setIsLoadingLinkCode] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');

  const [canManageSchedules, setCanManageSchedules] = useState(false);
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [linkedRecipientsCount, setLinkedRecipientsCount] = useState(0);
  const [recipients, setRecipients] = useState([]);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState(null);
  const [recipientsError, setRecipientsError] = useState('');
  const [yesterdayScheduleId, setYesterdayScheduleId] = useState('');
  const [yesterdayEnabled, setYesterdayEnabled] = useState(false);
  const [yesterdayTime, setYesterdayTime] = useState(DEFAULT_DAILY_TIME);
  const [todayScheduleId, setTodayScheduleId] = useState('');
  const [todayEnabled, setTodayEnabled] = useState(false);
  const [todayTime, setTodayTime] = useState(DEFAULT_DAILY_TIME);
  const [weeklyScheduleId, setWeeklyScheduleId] = useState('');
  const [weeklyEnabled, setWeeklyEnabled] = useState(false);
  const [weeklyDayOfWeek, setWeeklyDayOfWeek] = useState(DEFAULT_WEEKLY_DAY);
  const [weeklyTime, setWeeklyTime] = useState(DEFAULT_WEEKLY_TIME);

  const [inventorySummaryScheduleId, setInventorySummaryScheduleId] = useState('');
  const [inventorySummaryEnabled, setInventorySummaryEnabled] = useState(false);
  const [inventorySummaryFrequency, setInventorySummaryFrequency] = useState(FREQ_DAILY);
  const [inventorySummaryDayOfWeek, setInventorySummaryDayOfWeek] = useState(DEFAULT_WEEKLY_DAY);
  const [inventorySummaryTime, setInventorySummaryTime] = useState(DEFAULT_DAILY_TIME);

  const [lowInventoryScheduleId, setLowInventoryScheduleId] = useState('');
  const [lowInventoryEnabled, setLowInventoryEnabled] = useState(false);
  const [lowInventoryFrequency, setLowInventoryFrequency] = useState(FREQ_DAILY);
  const [lowInventoryDayOfWeek, setLowInventoryDayOfWeek] = useState(DEFAULT_WEEKLY_DAY);
  const [lowInventoryTime, setLowInventoryTime] = useState(DEFAULT_DAILY_TIME);
  const [lowInventoryThreshold, setLowInventoryThreshold] = useState(DEFAULT_LOW_STOCK_THRESHOLD);
  const [lowInventoryIncludeOutOfStock, setLowInventoryIncludeOutOfStock] = useState(true);
  const [lowInventoryMaxItems, setLowInventoryMaxItems] = useState(DEFAULT_LOW_STOCK_MAX_ITEMS);

  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [settingsPlan, setSettingsPlan] = useState('');
  const [settingsAllowedFeatures, setSettingsAllowedFeatures] = useState([]);

  const yesterdayToggleLabel = t('telegram.dailyYesterdayToggle');
  const todayToggleLabel = t('telegram.dailyTodayToggle');
  const fallbackYesterdayToggle =
    yesterdayToggleLabel === 'telegram.dailyYesterdayToggle'
      ? t('telegram.dailyEnabled') || 'Yesterday report'
      : yesterdayToggleLabel;
  const fallbackTodayToggle =
    todayToggleLabel === 'telegram.dailyTodayToggle' ? 'Today report' : todayToggleLabel;

  const entitlementPlan = String(entitlement?.plan || '').trim().toUpperCase();
  const effectivePlan = String(settingsPlan || entitlementPlan || 'PRO').toUpperCase();
  const allowedTelegramFeatures = useMemo(() => {
    if (Array.isArray(settingsAllowedFeatures) && settingsAllowedFeatures.length > 0) {
      return settingsAllowedFeatures;
    }
    return getTelegramAllowedFeatures(effectivePlan);
  }, [effectivePlan, settingsAllowedFeatures]);
  const hasWildcardFeature = allowedTelegramFeatures.includes('*');
  const canUseFeature = useCallback(
    (feature) =>
      hasWildcardFeature ||
      allowedTelegramFeatures.includes(feature) ||
      isTelegramFeatureAllowed(effectivePlan, feature),
    [allowedTelegramFeatures, effectivePlan, hasWildcardFeature]
  );
  const inventorySummaryLocked = !canUseFeature(TELEGRAM_FEATURE_INVENTORY_SUMMARY);
  const lowInventoryLocked = !canUseFeature(TELEGRAM_FEATURE_LOW_INVENTORY);
  const inventoryReportsLocked = inventorySummaryLocked && lowInventoryLocked;

  const loadActiveCode = useCallback(async () => {
    setErrorMessage('');
    try {
      const payload = await getActiveTelegramLinkCode();
      setActiveCode(payload);
    } catch (err) {
      setErrorMessage(err?.message || t('telegram.failedLoad'));
    } finally {
      setIsLoadingLinkCode(false);
    }
  }, [t]);

  const loadAutoReportSettings = useCallback(async () => {
    setSettingsError('');
    setSettingsMessage('');
    setIsLoadingSettings(true);
    try {
      const payload = await getTelegramAutoReportSettings();
      const schedules = Array.isArray(payload?.schedules) ? payload.schedules : [];
      const linked = Boolean(payload?.telegramLinked);
      const timezoneDefault = String(payload?.timezoneDefault || DEFAULT_TIMEZONE) || DEFAULT_TIMEZONE;
      const nextPlan = String(payload?.plan || entitlementPlan || 'PRO').trim().toUpperCase();
      const nextAllowedFeatures = Array.isArray(payload?.allowedFeatures)
        ? payload.allowedFeatures
            .map((feature) => String(feature || '').trim().toLowerCase())
            .filter(Boolean)
        : [];
      const canUseInventorySummary =
        nextAllowedFeatures.includes('*') ||
        nextAllowedFeatures.includes(TELEGRAM_FEATURE_INVENTORY_SUMMARY) ||
        isTelegramReportCodeAllowed(nextPlan, REPORT_CODE_INVENTORY_SUMMARY);
      const canUseLowInventory =
        nextAllowedFeatures.includes('*') ||
        nextAllowedFeatures.includes(TELEGRAM_FEATURE_LOW_INVENTORY) ||
        isTelegramReportCodeAllowed(nextPlan, REPORT_CODE_LOW_INVENTORY);

      const byCode = new Map();
      schedules.forEach((row) => {
        byCode.set(inferReportCode(row), row);
      });

      const yesterday = byCode.get(REPORT_CODE_YESTERDAY) || null;
      const today = byCode.get(REPORT_CODE_TODAY) || null;
      const weekly = byCode.get(REPORT_CODE_WEEKLY) || null;
      const inventorySummary = byCode.get(REPORT_CODE_INVENTORY_SUMMARY) || null;
      const lowInventory = byCode.get(REPORT_CODE_LOW_INVENTORY) || null;

      setCanManageSchedules(Boolean(payload?.canManage));
      setTelegramLinked(linked);
      setLinkedRecipientsCount(Number(payload?.linkedRecipientsCount || 0));
      setSettingsPlan(nextPlan);
      setSettingsAllowedFeatures(nextAllowedFeatures);
      setRecipients([]);
      setTimezone(
        String(
          yesterday?.timezone ||
            today?.timezone ||
            weekly?.timezone ||
            inventorySummary?.timezone ||
            lowInventory?.timezone ||
            timezoneDefault ||
            DEFAULT_TIMEZONE
        )
      );

      setYesterdayScheduleId(String(yesterday?.id || ''));
      setYesterdayEnabled(Boolean(yesterday?.enabled));
      setYesterdayTime(String(yesterday?.time || DEFAULT_DAILY_TIME));

      setTodayScheduleId(String(today?.id || ''));
      setTodayEnabled(Boolean(today?.enabled));
      setTodayTime(String(today?.time || DEFAULT_DAILY_TIME));

      setWeeklyScheduleId(String(weekly?.id || ''));
      setWeeklyEnabled(Boolean(weekly?.enabled));
      setWeeklyDayOfWeek(String(weekly?.dayOfWeek || DEFAULT_WEEKLY_DAY));
      setWeeklyTime(String(weekly?.time || DEFAULT_WEEKLY_TIME));

      setInventorySummaryScheduleId(String(inventorySummary?.id || ''));
      setInventorySummaryEnabled(canUseInventorySummary ? Boolean(inventorySummary?.enabled) : false);
      setInventorySummaryFrequency(
        canUseInventorySummary && inventorySummary?.type === 'WEEKLY' ? FREQ_WEEKLY : FREQ_DAILY
      );
      setInventorySummaryDayOfWeek(
        String(canUseInventorySummary ? inventorySummary?.dayOfWeek || DEFAULT_WEEKLY_DAY : DEFAULT_WEEKLY_DAY)
      );
      setInventorySummaryTime(
        String(canUseInventorySummary ? inventorySummary?.time || DEFAULT_DAILY_TIME : DEFAULT_DAILY_TIME)
      );

      const lowOptions = lowInventory?.options || {};
      setLowInventoryScheduleId(String(lowInventory?.id || ''));
      setLowInventoryEnabled(canUseLowInventory ? Boolean(lowInventory?.enabled) : false);
      setLowInventoryFrequency(canUseLowInventory && lowInventory?.type === 'WEEKLY' ? FREQ_WEEKLY : FREQ_DAILY);
      setLowInventoryDayOfWeek(
        String(canUseLowInventory ? lowInventory?.dayOfWeek || DEFAULT_WEEKLY_DAY : DEFAULT_WEEKLY_DAY)
      );
      setLowInventoryTime(String(canUseLowInventory ? lowInventory?.time || DEFAULT_DAILY_TIME : DEFAULT_DAILY_TIME));
      setLowInventoryThreshold(
        canUseLowInventory ? normalizeLowThreshold(lowOptions?.lowStockThreshold) : DEFAULT_LOW_STOCK_THRESHOLD
      );
      setLowInventoryIncludeOutOfStock(
        canUseLowInventory && typeof lowOptions?.includeOutOfStock === 'boolean'
          ? lowOptions.includeOutOfStock
          : true
      );
      setLowInventoryMaxItems(canUseLowInventory ? normalizeLowMaxItems(lowOptions?.maxItems) : DEFAULT_LOW_STOCK_MAX_ITEMS);
    } catch (err) {
      setSettingsError(err?.message || t('telegram.scheduleLoadFailed'));
    } finally {
      setIsLoadingSettings(false);
    }
  }, [entitlementPlan, t]);

  const loadRecipients = useCallback(async () => {
    if (!telegramLinked) {
      setRecipients([]);
      return;
    }
    setRecipientsError('');
    setRecipientsLoading(true);
    try {
      const payload = await getLinkedRecipients();
      const list = Array.isArray(payload?.recipients) ? payload.recipients : [];
      setRecipients(list);
    } catch (err) {
      setRecipientsError(err?.message || t('telegram.recipientsLoadFailed'));
      setRecipients([]);
    } finally {
      setRecipientsLoading(false);
    }
  }, [telegramLinked, t]);

  useEffect(() => {
    loadActiveCode();
    loadAutoReportSettings();
  }, [loadActiveCode, loadAutoReportSettings]);

  useEffect(() => {
    if (telegramLinked) {
      loadRecipients();
    } else {
      setRecipients([]);
    }
  }, [telegramLinked, loadRecipients]);

  useEffect(() => {
    if (inventorySummaryLocked && inventorySummaryEnabled) {
      setInventorySummaryEnabled(false);
    }
    if (lowInventoryLocked && lowInventoryEnabled) {
      setLowInventoryEnabled(false);
    }
  }, [
    inventorySummaryEnabled,
    inventorySummaryLocked,
    lowInventoryEnabled,
    lowInventoryLocked
  ]);

  const expiresLabel = useMemo(() => formatDateTime(activeCode?.expiresAt), [activeCode?.expiresAt]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setCopyMessage('');
    setErrorMessage('');
    try {
      const created = await generateTelegramLinkCode();
      setActiveCode(created);
    } catch (err) {
      setErrorMessage(err?.message || t('telegram.generateFailed'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!activeCode?.telegramCommand) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(activeCode.telegramCommand);
      } else {
        const area = document.createElement('textarea');
        area.value = activeCode.telegramCommand;
        area.setAttribute('readonly', '');
        area.style.position = 'absolute';
        area.style.left = '-9999px';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        document.body.removeChild(area);
      }
      setCopyMessage(t('telegram.copied'));
    } catch (err) {
      setCopyMessage(t('telegram.copyFailed'));
    }
  };

  const handleSaveSchedules = async () => {
    if (!canManageSchedules) {
      setSettingsError(t('telegram.ownerOnly'));
      return;
    }
    setIsSavingSettings(true);
    setSettingsError('');
    setSettingsMessage('');
    try {
      const normalizedTz = String(timezone || DEFAULT_TIMEZONE).trim() || DEFAULT_TIMEZONE;
      const savedYesterday = await upsertTelegramAutoReportSchedule({
        id: yesterdayScheduleId || undefined,
        reportCode: REPORT_CODE_YESTERDAY,
        type: 'YESTERDAY_DAILY',
        enabled: Boolean(yesterdayEnabled),
        time: yesterdayTime || DEFAULT_DAILY_TIME,
        timezone: normalizedTz
      });

      const savedToday = await upsertTelegramAutoReportSchedule({
        id: todayScheduleId || undefined,
        reportCode: REPORT_CODE_TODAY,
        type: 'DAILY',
        enabled: Boolean(todayEnabled),
        time: todayTime || DEFAULT_DAILY_TIME,
        timezone: normalizedTz
      });

      const savedWeekly = await upsertTelegramAutoReportSchedule({
        id: weeklyScheduleId || undefined,
        reportCode: REPORT_CODE_WEEKLY,
        type: 'WEEKLY',
        enabled: Boolean(weeklyEnabled),
        time: weeklyTime || DEFAULT_WEEKLY_TIME,
        timezone: normalizedTz,
        dayOfWeek: weeklyDayOfWeek || DEFAULT_WEEKLY_DAY
      });

      let savedInventorySummary = null;
      if (!inventorySummaryLocked) {
        savedInventorySummary = await upsertTelegramAutoReportSchedule({
          id: inventorySummaryScheduleId || undefined,
          reportCode: REPORT_CODE_INVENTORY_SUMMARY,
          type: inventorySummaryFrequency === FREQ_WEEKLY ? 'WEEKLY' : 'DAILY',
          enabled: Boolean(inventorySummaryEnabled),
          time: inventorySummaryTime || DEFAULT_DAILY_TIME,
          timezone: normalizedTz,
          dayOfWeek: inventorySummaryFrequency === FREQ_WEEKLY ? inventorySummaryDayOfWeek || DEFAULT_WEEKLY_DAY : undefined
        });
      }

      let savedLowInventory = null;
      if (!lowInventoryLocked) {
        savedLowInventory = await upsertTelegramAutoReportSchedule({
          id: lowInventoryScheduleId || undefined,
          reportCode: REPORT_CODE_LOW_INVENTORY,
          type: lowInventoryFrequency === FREQ_WEEKLY ? 'WEEKLY' : 'DAILY',
          enabled: Boolean(lowInventoryEnabled),
          time: lowInventoryTime || DEFAULT_DAILY_TIME,
          timezone: normalizedTz,
          dayOfWeek: lowInventoryFrequency === FREQ_WEEKLY ? lowInventoryDayOfWeek || DEFAULT_WEEKLY_DAY : undefined,
          lowStockThreshold: Math.max(0, normalizeLowThreshold(lowInventoryThreshold)),
          includeOutOfStock: Boolean(lowInventoryIncludeOutOfStock),
          maxItems: normalizeLowMaxItems(lowInventoryMaxItems)
        });
      }

      setYesterdayScheduleId(String(savedYesterday?.id || yesterdayScheduleId || ''));
      setTodayScheduleId(String(savedToday?.id || todayScheduleId || ''));
      setWeeklyScheduleId(String(savedWeekly?.id || weeklyScheduleId || ''));
      setInventorySummaryScheduleId(
        String(savedInventorySummary?.id || inventorySummaryScheduleId || '')
      );
      setLowInventoryScheduleId(String(savedLowInventory?.id || lowInventoryScheduleId || ''));
      setSettingsMessage(t('telegram.scheduleSaved'));
      await loadAutoReportSettings();
    } catch (err) {
      setSettingsError(err?.message || t('telegram.scheduleSaveFailed'));
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSendTestReport = async () => {
    setIsSendingTest(true);
    setSettingsError('');
    setSettingsMessage('');
    try {
      let targetScheduleId =
        yesterdayScheduleId ||
        todayScheduleId ||
        weeklyScheduleId;
      if (!targetScheduleId && !inventorySummaryLocked) {
        targetScheduleId = inventorySummaryScheduleId;
      }
      if (!targetScheduleId && !lowInventoryLocked) {
        targetScheduleId = lowInventoryScheduleId;
      }
      if (!targetScheduleId) {
        const createdDaily = await upsertTelegramAutoReportSchedule({
          reportCode: REPORT_CODE_YESTERDAY,
          type: 'YESTERDAY_DAILY',
          enabled: false,
          time: yesterdayTime || DEFAULT_DAILY_TIME,
          timezone: String(timezone || DEFAULT_TIMEZONE).trim() || DEFAULT_TIMEZONE
        });
        targetScheduleId = String(createdDaily?.id || '');
        setYesterdayScheduleId(targetScheduleId);
      }
      if (!targetScheduleId) {
        throw new Error(t('telegram.scheduleMissingForTest'));
      }
      await sendTelegramAutoReportTest(targetScheduleId);
      setSettingsMessage(t('telegram.testQueued'));
      await loadAutoReportSettings();
    } catch (err) {
      setSettingsError(err?.message || t('telegram.testFailed'));
    } finally {
      setIsSendingTest(false);
    }
  };

  const controlsDisabled = !canManageSchedules || isSavingSettings || isSendingTest;
  const inventoryControlsDisabled = controlsDisabled || inventoryReportsLocked;
  const handleUpgradeToPro = () => {
    navigate('/more/subscribe');
  };

  const TELEGRAM_BOT_URL = 'https://t.me/BizCashflowBot';

  const handleOpenBot = () => {
    window.open(TELEGRAM_BOT_URL, '_blank', 'noopener,noreferrer');
  };

  const handleCopyAndOpen = async () => {
    await handleCopy();
    // Small delay so the user sees the "copied" feedback
    setTimeout(() => {
      handleOpenBot();
    }, 400);
  };

  const handleDisconnect = async (telegramUserId) => {
    if (!canManageSchedules || !telegramUserId) return;
    setRecipientsError('');
    setDisconnectingId(telegramUserId);
    try {
      await disconnectRecipient(telegramUserId);
      await loadRecipients();
      await loadAutoReportSettings();
    } catch (err) {
      setRecipientsError(err?.message || t('telegram.disconnectFailed'));
    } finally {
      setDisconnectingId(null);
    }
  };

  return (
    <div className="stack">
      <section className="card telegram-connect-card">
        <div className="tg-header">
          <div className="tg-icon-circle">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.28-.02-.12.03-2.02 1.28-5.69 3.77-.54.37-1.03.55-1.47.54-.48-.01-1.4-.27-2.09-.49-.84-.27-1.51-.42-1.45-.88.03-.24.37-.49 1.02-.74 3.98-1.73 6.64-2.88 7.97-3.43 3.8-1.58 4.59-1.86 5.1-1.87.11 0 .37.03.53.17.14.12.18.28.2.45-.01.06.01.24 0 .41z" fill="currentColor"/>
            </svg>
          </div>
          <div>
            <p className="kicker">{t('telegram.kicker')}</p>
            <h3 className="title">{t('telegram.title')}</h3>
          </div>
        </div>
        <p className="subtle">{t('telegram.subtitle')}</p>

        {/* Step-by-step guide */}
        <div className="tg-steps-flow">
          <div className="tg-step-item">
            <div className="tg-step-number">1</div>
            <div className="tg-step-body">
              <p className="tg-step-title">{t('telegram.stepGenTitle')}</p>
              <p className="tg-step-desc">{t('telegram.stepGenDesc')}</p>
            </div>
          </div>
          <div className="tg-step-connector" />
          <div className="tg-step-item">
            <div className="tg-step-number">2</div>
            <div className="tg-step-body">
              <p className="tg-step-title">{t('telegram.stepOpenTitle')}</p>
              <p className="tg-step-desc">{t('telegram.stepOpenDesc')}</p>
            </div>
          </div>
          <div className="tg-step-connector" />
          <div className="tg-step-item">
            <div className="tg-step-number">3</div>
            <div className="tg-step-body">
              <p className="tg-step-title">{t('telegram.stepSendTitle')}</p>
              <p className="tg-step-desc">{t('telegram.stepSendDesc')}</p>
            </div>
          </div>
        </div>

        {/* Command code panel */}
        {isLoadingLinkCode ? (
          <div className="tg-loading-skeleton">
            <div className="tg-skeleton-line" />
            <div className="tg-skeleton-line short" />
          </div>
        ) : (
          <div className="tg-command-card">
            <p className="tg-command-label">{t('telegram.commandLabel')}</p>
            <div className="tg-command-row">
              <code className="tg-command-code">
                {activeCode?.telegramCommand || t('telegram.noActiveCode')}
              </code>
              {activeCode?.telegramCommand && (
                <button type="button" className="tg-copy-btn" onClick={handleCopy} title={t('telegram.copyCommand')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
              )}
            </div>
            {activeCode && (
              <p className="tg-expires">{t('telegram.expires')}: {expiresLabel}</p>
            )}
          </div>
        )}

        {errorMessage ? <p className="auth-state auth-state-error">{errorMessage}</p> : null}
        {copyMessage ? <p className="auth-state auth-state-success">{copyMessage}</p> : null}

        {/* Primary actions */}
        <div className="tg-actions">
          {!activeCode?.telegramCommand ? (
            <button type="button" className="btn btn-primary tg-btn-full" onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? t('telegram.generating') : t('telegram.generate')}
            </button>
          ) : (
            <>
              <button type="button" className="tg-bot-link-btn" onClick={handleCopyAndOpen}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.28-.02-.12.03-2.02 1.28-5.69 3.77-.54.37-1.03.55-1.47.54-.48-.01-1.4-.27-2.09-.49-.84-.27-1.51-.42-1.45-.88.03-.24.37-.49 1.02-.74 3.98-1.73 6.64-2.88 7.97-3.43 3.8-1.58 4.59-1.86 5.1-1.87.11 0 .37.03.53.17.14.12.18.28.2.45-.01.06.01.24 0 .41z" fill="currentColor"/>
                </svg>
                {t('telegram.openBotAndSend')}
              </button>
              <div className="tg-secondary-actions">
                <button type="button" className="btn btn-secondary" onClick={handleGenerate} disabled={isGenerating}>
                  {isGenerating ? t('telegram.generating') : t('telegram.generateNew')}
                </button>
                <button type="button" className="btn btn-ghost" onClick={loadActiveCode} disabled={isGenerating}>
                  {t('common.refresh')}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Direct bot link */}
        <div className="tg-bot-hint">
          <p>{t('telegram.botHint')}</p>
          <a href={TELEGRAM_BOT_URL} target="_blank" rel="noopener noreferrer" className="tg-bot-url">
            @BizCashflowBot
          </a>
        </div>
      </section>

      <section className="card telegram-connect-card">
        <p className="kicker">{t('telegram.scheduleKicker')}</p>
        <h3 className="title">{t('telegram.scheduleTitle')}</h3>
        <p className="subtle">{t('telegram.scheduleSubtitle')}</p>

        {isLoadingSettings ? (
          <p className="subtle">{t('telegram.loadingSchedules')}</p>
        ) : (
          <>
            {!telegramLinked ? (
              <p className="auth-state">{t('telegram.notLinkedFirst')}</p>
            ) : (
              <>
                <p className="auth-state auth-state-success">
                  {t('telegram.linkedRecipients')}: {linkedRecipientsCount}
                </p>
                {canManageSchedules && linkedRecipientsCount > 0 ? (
                  <div className="tg-recipients-block">
                    <p className="label">{t('telegram.connectedRecipientsTitle')}</p>
                    {recipientsError ? (
                      <p className="auth-state auth-state-error">{recipientsError}</p>
                    ) : null}
                    {recipientsLoading ? (
                      <p className="subtle">{t('telegram.loadingRecipients')}</p>
                    ) : recipients.length > 0 ? (
                      <ul className="tg-recipients-list">
                        {recipients.map((r) => (
                          <li key={r.telegramUserId} className="tg-recipient-row">
                            <span className="tg-recipient-id">
                              {t('telegram.recipientId')}: {r.telegramUserId}
                              {r.linkedAt ? (
                                <span className="tg-recipient-meta">
                                  {' · '}
                                  {formatDateTime(r.linkedAt)}
                                </span>
                              ) : null}
                            </span>
                            <button
                              type="button"
                              className="btn btn-ghost tg-disconnect-btn"
                              onClick={() => handleDisconnect(r.telegramUserId)}
                              disabled={disconnectingId !== null}
                              title={t('telegram.disconnectTitle')}
                            >
                              {disconnectingId === r.telegramUserId
                                ? t('telegram.disconnecting')
                                : t('telegram.disconnect')}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
            {!canManageSchedules ? <p className="auth-state">{t('telegram.ownerOnly')}</p> : null}

            <div className="telegram-schedule-group">
              <label className="toggle" htmlFor="yesterday-enabled-toggle">
                <input
                  id="yesterday-enabled-toggle"
                  type="checkbox"
                  checked={yesterdayEnabled}
                  onChange={(event) => setYesterdayEnabled(event.target.checked)}
                  disabled={controlsDisabled}
                />
                {fallbackYesterdayToggle}
              </label>
              <div className="field">
                <p className="label">{t('telegram.dailyTime')}</p>
                <input
                  className="input"
                  type="time"
                  value={yesterdayTime}
                  onChange={(event) => setYesterdayTime(event.target.value)}
                  disabled={controlsDisabled}
                />
              </div>
            </div>

            <div className="telegram-schedule-group">
              <label className="toggle" htmlFor="today-enabled-toggle">
                <input
                  id="today-enabled-toggle"
                  type="checkbox"
                  checked={todayEnabled}
                  onChange={(event) => setTodayEnabled(event.target.checked)}
                  disabled={controlsDisabled}
                />
                {fallbackTodayToggle}
              </label>
              <div className="field">
                <p className="label">{t('telegram.dailyTime')}</p>
                <input
                  className="input"
                  type="time"
                  value={todayTime}
                  onChange={(event) => setTodayTime(event.target.value)}
                  disabled={controlsDisabled}
                />
              </div>
            </div>

            <div className="telegram-schedule-group">
              <label className="toggle" htmlFor="weekly-enabled-toggle">
                <input
                  id="weekly-enabled-toggle"
                  type="checkbox"
                  checked={weeklyEnabled}
                  onChange={(event) => setWeeklyEnabled(event.target.checked)}
                  disabled={controlsDisabled}
                />
                {t('telegram.weeklyEnabled')}
              </label>
              <div className="telegram-weekly-row">
                <div className="field">
                  <p className="label">{t('telegram.weeklyDay')}</p>
                  <select
                    className="input"
                    value={weeklyDayOfWeek}
                    onChange={(event) => setWeeklyDayOfWeek(event.target.value)}
                    disabled={controlsDisabled}
                  >
                    {DAY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <p className="label">{t('telegram.weeklyTime')}</p>
                  <input
                    className="input"
                    type="time"
                    value={weeklyTime}
                    onChange={(event) => setWeeklyTime(event.target.value)}
                    disabled={controlsDisabled}
                  />
                </div>
              </div>
            </div>

            <div className="telegram-inventory-section">
              <p className="telegram-inventory-kicker">
                {t('telegram.inventoryKicker') === 'telegram.inventoryKicker'
                  ? 'INVENTORY REPORTS'
                  : t('telegram.inventoryKicker')}
              </p>
              {inventoryReportsLocked ? (
                <div className="telegram-plan-lock">
                  <span className="telegram-plan-lock-badge">{t('telegram.proOnly')}</span>
                  <p className="subtle telegram-helper-text">{t('telegram.inventoryUpgradeHint')}</p>
                  <button type="button" className="btn btn-upgrade telegram-plan-lock-btn" onClick={handleUpgradeToPro}>
                    {t('telegram.upgradeToPro')}
                  </button>
                </div>
              ) : null}

              <div className={`telegram-schedule-group${inventorySummaryLocked ? ' telegram-schedule-group-locked' : ''}`}>
                <label className="toggle" htmlFor="inventory-summary-enabled-toggle">
                  <input
                    id="inventory-summary-enabled-toggle"
                    type="checkbox"
                    checked={inventorySummaryEnabled}
                    onChange={(event) => setInventorySummaryEnabled(event.target.checked)}
                    disabled={inventoryControlsDisabled}
                  />
                  <span>
                    {t('telegram.inventorySummaryEnabled') === 'telegram.inventorySummaryEnabled'
                      ? 'Enable Inventory Summary'
                      : t('telegram.inventorySummaryEnabled')}
                  </span>
                  {inventorySummaryLocked ? <span className="telegram-pro-pill">{t('telegram.proOnly')}</span> : null}
                </label>
                <p className="subtle telegram-helper-text">
                  {inventorySummaryLocked
                    ? t('telegram.inventoryUpgradeHint')
                    : t('telegram.inventorySummaryHelper') === 'telegram.inventorySummaryHelper'
                      ? 'Sends stock overview: in stock, out of stock, low stock count.'
                      : t('telegram.inventorySummaryHelper')}
                </p>

                {inventorySummaryEnabled ? (
                  <>
                    <div className="telegram-frequency-tabs" role="group" aria-label="Inventory summary frequency">
                      <button
                        type="button"
                        className={`telegram-frequency-tab ${
                          inventorySummaryFrequency === FREQ_DAILY ? 'active' : ''
                        }`}
                        onClick={() => setInventorySummaryFrequency(FREQ_DAILY)}
                        disabled={inventoryControlsDisabled}
                      >
                        {t('telegram.frequencyDaily') === 'telegram.frequencyDaily'
                          ? 'Daily'
                          : t('telegram.frequencyDaily')}
                      </button>
                      <button
                        type="button"
                        className={`telegram-frequency-tab ${
                          inventorySummaryFrequency === FREQ_WEEKLY ? 'active' : ''
                        }`}
                        onClick={() => setInventorySummaryFrequency(FREQ_WEEKLY)}
                        disabled={inventoryControlsDisabled}
                      >
                        {t('telegram.frequencyWeekly') === 'telegram.frequencyWeekly'
                          ? 'Weekly'
                          : t('telegram.frequencyWeekly')}
                      </button>
                    </div>

                    {inventorySummaryFrequency === FREQ_WEEKLY ? (
                      <div className="telegram-weekly-row">
                        <div className="field">
                          <p className="label">{t('telegram.weeklyDay')}</p>
                          <select
                            className="input"
                            value={inventorySummaryDayOfWeek}
                            onChange={(event) => setInventorySummaryDayOfWeek(event.target.value)}
                            disabled={inventoryControlsDisabled}
                          >
                            {DAY_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <p className="label">{t('telegram.weeklyTime')}</p>
                          <input
                            className="input"
                            type="time"
                            value={inventorySummaryTime}
                            onChange={(event) => setInventorySummaryTime(event.target.value)}
                            disabled={inventoryControlsDisabled}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="field">
                        <p className="label">{t('telegram.dailyTime')}</p>
                        <input
                          className="input"
                          type="time"
                          value={inventorySummaryTime}
                          onChange={(event) => setInventorySummaryTime(event.target.value)}
                          disabled={inventoryControlsDisabled}
                        />
                      </div>
                    )}
                  </>
                ) : null}
              </div>

              <div className={`telegram-schedule-group${lowInventoryLocked ? ' telegram-schedule-group-locked' : ''}`}>
                <label className="toggle" htmlFor="low-inventory-enabled-toggle">
                  <input
                    id="low-inventory-enabled-toggle"
                    type="checkbox"
                    checked={lowInventoryEnabled}
                    onChange={(event) => setLowInventoryEnabled(event.target.checked)}
                    disabled={inventoryControlsDisabled}
                  />
                  <span>
                    {t('telegram.lowInventoryEnabled') === 'telegram.lowInventoryEnabled'
                      ? 'Enable Low Inventory Report'
                      : t('telegram.lowInventoryEnabled')}
                  </span>
                  {lowInventoryLocked ? <span className="telegram-pro-pill">{t('telegram.proOnly')}</span> : null}
                </label>

                {lowInventoryEnabled ? (
                  <>
                    <div className="field">
                      <p className="label">
                        {t('telegram.lowInventoryThresholdLabel') === 'telegram.lowInventoryThresholdLabel'
                          ? 'Low stock when quantity is below'
                          : t('telegram.lowInventoryThresholdLabel')}
                      </p>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="1"
                        value={String(lowInventoryThreshold)}
                        onChange={(event) => setLowInventoryThreshold(normalizeLowThreshold(event.target.value))}
                        disabled={inventoryControlsDisabled}
                      />
                    </div>

                    <p className="subtle telegram-helper-text">
                      {t('telegram.lowInventoryThresholdHelp') === 'telegram.lowInventoryThresholdHelp'
                        ? 'Example: 4 means items with 0-3 will be included.'
                        : t('telegram.lowInventoryThresholdHelp')}
                    </p>

                    <label className="toggle" htmlFor="low-inventory-include-out-toggle">
                      <input
                        id="low-inventory-include-out-toggle"
                        type="checkbox"
                        checked={lowInventoryIncludeOutOfStock}
                        onChange={(event) => setLowInventoryIncludeOutOfStock(event.target.checked)}
                        disabled={inventoryControlsDisabled}
                      />
                      {t('telegram.lowInventoryIncludeOut') === 'telegram.lowInventoryIncludeOut'
                        ? 'Include out of stock (0)'
                        : t('telegram.lowInventoryIncludeOut')}
                    </label>

                    <div className="field">
                      <p className="label">
                        {t('telegram.lowInventoryMaxItems') === 'telegram.lowInventoryMaxItems'
                          ? 'Max items'
                          : t('telegram.lowInventoryMaxItems')}
                      </p>
                      <select
                        className="input"
                        value={String(lowInventoryMaxItems)}
                        onChange={(event) => setLowInventoryMaxItems(normalizeLowMaxItems(event.target.value))}
                        disabled={inventoryControlsDisabled}
                      >
                        {LOW_STOCK_MAX_OPTIONS.map((value) => (
                          <option key={value} value={String(value)}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="telegram-frequency-tabs" role="group" aria-label="Low inventory report frequency">
                      <button
                        type="button"
                        className={`telegram-frequency-tab ${lowInventoryFrequency === FREQ_DAILY ? 'active' : ''}`}
                        onClick={() => setLowInventoryFrequency(FREQ_DAILY)}
                        disabled={inventoryControlsDisabled}
                      >
                        {t('telegram.frequencyDaily') === 'telegram.frequencyDaily'
                          ? 'Daily'
                          : t('telegram.frequencyDaily')}
                      </button>
                      <button
                        type="button"
                        className={`telegram-frequency-tab ${lowInventoryFrequency === FREQ_WEEKLY ? 'active' : ''}`}
                        onClick={() => setLowInventoryFrequency(FREQ_WEEKLY)}
                        disabled={inventoryControlsDisabled}
                      >
                        {t('telegram.frequencyWeekly') === 'telegram.frequencyWeekly'
                          ? 'Weekly'
                          : t('telegram.frequencyWeekly')}
                      </button>
                    </div>

                    {lowInventoryFrequency === FREQ_WEEKLY ? (
                      <div className="telegram-weekly-row">
                        <div className="field">
                          <p className="label">{t('telegram.weeklyDay')}</p>
                          <select
                            className="input"
                            value={lowInventoryDayOfWeek}
                            onChange={(event) => setLowInventoryDayOfWeek(event.target.value)}
                            disabled={inventoryControlsDisabled}
                          >
                            {DAY_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <p className="label">{t('telegram.weeklyTime')}</p>
                          <input
                            className="input"
                            type="time"
                            value={lowInventoryTime}
                            onChange={(event) => setLowInventoryTime(event.target.value)}
                            disabled={inventoryControlsDisabled}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="field">
                        <p className="label">{t('telegram.dailyTime')}</p>
                        <input
                          className="input"
                          type="time"
                          value={lowInventoryTime}
                          onChange={(event) => setLowInventoryTime(event.target.value)}
                          disabled={inventoryControlsDisabled}
                        />
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            </div>

            <div className="field">
              <p className="label">{t('telegram.timezoneLabel')}</p>
              <select
                className="input"
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                disabled={controlsDisabled}
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
                {!COMMON_TIMEZONES.includes(timezone) ? <option value={timezone}>{timezone}</option> : null}
              </select>
            </div>

            {settingsError ? <p className="auth-state auth-state-error">{settingsError}</p> : null}
            {settingsMessage ? <p className="auth-state auth-state-success">{settingsMessage}</p> : null}

            <div className="toolbar">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveSchedules}
                disabled={!canManageSchedules || !telegramLinked || isSavingSettings || isSendingTest}
              >
                {isSavingSettings ? t('telegram.savingSchedules') : t('telegram.saveSchedules')}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleSendTestReport}
                disabled={!canManageSchedules || !telegramLinked || isSavingSettings || isSendingTest}
              >
                {isSendingTest ? t('telegram.sendingTest') : t('telegram.sendTestNow')}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={loadAutoReportSettings}
                disabled={isSavingSettings || isSendingTest}
              >
                {t('common.refresh')}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default TelegramConnect;
