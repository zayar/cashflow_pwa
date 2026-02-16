import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBusinessProfile } from '../state/businessProfile';
import { useOnboardingStatus } from '../state/onboardingStatus';
import { buildCompanyBasicsPayload, ensureDefaultInvoiceTemplate, formatTelegramCommand, isBasicsComplete } from '../lib/onboardingFlow';
import { completeUpload, resolveStorageAccessUrl, signUpload, uploadToSignedUrl } from '../lib/uploadApi';
import { getActiveTelegramLinkCode, generateTelegramLinkCode, getTelegramAutoReportSettings } from '../lib/telegramLinkApi';
import BrandLogo from '../components/BrandLogo';

// New 3-step onboarding: basics -> telegram -> complete
// Template creation now happens automatically in the background
const STEP_KEYS = ['basics', 'telegram', 'complete'];
const STEP_LABELS = ['Company Info', 'Connect Telegram', 'All Set'];
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

// Step indicator dots component
function StepDots({ currentStep, totalSteps, stepDone }) {
  return (
    <div className="step-dots">
      {Array.from({ length: totalSteps }).map((_, index) => (
        <div
          key={index}
          className={`step-dot ${index === currentStep ? 'active' : ''} ${stepDone[index] ? 'done' : ''}`}
        >
          <div className="step-dot-inner" />
          {index < totalSteps - 1 && <div className="step-dot-connector" />}
        </div>
      ))}
    </div>
  );
}

