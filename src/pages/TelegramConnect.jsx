import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getActiveTelegramLinkCode,
  generateTelegramLinkCode,
  getTelegramAutoReportSettings,
  upsertTelegramAutoReportSchedule,
  sendTelegramAutoReportTest
} from '../lib/telegramLinkApi';
import { useI18n } from '../i18n';

const DEFAULT_TIMEZONE = 'Asia/Yangon';
const DEFAULT_DAILY_TIME = '08:00';
const DEFAULT_WEEKLY_TIME = '08:00';
const DEFAULT_WEEKLY_DAY = 'SUN';
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

function TelegramConnect() {
  const { t } = useI18n();
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
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);

  const yesterdayToggleLabel = t('telegram.dailyYesterdayToggle');
  const todayToggleLabel = t('telegram.dailyTodayToggle');
  const fallbackYesterdayToggle =
    yesterdayToggleLabel === 'telegram.dailyYesterdayToggle'
      ? t('telegram.dailyEnabled') || 'Yesterday report'
      : yesterdayToggleLabel;
  const fallbackTodayToggle =
    todayToggleLabel === 'telegram.dailyTodayToggle' ? 'Today report' : todayToggleLabel;

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
      const yesterday = schedules.find((row) => row?.type === 'YESTERDAY_DAILY') || null;
      const today = schedules.find((row) => row?.type === 'DAILY') || null;
      const weekly = schedules.find((row) => row?.type === 'WEEKLY') || null;

      setCanManageSchedules(Boolean(payload?.canManage));
      setTelegramLinked(linked);
      setLinkedRecipientsCount(Number(payload?.linkedRecipientsCount || 0));
      setTimezone(String(yesterday?.timezone || today?.timezone || weekly?.timezone || timezoneDefault || DEFAULT_TIMEZONE));

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
    } catch (err) {
      setSettingsError(err?.message || t('telegram.scheduleLoadFailed'));
    } finally {
      setIsLoadingSettings(false);
    }
  }, [t]);

  useEffect(() => {
    loadActiveCode();
    loadAutoReportSettings();
  }, [loadActiveCode, loadAutoReportSettings]);

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
        type: 'YESTERDAY_DAILY',
        enabled: Boolean(yesterdayEnabled),
        time: yesterdayTime || DEFAULT_DAILY_TIME,
        timezone: normalizedTz
      });

      const savedToday = await upsertTelegramAutoReportSchedule({
        id: todayScheduleId || undefined,
        type: 'DAILY',
        enabled: Boolean(todayEnabled),
        time: todayTime || DEFAULT_DAILY_TIME,
        timezone: normalizedTz
      });

      const savedWeekly = await upsertTelegramAutoReportSchedule({
        id: weeklyScheduleId || undefined,
        type: 'WEEKLY',
        enabled: Boolean(weeklyEnabled),
        time: weeklyTime || DEFAULT_WEEKLY_TIME,
        timezone: normalizedTz,
        dayOfWeek: weeklyDayOfWeek || DEFAULT_WEEKLY_DAY
      });

      setYesterdayScheduleId(String(savedYesterday?.id || yesterdayScheduleId || ''));
      setTodayScheduleId(String(savedToday?.id || todayScheduleId || ''));
      setWeeklyScheduleId(String(savedWeekly?.id || weeklyScheduleId || ''));
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
        let targetScheduleId = yesterdayScheduleId || todayScheduleId || weeklyScheduleId;
        if (!targetScheduleId) {
          const createdDaily = await upsertTelegramAutoReportSchedule({
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

  return (
    <div className="stack">
      <section className="card telegram-connect-card">
        <p className="kicker">{t('telegram.kicker')}</p>
        <h3 className="title">{t('telegram.title')}</h3>
        <p className="subtle">{t('telegram.subtitle')}</p>

        <div className="telegram-steps">
          <p className="telegram-step">{t('telegram.step1')}</p>
          <p className="telegram-step">{t('telegram.step2')}</p>
          <p className="telegram-step">{t('telegram.step3')}</p>
        </div>

        {isLoadingLinkCode ? (
          <p className="subtle">{t('telegram.loadingActive')}</p>
        ) : (
          <div className="telegram-code-panel">
            <p className="telegram-code-label">{t('telegram.commandLabel')}</p>
            <p className="telegram-code-value">{activeCode?.telegramCommand || t('telegram.noActiveCode')}</p>
            <p className="subtle" style={{ fontSize: 13 }}>
              {t('telegram.expires')}: {activeCode ? expiresLabel : '-'}
            </p>
          </div>
        )}

        {errorMessage ? <p className="auth-state auth-state-error">{errorMessage}</p> : null}
        {copyMessage ? <p className="auth-state auth-state-success">{copyMessage}</p> : null}

        <div className="toolbar">
          <button type="button" className="btn btn-primary" onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? t('telegram.generating') : activeCode ? t('telegram.generateNew') : t('telegram.generate')}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleCopy}
            disabled={!activeCode?.telegramCommand || isGenerating}
          >
            {t('telegram.copyCommand')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={loadActiveCode} disabled={isGenerating}>
            {t('common.refresh')}
          </button>
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
              <p className="auth-state auth-state-success">
                {t('telegram.linkedRecipients')}: {linkedRecipientsCount}
              </p>
            )}
            {!canManageSchedules ? <p className="auth-state">{t('telegram.ownerOnly')}</p> : null}

            <div className="telegram-schedule-group">
              <label className="toggle" htmlFor="yesterday-enabled-toggle">
                <input
                  id="yesterday-enabled-toggle"
                  type="checkbox"
                  checked={yesterdayEnabled}
                  onChange={(event) => setYesterdayEnabled(event.target.checked)}
                  disabled={!canManageSchedules || isSavingSettings || isSendingTest}
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
                  disabled={!canManageSchedules || isSavingSettings || isSendingTest}
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
                  disabled={!canManageSchedules || isSavingSettings || isSendingTest}
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
                  disabled={!canManageSchedules || isSavingSettings || isSendingTest}
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
                  disabled={!canManageSchedules || isSavingSettings || isSendingTest}
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
                    disabled={!canManageSchedules || isSavingSettings || isSendingTest}
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
                    disabled={!canManageSchedules || isSavingSettings || isSendingTest}
                  />
                </div>
              </div>
            </div>

            <div className="field">
              <p className="label">{t('telegram.timezoneLabel')}</p>
              <select
                className="input"
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                disabled={!canManageSchedules || isSavingSettings || isSendingTest}
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
                {!COMMON_TIMEZONES.includes(timezone) ? (
                  <option value={timezone}>{timezone}</option>
                ) : null}
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
