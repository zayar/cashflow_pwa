import { useCallback, useEffect, useMemo, useState } from 'react';
import { getActiveTelegramLinkCode, generateTelegramLinkCode } from '../lib/telegramLinkApi';
import { useI18n } from '../i18n';

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
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [copyMessage, setCopyMessage] = useState('');

  const loadActiveCode = useCallback(async () => {
    setErrorMessage('');
    try {
      const payload = await getActiveTelegramLinkCode();
      setActiveCode(payload);
    } catch (err) {
      setErrorMessage(err?.message || t('telegram.failedLoad'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActiveCode();
  }, [loadActiveCode]);

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

        {isLoading ? (
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
    </div>
  );
}

export default TelegramConnect;
