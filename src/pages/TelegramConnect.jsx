import { useCallback, useEffect, useMemo, useState } from 'react';
import { getActiveTelegramLinkCode, generateTelegramLinkCode } from '../lib/telegramLinkApi';

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
      setErrorMessage(err?.message || 'Failed to load Telegram link code.');
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
      setErrorMessage(err?.message || 'Unable to generate code. Please try again.');
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
      setCopyMessage('Copied Telegram command.');
    } catch (err) {
      setCopyMessage('Copy failed. Please copy manually.');
    }
  };

  return (
    <div className="stack">
      <section className="card telegram-connect-card">
        <p className="kicker">Integrations</p>
        <h3 className="title">Connect Telegram</h3>
        <p className="subtle">This code expires in 30 minutes.</p>

        <div className="telegram-steps">
          <p className="telegram-step">Step 1: Copy command</p>
          <p className="telegram-step">Step 2: Open Telegram and send it to Cashflow bot</p>
          <p className="telegram-step">Step 3: Done</p>
        </div>

        {isLoading ? (
          <p className="subtle">Loading active code...</p>
        ) : (
          <div className="telegram-code-panel">
            <p className="telegram-code-label">Telegram command</p>
            <p className="telegram-code-value">{activeCode?.telegramCommand || 'No active code yet.'}</p>
            <p className="subtle" style={{ fontSize: 13 }}>
              Expires: {activeCode ? expiresLabel : '-'}
            </p>
          </div>
        )}

        {errorMessage ? <p className="auth-state auth-state-error">{errorMessage}</p> : null}
        {copyMessage ? <p className="auth-state auth-state-success">{copyMessage}</p> : null}

        <div className="toolbar">
          <button type="button" className="btn btn-primary" onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? 'Generating...' : activeCode ? 'Generate New Code' : 'Generate Code'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleCopy}
            disabled={!activeCode?.telegramCommand || isGenerating}
          >
            Copy Telegram Command
          </button>
          <button type="button" className="btn btn-ghost" onClick={loadActiveCode} disabled={isGenerating}>
            Refresh
          </button>
        </div>
      </section>
    </div>
  );
}

export default TelegramConnect;
