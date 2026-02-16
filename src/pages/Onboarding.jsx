import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBusinessProfile } from '../state/businessProfile';
import { useOnboardingStatus } from '../state/onboardingStatus';
import { buildCompanyBasicsPayload, ensureDefaultInvoiceTemplate, formatTelegramCommand, isBasicsComplete } from '../lib/onboardingFlow';
import { completeUpload, resolveStorageAccessUrl, signUpload, uploadToSignedUrl } from '../lib/uploadApi';
import { getActiveTelegramLinkCode, generateTelegramLinkCode, getTelegramAutoReportSettings } from '../lib/telegramLinkApi';

const STEP_KEYS = ['basics', 'template', 'telegram', 'complete'];
const TELEGRAM_BOT_URL = 'https://t.me/BizCashflowBot';

function normalizeText(value) {
  return String(value || '').trim();
}

function toFormValues(profile) {
  return {
    businessName: normalizeText(profile?.businessName || profile?.name),
    phone: normalizeText(profile?.phone),
    address: normalizeText(profile?.address),
    city: normalizeText(profile?.city),
    logoUrl: normalizeText(profile?.logoUrl)
  };
}

function validateBasics(values) {
  const next = {};
  if (!normalizeText(values.businessName)) {
    next.businessName = 'Business name is required.';
  }
  if (!normalizeText(values.phone)) {
    next.phone = 'Phone number is required.';
  }
  return next;
}

function validateLogoFile(file) {
  if (!file) return 'Please choose an image.';
  if (!String(file.type || '').startsWith('image/')) return 'Only image files are allowed.';
  if (file.size / 1024 / 1024 > 5) return 'Image must be smaller than 5MB.';
  return '';
}

function formatDateTime(epochMs) {
  if (!epochMs) return '';
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
}

function StepPill({ index, label, active, done }) {
  return (
    <div className={`onboarding-step-pill ${active ? 'active' : ''} ${done ? 'done' : ''}`.trim()}>
      <span className="onboarding-step-number">{done ? '✓' : index + 1}</span>
      <div>
        <p className="onboarding-step-label">{label}</p>
        <p className="onboarding-step-sub">{done ? 'Completed' : `Step ${index + 1} of ${STEP_KEYS.length}`}</p>
      </div>
    </div>
  );
}

