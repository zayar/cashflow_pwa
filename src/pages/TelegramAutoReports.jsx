import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/Modal';
import { useI18n } from '../i18n';
import {
  deleteTelegramAutoReportSchedule,
  getTelegramAutoReports,
  sendTelegramAutoReportTest,
  upsertTelegramAutoReportSchedule
} from '../lib/telegramAutoReportsApi';

const formatInTz = (epochMs, timeZone) => {
  if (!epochMs) return '-';
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timeZone || undefined
    }).format(new Date(epochMs));
  } catch {
    try {
      return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      }).format(new Date(epochMs));
    } catch {
      return String(epochMs);
    }
  }
};

const formatScheduleLabel = (type, t) => {
  if (type === 'DAILY') return t('telegramAutoReports.templateDaily');
  if (type === 'YESTERDAY_DAILY') return t('telegramAutoReports.templateYesterday');
  if (type === 'WEEKLY') return t('telegramAutoReports.templateWeekly');
  return String(type || '-');
};

const badgeForStatus = (status) => {
  const s = String(status || '').toLowerCase();
  if (s.includes('sent')) return 'badge badge-success';
  if (s.includes('retry') || s.includes('partial')) return 'badge badge-warning';
  if (s.includes('fail') || s.includes('error')) return 'badge badge-danger';
  return 'badge badge-neutral';
};

const defaultScheduleDraft = (type, timezoneDefault) => {
  if (type === 'DAILY') {
    return { type: 'DAILY', time: '19:00', timezone: timezoneDefault || 'Asia/Yangon', dayOfWeek: 'SUN', enabled: true };
  }
  if (type === 'YESTERDAY_DAILY') {
    return { type: 'YESTERDAY_DAILY', time: '08:00', timezone: timezoneDefault || 'Asia/Yangon', dayOfWeek: 'SUN', enabled: true };
  }
  return { type: 'WEEKLY', time: '08:00', timezone: timezoneDefault || 'Asia/Yangon', dayOfWeek: 'SUN', enabled: true };
};

const samplePreview = (draft, t) => {
  const today = new Date().toISOString().slice(0, 10);
  if (draft.type === 'WEEKLY') {
    return (
      `အပတ်စဉ် အကျဉ်းချုပ် (${today} မှ ${today})\n` +
      `- ဘောင်ချာ: 0 စောင်\n` +
      `- ဖောက်သည်: 0 ယောက်\n` +
      `- ရောင်းအား: 0 MMK\n` +
      `- လက်ခံငွေ: 0 MMK\n` +
      `- ကျန်ငွေ: 0 MMK`
    );
  }
  const title =
    draft.type === 'YESTERDAY_DAILY'
      ? t('telegramAutoReports.previewYesterdayTitle')
      : t('telegramAutoReports.previewTodayTitle');
  return (
    `${title} (${today})\n` +
    `- ရောင်းအား: 0 MMK\n` +
    `- ဘောင်ချာ: 0 စောင်\n` +
    `- ဖောက်သည်: 0 ယောက်\n` +
    `- လက်ခံငွေ: 0 MMK`
  );
};