// Progress bar component
function ProgressBar({ currentStep, totalSteps }) {
  const progress = ((currentStep + 1) / totalSteps) * 100;
  return (
    <div className="progress-bar-container">
      <div className="progress-bar-track">
        <div 
          className="progress-bar-fill" 
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="progress-text">Step {currentStep + 1} of {totalSteps}</span>
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
  const [animationDirection, setAnimationDirection] = useState('next'); // 'next' | 'prev'
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Loading states
  const [savingBasics, setSavingBasics] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [basicsSavedAt, setBasicsSavedAt] = useState(0);
  
  // Template runs in background - no UI needed
  const [templateEnsuring, setTemplateEnsuring] = useState(false);
  const [templateError, setTemplateError] = useState('');

  const [telegramState, setTelegramState] = useState({
    loading: false,
    codeLoading: false,
    linked: false,
    linkedCount: 0,
    activeCode: null,
    error: '',
    copyMessage: ''
  });

  // Resume from server-stored step
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
      // Template creation now happens in background - no need to wait
      ensureTemplateInBackground();
      return true;
    } catch (err) {
      setFormError(err?.message || 'Unable to save company details.');
      return false;
    } finally {
      setSavingBasics(false);
    }
  };

  // Background template creation - no UI blocking
  const ensureTemplateInBackground = useCallback(async () => {
    if (!profile?.id || templateEnsuring) return;
    setTemplateEnsuring(true);
    setTemplateError('');
    try {
      await ensureDefaultInvoiceTemplate({ businessId: profile.id });
      // Success - template is ready, no UI update needed
    } catch (err) {
      // Error is non-blocking - user can still proceed
      setTemplateError(err?.message || 'Template setup failed');
    } finally {
      setTemplateEnsuring(false);
    }
  }, [profile?.id, templateEnsuring]);

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

  // Load Telegram data when entering step 1
  useEffect(() => {
    if (activeStep === 1) {
      loadLinkCode();
      loadTelegramStatus();
    }
  }, [activeStep, loadLinkCode, loadTelegramStatus]);

  // Poll Telegram status while on step 1 and not linked
  useEffect(() => {
    if (activeStep !== 1 || telegramState.linked) return undefined;
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
      setTelegramState((prev) => ({ ...prev, copyMessage: 'Copied! Paste in BizCashflowBot.' }));
      // Clear message after 3 seconds
      setTimeout(() => {
        setTelegramState((prev) => ({ ...prev, copyMessage: '' }));
      }, 3000);
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
    telegram: telegramState.linked,
    complete: onboardingStatus?.completed
  };

  // Navigation with animations
  const changeStep = (newStep, direction) => {
    if (isAnimating) return;
    setAnimationDirection(direction);
    setIsAnimating(true);
    
    // Small delay to allow exit animation
    setTimeout(() => {
      setActiveStep(newStep);
      // Reset animation state after enter animation
      setTimeout(() => {
        setIsAnimating(false);
      }, 300);
    }, 150);
  };

  const handleNext = async () => {
    if (activeStep === 0) {
      const success = await handleSaveBasics();
      if (!success) return;
      await saveStatus({ step: 1, completed: false });
      changeStep(1, 'next');
      return;
    }
    if (activeStep === 1) {
      await saveStatus({ step: 2, completed: false });
      changeStep(2, 'next');
      return;
    }
    // Finish
    await saveStatus({ step: 2, completed: true });
    navigate('/', { replace: true });
  };

  const handlePrevious = () => {
    if (activeStep === 0) return;
    changeStep(activeStep - 1, 'prev');
  };

  const handleSkip = async () => {
    // Allow skipping Telegram step
    if (activeStep === 1) {
      await saveStatus({ step: 2, completed: false });
      changeStep(2, 'next');
    }
  };

  const getAnimationClass = () => {
    if (!isAnimating) return 'step-enter-active';
    return animationDirection === 'next' ? 'step-exit' : 'step-exit-prev';
  };

  // Step 1: Company Basics
  const renderBasicsStep = () => (
    <div className={`step-content ${getAnimationClass()}`}>
      <div className="step-header">
        <div className="step-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div className="step-header-text">
          <h2 className="step-title">Tell us about your business</h2>
          <p className="step-subtitle">This information will appear on your invoices</p>
        </div>
      </div>

      <div className="form-grid">
        <label className="field">
          <span className="label">Business name *</span>
          <input
            className={`input ${fieldErrors.businessName ? 'input-error' : ''}`}
            type="text"
            value={values.businessName}
            onChange={(event) => setValues((prev) => ({ ...prev, businessName: event.target.value }))}
            placeholder="Your company name"
            autoComplete="organization"
            disabled={savingBasics}
          />
          {fieldErrors.businessName && <span className="inline-error">{fieldErrors.businessName}</span>}
        </label>

        <label className="field">
          <span className="label">Phone number *</span>
          <input
            className={`input ${fieldErrors.phone ? 'input-error' : ''}`}
            type="tel"
            value={values.phone}
            onChange={(event) => setValues((prev) => ({ ...prev, phone: event.target.value }))}
            placeholder="Business phone"
            autoComplete="tel"
            disabled={savingBasics}
          />
          {fieldErrors.phone && <span className="inline-error">{fieldErrors.phone}</span>}
        </label>

        <label className="field">
          <div className="label-row">
            <span className="label">Business address</span>
            <span className="label-optional">Optional</span>
          </div>
          <textarea
            className="input"
            rows={2}
            value={values.address}
            onChange={(event) => setValues((prev) => ({ ...prev, address: event.target.value }))}
            placeholder="Street, building, floor"
            disabled={savingBasics}
          />
        </label>

        <label className="field">
          <div className="label-row">
            <span className="label">City</span>
            <span className="label-optional">Optional</span>
          </div>
          <input
            className="input"
            type="text"
            value={values.city}
            onChange={(event) => setValues((prev) => ({ ...prev, city: event.target.value }))}
            placeholder="City"
            disabled={savingBasics}
          />
        </label>

        <label className="field">
          <div className="label-row">
            <span className="label">Company logo</span>
            <span className="label-optional">Optional</span>
          </div>
          <div className="logo-upload-area">
            {logoPreviewUrl ? (
              <div className="logo-preview">
                <img src={logoPreviewUrl} alt="Company logo" />
                <button 
                  type="button" 
                  className="logo-remove-btn"
                  onClick={() => setValues((prev) => ({ ...prev, logoUrl: '' }))}
                  disabled={uploading || savingBasics}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ) : (
              <button 
                type="button" 
                className="logo-upload-btn"
                onClick={handleChooseLogo}
                disabled={uploading || savingBasics}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <span>Upload logo</span>
              </button>
            )}
          </div>
          {uploading && <span className="upload-status">Uploading...</span>}
        </label>
      </div>
      
      {templateError && (
        <div className="template-error-hint">
          <span>⚠️ Invoice template setup failed. You can retry from Settings later.</span>
        </div>
      )}
    </div>
  );

  // Step 2: Telegram Connect
  const renderTelegramStep = () => (
    <div className={`step-content ${getAnimationClass()}`}>
      <div className="step-header">
        <div className="step-icon telegram-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
          </svg>
        </div>
        <div className="step-header-text">
          <h2 className="step-title">Connect Telegram</h2>
          <p className="step-subtitle">Get instant reports and send quick commands via BizCashflowBot</p>
        </div>
      </div>

      {telegramState.linked ? (
        <div className="telegram-success-card">
          <div className="telegram-success-icon">✓</div>
          <div className="telegram-success-content">
            <h3>Telegram Connected!</h3>
            <p>
              {telegramState.linkedCount > 0
                ? `${telegramState.linkedCount} chat${telegramState.linkedCount > 1 ? 's' : ''} linked`
                : 'Your bot is linked and ready'}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="telegram-steps">
            <div className="telegram-step">
              <div className="telegram-step-number">1</div>
              <div className="telegram-step-content">
                <p className="telegram-step-title">Generate your link code</p>
                <p className="telegram-step-desc">Click the button below to create a secure link code</p>
              </div>
            </div>
            <div className="telegram-step">
              <div className="telegram-step-number">2</div>
              <div className="telegram-step-content">
                <p className="telegram-step-title">Open Telegram</p>
                <p className="telegram-step-desc">Send the code to @BizCashflowBot</p>
              </div>
            </div>
            <div className="telegram-step">
              <div className="telegram-step-number">3</div>
              <div className="telegram-step-content">
                <p className="telegram-step-title">Done!</p>
                <p className="telegram-step-desc">We'll confirm when connected</p>
              </div>
            </div>
          </div>

          <div className="telegram-code-section">
            {commandText ? (
              <>
                <div className="telegram-code-label">Your link code</div>
                <div className="telegram-code-box">
                  <code className="telegram-code">{commandText}</code>
                  <button 
                    type="button" 
                    className="telegram-copy-btn"
                    onClick={handleCopyCode}
                    title="Copy code"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                </div>
                {expiresLabel && <p className="telegram-code-expires">Expires: {expiresLabel}</p>}
              </>
            ) : (
              <button 
                type="button" 
                className="btn btn-secondary btn-generate-code"
                onClick={handleGenerateCode}
                disabled={telegramState.codeLoading}
              >
                {telegramState.codeLoading ? 'Generating...' : 'Generate Link Code'}
              </button>
            )}
            
            {telegramState.copyMessage && (
              <p className={`copy-message ${telegramState.copyMessage.includes('Copied') ? 'success' : 'error'}`}>
                {telegramState.copyMessage}
              </p>
            )}
          </div>

          <div className="telegram-actions">
            <button 
              type="button" 
              className="telegram-bot-btn"
              onClick={handleOpenBot}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
              Open Telegram Bot
            </button>
            
            <button 
              type="button" 
              className="btn btn-ghost btn-refresh"
              onClick={() => loadTelegramStatus()}
              disabled={telegramState.loading}
            >
              {telegramState.loading ? 'Checking...' : 'Refresh Status'}
            </button>
          </div>
        </>
      )}
      
      {telegramState.error && <p className="telegram-error">{telegramState.error}</p>}
    </div>
  );

  // Step 3: Complete
  const renderCompleteStep = () => (
    <div className={`step-content step-complete-content ${getAnimationClass()}`}>
      <div className="complete-illustration">
        <div className="complete-circle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      </div>
      
      <div className="complete-text">
        <h2 className="complete-title">You're all set!</h2>
        <p className="complete-subtitle">Your Cashflow account is ready to use</p>
      </div>

      <div className="complete-summary">
        <div className="complete-check-item">
          <span className="complete-check-icon">✓</span>
          <span>Company profile saved</span>
        </div>
        <div className="complete-check-item">
          <span className="complete-check-icon">✓</span>
          <span>Invoice template ready</span>
        </div>
        <div className="complete-check-item">
          <span className="complete-check-icon">✓</span>
          <span>
            Telegram {telegramState.linked ? 'connected' : 'can be set up later'}
          </span>
        </div>
      </div>

      <div className="complete-hint">
        <p>Start creating your first invoice now!</p>
      </div>
    </div>
  );

  const renderStep = () => {
    switch (activeStep) {
      case 0: return renderBasicsStep();
      case 1: return renderTelegramStep();
      case 2: return renderCompleteStep();
      default: return null;
    }
  };

  const nextLabel = activeStep === STEP_KEYS.length - 1 ? 'Get Started' : 'Next';
  const disableNext =
    onboardingLoading ||
    (activeStep === 0 && (savingBasics || uploading || profileLoading)) ||
    isAnimating;

  const showSkip = activeStep === 1 && !telegramState.linked;

  if ((profileLoading && !profile) || (onboardingLoading && !onboardingStatus)) {
    return (
      <div className="onboarding-loading">
        <div className="onboarding-loading-spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  if ((error && !profile) || onboardingError) {
    return (
      <div className="onboarding-error">
        <div className="onboarding-error-icon">!</div>
        <h2>Could not load your profile</h2>
        <p>{error || onboardingError}</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="onboarding-container">
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

      {/* Brand Header */}
      <div className="onboarding-brand-header">
        <BrandLogo variant="full" className="onboarding-brand-logo" />
      </div>

      {/* Progress Bar */}
      <div className="onboarding-progress-section">
        <ProgressBar currentStep={activeStep} totalSteps={STEP_KEYS.length} />
        <StepDots 
          currentStep={activeStep} 
          totalSteps={STEP_KEYS.length}
          stepDone={[stepDone.basics, stepDone.telegram, stepDone.complete]}
        />
      </div>

      {/* Form Error */}
      {formError && (
        <div className="onboarding-form-error" role="alert">
          <span className="error-icon">!</span>
          {formError}
        </div>
      )}

      {/* Main Card */}
      <div className="onboarding-main-card">
        {renderStep()}
      </div>

      {/* Actions */}
      <div className="onboarding-actions-bar">
        <button 
          className={`btn btn-secondary onboarding-btn-back ${activeStep === 0 ? 'hidden' : ''}`}
          type="button" 
          onClick={handlePrevious} 
          disabled={activeStep === 0 || isAnimating}
        >
          Back
        </button>
        
        <div className="onboarding-actions-right">
          {showSkip && (
            <button 
              className="btn btn-ghost onboarding-btn-skip"
              type="button" 
              onClick={handleSkip}
              disabled={isAnimating}
            >
              Skip for now
            </button>
          )}
          <button 
            className={`btn btn-primary onboarding-btn-next ${savingBasics || uploading ? 'loading' : ''}`}
            type="button" 
            onClick={handleNext} 
            disabled={disableNext}
          >
            {savingBasics || uploading ? (
              <>
                <span className="btn-spinner" />
                Saving...
              </>
            ) : (
              nextLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Onboarding;