function Onboarding() {
  const navigate = useNavigate();
  const { profile, loading: profileLoading, error, saveProfile, refreshProfile } = useBusinessProfile();
  const { status: onboardingStatus, loading: onboardingLoading, error: onboardingError, saveStatus, refreshStatus } = useOnboardingStatus();

  const fileInputRef = useRef(null);

  const [values, setValues] = useState(toFormValues({}));
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [savingBasics, setSavingBasics] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [basicsSavedAt, setBasicsSavedAt] = useState(0);

  const [templateStatus, setTemplateStatus] = useState({ state: 'idle', detail: '', source: '' });

  const [telegramState, setTelegramState] = useState({
    loading: false,
    codeLoading: false,
    linked: false,
    linkedCount: 0,
    activeCode: null,
    error: '',
    copyMessage: ''
  });

  // Resume from server-stored step.
  useEffect(() => {
    if (onboardingStatus?.completed) {
      navigate('/', { replace: true });
      return;
    }
    if (typeof onboardingStatus?.step === 'number' && onboardingStatus.step >= 0 && onboardingStatus.step < STEP_KEYS.length) {
      setActiveStep(onboardingStatus.step);
    }
  }, [navigate, onboardingStatus]);
  useEffect(() => {
    if (!profile) return;
    setValues(toFormValues(profile));
    setBasicsSavedAt(isBasicsComplete(profile) ? Date.now() : 0);
    setFieldErrors({});
    setFormError('');
  }, [profile]);

  const logoPreviewUrl = useMemo(() => resolveStorageAccessUrl(values.logoUrl || ''), [values.logoUrl]);

  const handleChooseLogo = () => {
    fileInputRef.current?.click();
  };

  const handleUploadLogo = async (file) => {
    const validationError = validateLogoFile(file);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setUploading(true);
    setFormError('');
    try {
      const context = { entityType: 'template_images', field: 'logo' };
      const signed = await signUpload({ file, context });
      await uploadToSignedUrl({ signed, file });
      const completed = await completeUpload({
        objectKey: signed.objectKey,
        mimeType: file.type,
        context
      });
      const nextLogoUrl = completed?.objectKey || signed.objectKey;
      setValues((prev) => ({ ...prev, logoUrl: nextLogoUrl }));
    } catch (err) {
      setFormError(err?.message || 'Unable to upload logo image.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveBasics = async () => {
    const validation = validateBasics(values);
    setFieldErrors(validation);
    if (Object.keys(validation).length > 0) {
      setFormError('Please fill in the required fields.');
      return false;
    }
    setSavingBasics(true);
    setFormError('');
    try {
      const payload = buildCompanyBasicsPayload(values);
      await saveProfile(payload);
      await refreshProfile();
      setBasicsSavedAt(Date.now());
      await saveStatus({ step: 1, completed: false });
      return true;
    } catch (err) {
      setFormError(err?.message || 'Unable to save company details.');
      return false;
    } finally {
      setSavingBasics(false);
    }
  };

  const runTemplateEnsure = useCallback(async () => {
    if (!profile?.id) return;
    setTemplateStatus({ state: 'checking', detail: 'Checking for your default invoice template...', source: '' });
    try {
      const result = await ensureDefaultInvoiceTemplate({ businessId: profile.id });
      const source = result?.source || 'default';
      setTemplateStatus({
        state: 'ready',
        detail:
          source === 'created'
            ? 'Default invoice template created.'
            : source === 'existing'
              ? 'Reusing your existing template.'
              : 'Default invoice template ready.',
        source
      });
      await saveStatus({ step: 2, completed: false });
    } catch (err) {
      setTemplateStatus({
        state: 'error',
        detail: err?.message || 'Unable to ensure default template. You can retry.',
        source: 'error'
      });
    }
  }, [profile?.id, saveStatus]);

  const loadTelegramStatus = useCallback(
    async ({ silent = false } = {}) => {
      setTelegramState((prev) => ({
        ...prev,
        loading: silent ? prev.loading : true,
        error: silent ? prev.error : ''
      }));
      try {
        const payload = await getTelegramAutoReportSettings();
        setTelegramState((prev) => ({
          ...prev,
          linked: Boolean(payload?.telegramLinked),
          linkedCount: Number(payload?.linkedRecipientsCount || 0),
          loading: false
        }));
      } catch (err) {
        setTelegramState((prev) => ({
          ...prev,
          loading: false,
          error: err?.message || 'Could not load Telegram status.'
        }));
      }
    },
    []
  );

  const loadLinkCode = useCallback(async () => {
    setTelegramState((prev) => ({ ...prev, codeLoading: true, error: '' }));
    try {
      const payload = await getActiveTelegramLinkCode();
      setTelegramState((prev) => ({
        ...prev,
        activeCode: payload,
        codeLoading: false
      }));
    } catch (err) {
      setTelegramState((prev) => ({
        ...prev,
        codeLoading: false,
        error: err?.message || 'Could not load link code.'
      }));
    }
  }, []);

  useEffect(() => {
    if (activeStep === 1 && templateStatus.state === 'idle') {
      runTemplateEnsure();
    }
  }, [activeStep, runTemplateEnsure, templateStatus.state]);

  useEffect(() => {
    if (activeStep !== 2) return;
    loadLinkCode();
    loadTelegramStatus();
  }, [activeStep, loadLinkCode, loadTelegramStatus]);

  useEffect(() => {
    if (activeStep !== 2 || telegramState.linked) return undefined;
    const timer = setInterval(() => {
      loadTelegramStatus({ silent: true });
    }, 6000);
    return () => clearInterval(timer);
  }, [activeStep, telegramState.linked, loadTelegramStatus]);

  const handleGenerateCode = async () => {
    setTelegramState((prev) => ({ ...prev, codeLoading: true, error: '' }));
    try {
      const created = await generateTelegramLinkCode();
      setTelegramState((prev) => ({
        ...prev,
        activeCode: created,
        codeLoading: false,
        copyMessage: ''
      }));
    } catch (err) {
      setTelegramState((prev) => ({
        ...prev,
        codeLoading: false,
        error: err?.message || 'Unable to generate link code.'
      }));
    }
  };

  const handleCopyCode = async () => {
    const command = formatTelegramCommand(telegramState.activeCode?.telegramCommand || telegramState.activeCode?.code);
    if (!command) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(command);
      }
      setTelegramState((prev) => ({ ...prev, copyMessage: 'Copied. Paste in BizCashflowBot.' }));
    } catch (err) {
      setTelegramState((prev) => ({ ...prev, copyMessage: 'Copy failed. Tap and hold to select.' }));
    }
  };

  const handleOpenBot = () => {
    window.open(TELEGRAM_BOT_URL, '_blank', 'noopener,noreferrer');
  };

  const expiresLabel = useMemo(() => formatDateTime(telegramState.activeCode?.expiresAt), [telegramState.activeCode?.expiresAt]);
  const commandText = useMemo(
    () => formatTelegramCommand(telegramState.activeCode?.telegramCommand || telegramState.activeCode?.code),
    [telegramState.activeCode]
  );

  const basicsComplete = isBasicsComplete(profile) || Boolean(basicsSavedAt);
  const stepDone = {
    basics: basicsComplete,
    template: templateStatus.state === 'ready',
    telegram: telegramState.linked,
    complete: onboardingStatus?.completed
  };

  const handleNext = async () => {
    if (activeStep === 0) {
      const success = await handleSaveBasics();
      if (!success) return;
      setActiveStep(1);
      return;
    }
    if (activeStep === 1) {
      await saveStatus({ step: 2, completed: false });
      setActiveStep(2);
      return;
    }
    if (activeStep === 2) {
      await saveStatus({ step: 3, completed: false });
      setActiveStep(3);
      return;
    }
    await saveStatus({ step: 3, completed: true });
    navigate('/', { replace: true });
  };

  const handlePrevious = () => {
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  const stepTitle = useMemo(
    () => ['Company basics', 'Default invoice template', 'Connect Telegram', 'All set'][activeStep] || 'Onboarding',
    [activeStep]
  );

  const renderStep = () => {
    if (activeStep === 0) {
      return (
        <section className="card onboarding-card">
          <div className="onboarding-card-header">
            <div>
              <p className="kicker">Step 1 · Company basics</p>
              <h2 className="title">{stepTitle}</h2>
              <p className="subtle">Add the info that appears on your invoices.</p>
            </div>
            {stepDone.basics && <span className="badge badge-success">Saved</span>}
          </div>

          <div className="form-grid" style={{ marginTop: 10 }}>
            <label className="field">
              <span className="label">Business name *</span>
              <input
                className="input"
                type="text"
                value={values.businessName}
                onChange={(event) => setValues((prev) => ({ ...prev, businessName: event.target.value }))}
                placeholder="Enter your company name"
                autoComplete="organization"
              />
              {fieldErrors.businessName && <span className="inline-error">{fieldErrors.businessName}</span>}
            </label>

            <label className="field">
              <span className="label">Phone number *</span>
              <input
                className="input"
                type="tel"
                value={values.phone}
                onChange={(event) => setValues((prev) => ({ ...prev, phone: event.target.value }))}
                placeholder="Business phone"
                autoComplete="tel"
              />
              {fieldErrors.phone && <span className="inline-error">{fieldErrors.phone}</span>}
            </label>

            <label className="field">
              <div className="label-row">
                <span className="label">Business address (optional)</span>
                <button type="button" className="link-btn" onClick={() => setValues((prev) => ({ ...prev, address: '', city: '' }))}>
                  Skip for now
                </button>
              </div>
              <textarea
                className="input"
                rows={3}
                value={values.address}
                onChange={(event) => setValues((prev) => ({ ...prev, address: event.target.value }))}
                placeholder="Street, building, floor"
              />
            </label>

            <label className="field">
              <span className="label">City (optional)</span>
              <input
                className="input"
                type="text"
                value={values.city}
                onChange={(event) => setValues((prev) => ({ ...prev, city: event.target.value }))}
                placeholder="City"
              />
            </label>

            <label className="field">
              <div className="label-row">
                <span className="label">Company logo (optional)</span>
                <button type="button" className="link-btn" onClick={() => setValues((prev) => ({ ...prev, logoUrl: '' }))}>
                  Skip for now
                </button>
              </div>
              <div className="profile-logo-picker profile-logo-picker-small onboarding-logo-picker">
                {logoPreviewUrl ? <img src={logoPreviewUrl} alt="Company logo" /> : <span>No image selected</span>}
              </div>
              <div className="toolbar">
                <button className="btn btn-secondary" type="button" onClick={handleChooseLogo} disabled={uploading || profileLoading}>
                  {uploading ? 'Uploading...' : logoPreviewUrl ? 'Replace image' : 'Upload logo'}
                </button>
                {logoPreviewUrl && (
                  <button className="btn btn-ghost" type="button" onClick={() => setValues((prev) => ({ ...prev, logoUrl: '' }))}>
                    Remove
                  </button>
                )}
              </div>
            </label>
          </div>
        </section>
      );
    }

    if (activeStep === 1) {
      return (
        <section className="card onboarding-card">
          <div className="onboarding-card-header">
            <div>
              <p className="kicker">Step 2 · Default invoice template</p>
              <h2 className="title">{stepTitle}</h2>
              <p className="subtle">We’ll set up a clean invoice template for you.</p>
            </div>
            {templateStatus.state === 'ready' && <span className="badge badge-success">Ready</span>}
          </div>

          <div className="onboarding-status-block">
            <div className="status-dot" data-state={templateStatus.state} />
            <div>
              <p className="onboarding-status-title">
                {templateStatus.state === 'ready'
                  ? 'Template ready'
                  : templateStatus.state === 'error'
                    ? 'Needs attention'
                    : 'Preparing your template'}
              </p>
              <p className="subtle">{templateStatus.detail || 'Checking existing templates...'}</p>
            </div>
            <div className="onboarding-status-actions">
              <button className="btn btn-secondary" type="button" onClick={runTemplateEnsure} disabled={templateStatus.state === 'checking'}>
                {templateStatus.state === 'checking' ? 'Checking…' : 'Retry'}
              </button>
            </div>
          </div>
        </section>
      );
    }

    return (
      <section className="card onboarding-card">
        <div className="onboarding-card-header">
          <div>
            <p className="kicker">Step 3 · Connect Telegram</p>
            <h2 className="title">{stepTitle}</h2>
            <p className="subtle">Link BizCashflowBot to receive reports and send quick commands.</p>
          </div>
          {telegramState.linked ? <span className="badge badge-success">Linked</span> : <span className="badge">Pending</span>}
        </div>

        <ol className="onboarding-steps-list">
          <li>Generate a link code.</li>
          <li>Tap “Open Telegram” and send the code to BizCashflowBot.</li>
          <li>We’ll confirm once the bot is linked.</li>
        </ol>

        <div className="tg-command-card onboarding-command">
          <div className="onboarding-command-row">
            <div>
              <p className="tg-command-label">Your link code</p>
              <code className="tg-command-code">{commandText || 'No active code'}</code>
              {expiresLabel && <p className="tg-expires">Expires: {expiresLabel}</p>}
            </div>
            <div className="onboarding-command-actions">
              <button type="button" className="btn btn-secondary" onClick={handleCopyCode} disabled={!commandText}>
                Copy code
              </button>
              <button type="button" className="btn btn-primary" onClick={handleOpenBot}>
                Open Telegram
              </button>
            </div>
          </div>
          <div className="onboarding-command-toolbar">
            <button className="btn btn-secondary" type="button" onClick={handleGenerateCode} disabled={telegramState.codeLoading}>
              {telegramState.codeLoading ? 'Generating...' : 'Generate new code'}
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => loadTelegramStatus()}>
              Refresh status
            </button>
          </div>
          {telegramState.copyMessage && <p className="auth-state auth-state-success">{telegramState.copyMessage}</p>}
          {telegramState.error && <p className="auth-state auth-state-error">{telegramState.error}</p>}
          {telegramState.loading && <p className="subtle">Checking Telegram link...</p>}
          {telegramState.linked && (
            <div className="onboarding-link-success">
              <p className="onboarding-status-title">Connected</p>
              <p className="subtle">
                {telegramState.linkedCount > 0
                  ? `${telegramState.linkedCount} chat${telegramState.linkedCount > 1 ? 's' : ''} linked.`
                  : 'Bot is linked.'}
              </p>
            </div>
          )}
        </div>
      </section>
    );
  };

  const renderComplete = () => (
    <section className="card onboarding-card">
      <div className="onboarding-card-header">
        <div>
          <p className="kicker">Step 4 · Completed</p>
          <h2 className="title">You’re ready</h2>
          <p className="subtle">Everything is set. Start invoicing now.</p>
        </div>
        <span className="badge badge-success">Done</span>
      </div>
      <div className="onboarding-complete">
        <p className="onboarding-status-title">Company profile saved</p>
        <p className="onboarding-status-title">Invoice template ready</p>
        <p className="onboarding-status-title">
          Telegram {telegramState.linked ? 'connected' : 'can be connected later from Integrations'}
        </p>
      </div>
    </section>
  );

  const nextLabel = activeStep === STEP_KEYS.length - 1 ? 'Finish' : 'Next';
  const disableNext =
    onboardingLoading ||
    (activeStep === 0 ? savingBasics || uploading || profileLoading : activeStep === 1 ? templateStatus.state === 'checking' : false);

  if ((profileLoading && !profile) || (onboardingLoading && !onboardingStatus)) {
    return (
      <div className="stack">
        <section className="state-loading" aria-live="polite">
          <div className="skeleton-card">
            <div className="skeleton skeleton-line long" />
            <div className="skeleton skeleton-line short" />
          </div>
        </section>
      </div>
    );
  }

  if ((error && !profile) || onboardingError) {
    return (
      <div className="stack">
        <section className="state-error" role="alert">
          <p className="state-title">Could not load your profile.</p>
          <p className="state-message">{error || onboardingError}</p>
        </section>
      </div>
    );
  }

  return (
    <div className="stack onboarding-page">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) handleUploadLogo(file);
        }}
      />

      <section className="card onboarding-hero">
        <div>
          <p className="kicker">Welcome back</p>
          <h1 className="title" style={{ marginBottom: 6 }}>
            Finish setting up Cashflow
          </h1>
          <p className="subtle">4 quick steps: company basics, invoice template, Telegram link, and you’re done.</p>
        </div>
        <div className="onboarding-progress">
          {STEP_KEYS.map((key, index) => (
            <StepPill
              key={key}
              index={index}
              label={['Basics', 'Template', 'Telegram', 'Complete'][index]}
              active={activeStep === index}
              done={stepDone[key]}
            />
          ))}
        </div>
      </section>

      {formError && (
        <section className="state-error" role="alert">
          <p className="state-message">{formError}</p>
        </section>
      )}
      {onboardingError && (
        <section className="state-error" role="alert">
          <p className="state-message">{onboardingError}</p>
        </section>
      )}

      {activeStep >= STEP_KEYS.length - 1 ? renderComplete() : renderStep()}

      <div className="sticky-actions onboarding-actions">
        <button className="btn btn-secondary" type="button" onClick={handlePrevious} disabled={activeStep === 0 || savingBasics || uploading}>
          Back
        </button>
        <button className="btn btn-primary" type="button" onClick={handleNext} disabled={disableNext}>
          {nextLabel}
        </button>
      </div>
    </div>
  );
}

export default Onboarding;