function TelegramAutoReports() {
  const navigate = useNavigate();
  const { t } = useI18n();

  const [payload, setPayload] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [editing, setEditing] = useState(null);

  const [draft, setDraft] = useState(() => defaultScheduleDraft('DAILY', 'Asia/Yangon'));

  const timezoneDefault = payload?.timezoneDefault || 'Asia/Yangon';
  const canManage = Boolean(payload?.canManage);
  const telegramLinked = Boolean(payload?.telegramLinked);

  const load = useCallback(async () => {
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const data = await getTelegramAutoReports();
      setPayload(data);
    } catch (err) {
      setErrorMessage(err?.message || 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const schedules = useMemo(() => payload?.schedules || [], [payload?.schedules]);

  const openCreate = (type) => {
    setSuccessMessage('');
    setErrorMessage('');
    setEditing({ mode: 'create' });
    setDraft(defaultScheduleDraft(type, timezoneDefault));
  };

  const openEdit = (schedule) => {
    setSuccessMessage('');
    setErrorMessage('');
    setEditing({ mode: 'edit', schedule });
    setDraft({
      id: schedule?.id,
      type: schedule?.type || 'DAILY',
      time: schedule?.time || '19:00',
      timezone: schedule?.timezone || timezoneDefault,
      dayOfWeek: schedule?.dayOfWeek || 'SUN',
      enabled: Boolean(schedule?.enabled)
    });
  };

  const closeModal = () => setEditing(null);

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const toSend = {
        id: draft.id,
        type: draft.type,
        enabled: Boolean(draft.enabled),
        time: draft.time,
        timezone: draft.timezone,
        dayOfWeek: draft.type === 'WEEKLY' ? draft.dayOfWeek : undefined
      };
      await upsertTelegramAutoReportSchedule(toSend);
      setSuccessMessage(t('telegramAutoReports.saved'));
      closeModal();
      await load();
    } catch (err) {
      setErrorMessage(err?.message || t('telegramAutoReports.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (schedule) => {
    if (!canManage) return;
    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await upsertTelegramAutoReportSchedule({
        id: schedule.id,
        type: schedule.type,
        enabled: !schedule.enabled,
        time: schedule.time,
        timezone: schedule.timezone,
        dayOfWeek: schedule.type === 'WEEKLY' ? schedule.dayOfWeek : undefined
      });
      await load();
    } catch (err) {
      setErrorMessage(err?.message || t('telegramAutoReports.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async (schedule) => {
    if (!canManage) return;
    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await sendTelegramAutoReportTest(schedule.id);
      setSuccessMessage(t('telegramAutoReports.testQueued'));
      await load();
    } catch (err) {
      setErrorMessage(err?.message || t('telegramAutoReports.testFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (schedule) => {
    if (!canManage) return;
    const ok = window.confirm(t('telegramAutoReports.deleteConfirm'));
    if (!ok) return;

    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await deleteTelegramAutoReportSchedule(schedule.id);
      setSuccessMessage(t('telegramAutoReports.deleted'));
      await load();
    } catch (err) {
      setErrorMessage(err?.message || t('telegramAutoReports.deleteFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="stack">
        <section className="card">
          <p className="subtle">{t('common.loading')}</p>
        </section>
      </div>
    );
  }

  return (
    <div className="stack">
      {!telegramLinked ? (
        <section className="card">
          <p className="kicker">{t('telegramAutoReports.kicker')}</p>
          <h3 className="title">{t('telegramAutoReports.connectFirstTitle')}</h3>
          <p className="subtle">{t('telegramAutoReports.connectFirstCopy')}</p>
          <div className="toolbar">
            <button type="button" className="btn btn-primary" onClick={() => navigate('/more/integrations/telegram')}>
              {t('telegramAutoReports.connectCta')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={load}>
              {t('common.refresh')}
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="card">
            <p className="kicker">{t('telegramAutoReports.kicker')}</p>
            <h3 className="title" style={{ marginBottom: 6 }}>
              {t('telegramAutoReports.title')}
            </h3>
            <p className="subtle">{t('telegramAutoReports.subtitle')}</p>

            <div className="list-meta" style={{ marginTop: 10 }}>
              <span className="meta-chip">
                {t('telegramAutoReports.linkedChats')}: {payload?.linkedRecipientsCount || 0}
              </span>
              <span className="meta-chip">
                {t('telegramAutoReports.defaultTimezone')}: {timezoneDefault}
              </span>
              {!canManage ? <span className="meta-chip">{t('telegramAutoReports.ownerOnly')}</span> : null}
            </div>
          </section>

          <section className="card">
            <p className="kicker">{t('telegramAutoReports.templatesKicker')}</p>
            <h3 className="title" style={{ marginBottom: 6 }}>
              {t('telegramAutoReports.templatesTitle')}
            </h3>
            <div className="feature-list" style={{ marginTop: 10 }}>
              <div className="feature-row">
                <div>
                  <p style={{ margin: 0, fontWeight: 800 }}>{t('telegramAutoReports.templateDaily')}</p>
                  <p className="subtle" style={{ fontSize: 13, margin: 0 }}>
                    {t('telegramAutoReports.templateDailyCopy')}
                  </p>
                </div>
                <button type="button" className="btn btn-secondary" onClick={() => openCreate('DAILY')} disabled={!canManage || isSaving}>
                  {t('telegramAutoReports.create')}
                </button>
              </div>

              <div className="feature-row">
                <div>
                  <p style={{ margin: 0, fontWeight: 800 }}>{t('telegramAutoReports.templateYesterday')}</p>
                  <p className="subtle" style={{ fontSize: 13, margin: 0 }}>
                    {t('telegramAutoReports.templateYesterdayCopy')}
                  </p>
                </div>
                <button type="button" className="btn btn-secondary" onClick={() => openCreate('YESTERDAY_DAILY')} disabled={!canManage || isSaving}>
                  {t('telegramAutoReports.create')}
                </button>
              </div>

              <div className="feature-row">
                <div>
                  <p style={{ margin: 0, fontWeight: 800 }}>{t('telegramAutoReports.templateWeekly')}</p>
                  <p className="subtle" style={{ fontSize: 13, margin: 0 }}>
                    {t('telegramAutoReports.templateWeeklyCopy')}
                  </p>
                </div>
                <button type="button" className="btn btn-secondary" onClick={() => openCreate('WEEKLY')} disabled={!canManage || isSaving}>
                  {t('telegramAutoReports.create')}
                </button>
              </div>
            </div>
          </section>

          <section className="card">
            <p className="kicker">{t('telegramAutoReports.schedulesKicker')}</p>
            <h3 className="title" style={{ marginBottom: 6 }}>
              {t('telegramAutoReports.schedulesTitle')}
            </h3>

            {schedules.length === 0 ? (
              <p className="subtle">{t('telegramAutoReports.noSchedules')}</p>
            ) : (
              <div className="stack" style={{ gap: 10 }}>
                {schedules.map((schedule) => (
                  <div className="list-card" key={schedule.id} style={{ padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 900 }}>
                          {formatScheduleLabel(schedule.type, t)}
                        </p>
                        <p className="subtle" style={{ fontSize: 13, margin: '2px 0 0' }}>
                          {schedule.type === 'WEEKLY' ? `${t('telegramAutoReports.weeklyOn')} ${schedule.dayOfWeek || '-'} · ` : ''}
                          {t('telegramAutoReports.atTime')} {schedule.time || '-'} · {schedule.timezone || timezoneDefault}
                        </p>
                      </div>
                      <span className={badgeForStatus(schedule.enabled ? 'enabled' : 'disabled')}>
                        {schedule.enabled ? t('telegramAutoReports.enabled') : t('telegramAutoReports.disabled')}
                      </span>
                    </div>

                    <div className="list-meta" style={{ marginTop: 10 }}>
                      <span className="meta-chip">
                        {t('telegramAutoReports.nextSend')}: {formatInTz(schedule.nextRunAt, schedule.timezone)}
                      </span>
                      <span className="meta-chip">
                        {t('telegramAutoReports.lastStatus')}: {schedule.lastRunStatus || '-'}
                      </span>
                    </div>

                    <div className="toolbar" style={{ marginTop: 10 }}>
                      <label className="toggle" style={{ marginRight: 'auto' }}>
                        <input
                          type="checkbox"
                          checked={Boolean(schedule.enabled)}
                          onChange={() => handleToggle(schedule)}
                          disabled={!canManage || isSaving}
                        />
                        {t('telegramAutoReports.enabled')}
                      </label>
                      <button type="button" className="btn btn-secondary" onClick={() => openEdit(schedule)} disabled={!canManage || isSaving}>
                        {t('telegramAutoReports.edit')}
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => handleTest(schedule)} disabled={!canManage || isSaving}>
                        {t('telegramAutoReports.sendTest')}
                      </button>
                      <button type="button" className="btn btn-danger" onClick={() => handleDelete(schedule)} disabled={!canManage || isSaving}>
                        {t('telegramAutoReports.delete')}
                      </button>
                    </div>

                    <details style={{ marginTop: 8 }}>
                      <summary style={{ fontWeight: 800, cursor: 'pointer' }}>{t('telegramAutoReports.history')}</summary>
                      <div className="stack" style={{ marginTop: 8, gap: 8 }}>
                        {(schedule.recentSends || []).length === 0 ? (
                          <p className="subtle" style={{ margin: 0 }}>
                            {t('telegramAutoReports.noHistory')}
                          </p>
                        ) : (
                          (schedule.recentSends || []).map((row) => (
                            <div key={row.id} className="feature-row" style={{ padding: '10px 12px' }}>
                              <div style={{ minWidth: 0 }}>
                                <p style={{ margin: 0, fontWeight: 900 }}>
                                  <span className={badgeForStatus(row.status)}>{row.status || '-'}</span>{' '}
                                  <span style={{ marginLeft: 8, fontWeight: 800 }}>
                                    {formatInTz(row.completedAt || row.startedAt || row.createdAt, schedule.timezone)}
                                  </span>
                                </p>
                                <p className="subtle" style={{ fontSize: 12, margin: '2px 0 0' }}>
                                  {t('telegramAutoReports.recipients')}: {row.recipientsSent || 0}/{row.recipientsTotal || 0}
                                  {row.error ? ` · ${row.error}` : ''}
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            )}

            <div className="toolbar" style={{ marginTop: 12 }}>
              <button type="button" className="btn btn-ghost" onClick={load} disabled={isSaving}>
                {t('common.refresh')}
              </button>
            </div>
          </section>
        </>
      )}

      {errorMessage ? <p className="auth-state auth-state-error">{errorMessage}</p> : null}
      {successMessage ? <p className="auth-state auth-state-success">{successMessage}</p> : null}

      {editing ? (
        <Modal
          title={
            editing.mode === 'edit'
              ? t('telegramAutoReports.editScheduleTitle')
              : t('telegramAutoReports.createScheduleTitle')
          }
          onClose={closeModal}
        >
          <div className="form-grid">
            <div className="field">
              <p className="label">{t('telegramAutoReports.template')}</p>
              <select
                className="input"
                value={draft.type}
                onChange={(e) => setDraft((prev) => ({ ...prev, type: e.target.value }))}
                disabled={isSaving}
              >
                <option value="DAILY">{t('telegramAutoReports.templateDaily')}</option>
                <option value="YESTERDAY_DAILY">{t('telegramAutoReports.templateYesterday')}</option>
                <option value="WEEKLY">{t('telegramAutoReports.templateWeekly')}</option>
              </select>
            </div>

            {draft.type === 'WEEKLY' ? (
              <div className="field">
                <p className="label">{t('telegramAutoReports.dayOfWeek')}</p>
                <select
                  className="input"
                  value={draft.dayOfWeek}
                  onChange={(e) => setDraft((prev) => ({ ...prev, dayOfWeek: e.target.value }))}
                  disabled={isSaving}
                >
                  <option value="MON">{t('common.monday')}</option>
                  <option value="TUE">{t('common.tuesday')}</option>
                  <option value="WED">{t('common.wednesday')}</option>
                  <option value="THU">{t('common.thursday')}</option>
                  <option value="FRI">{t('common.friday')}</option>
                  <option value="SAT">{t('common.saturday')}</option>
                  <option value="SUN">{t('common.sunday')}</option>
                </select>
              </div>
            ) : null}

            <div className="field">
              <p className="label">{t('telegramAutoReports.time')}</p>
              <input
                className="input"
                type="time"
                value={draft.time}
                onChange={(e) => setDraft((prev) => ({ ...prev, time: e.target.value }))}
                disabled={isSaving}
              />
            </div>

            <div className="field">
              <p className="label">{t('telegramAutoReports.timezone')}</p>
              <input
                className="input"
                value={draft.timezone}
                onChange={(e) => setDraft((prev) => ({ ...prev, timezone: e.target.value }))}
                disabled={isSaving}
                placeholder="Asia/Yangon"
              />
              <p className="subtle" style={{ fontSize: 12, margin: 0 }}>
                {t('telegramAutoReports.timezoneHint')}
              </p>
            </div>

            <label className="toggle">
              <input
                type="checkbox"
                checked={Boolean(draft.enabled)}
                onChange={(e) => setDraft((prev) => ({ ...prev, enabled: e.target.checked }))}
                disabled={isSaving}
              />
              {t('telegramAutoReports.enabled')}
            </label>

            <div className="field">
              <p className="label">{t('telegramAutoReports.preview')}</p>
              <p className="telegram-code-value" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                {samplePreview(draft, t)}
              </p>
            </div>

            <div className="toolbar">
              <button type="button" className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
                {isSaving ? t('common.saving') : t('telegramAutoReports.save')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={closeModal} disabled={isSaving}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

export default TelegramAutoReports;

