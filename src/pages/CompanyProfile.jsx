import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isProfileComplete } from '../lib/businessProfileService';
import { completeUpload, resolveStorageAccessUrl, signUpload, uploadToSignedUrl } from '../lib/uploadApi';
import { useBusinessProfile } from '../state/businessProfile';
import { useI18n } from '../i18n';

const WIZARD_STEPS = ['name', 'logo', 'address', 'phone'];

function normalizeText(value) {
  return String(value || '').trim();
}

function toFormValues(profile) {
  return {
    businessName: normalizeText(profile?.businessName || profile?.name),
    phone: normalizeText(profile?.phone),
    city: normalizeText(profile?.city),
    address: normalizeText(profile?.address),
    logoUrl: normalizeText(profile?.logoUrl)
  };
}

function validateProfile(values) {
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

function CompanyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.6" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 9h10M7 13h6M7 16h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ProfileWizard({
  values,
  errors,
  uploading,
  activeStep,
  onChange,
  onChooseLogo,
  onNext,
  onPrevious,
  onSkipLogo
}) {
  const total = WIZARD_STEPS.length;
  const isLastStep = activeStep === total - 1;
  const logoPreviewUrl = resolveStorageAccessUrl(values.logoUrl || '');

  return (
    <div className="stack profile-wizard-page">
      <section className="card profile-wizard-card">
        <h2 className="profile-wizard-title">Welcome to Invoice Snap</h2>
        <p className="profile-wizard-subtitle">Please fill out the following information.</p>

        <div className="profile-wizard-dots" aria-label="Profile onboarding progress">
          {WIZARD_STEPS.map((step, index) => (
            <span key={step} className={`profile-wizard-dot ${index === activeStep ? 'active' : ''}`} />
          ))}
        </div>

        {activeStep === 0 && (
          <div className="form-grid profile-wizard-form">
            <div className="profile-wizard-icon" aria-hidden="true">
              <CompanyIcon />
            </div>
            <label className="field">
              <span className="label">Business name</span>
              <input
                className="input"
                type="text"
                value={values.businessName}
                onChange={(event) => onChange('businessName', event.target.value)}
                placeholder="Enter your company name"
                autoComplete="organization"
              />
              {errors.businessName && <span className="inline-error">{errors.businessName}</span>}
            </label>
          </div>
        )}

        {activeStep === 1 && (
          <div className="form-grid profile-wizard-form">
            <label className="field">
              <span className="label">Company logo</span>
              <div className="profile-logo-picker">
                {logoPreviewUrl ? <img src={logoPreviewUrl} alt="Company logo" /> : <span>No image selected</span>}
              </div>
              <div className="toolbar">
                <button className="btn btn-primary" type="button" onClick={onChooseLogo} disabled={uploading}>
                  {uploading ? 'Uploading...' : logoPreviewUrl ? 'Replace image' : 'Choose image'}
                </button>
                {logoPreviewUrl && (
                  <button className="btn btn-secondary" type="button" onClick={onSkipLogo}>
                    Remove
                  </button>
                )}
              </div>
            </label>
          </div>
        )}

        {activeStep === 2 && (
          <div className="form-grid profile-wizard-form">
            <label className="field">
              <span className="label">Address</span>
              <textarea
                className="input"
                value={values.address}
                onChange={(event) => onChange('address', event.target.value)}
                rows={4}
                placeholder="Street, building, floor"
              />
            </label>
            <label className="field">
              <span className="label">City</span>
              <input
                className="input"
                type="text"
                value={values.city}
                onChange={(event) => onChange('city', event.target.value)}
                placeholder="City"
              />
            </label>
          </div>
        )}

        {activeStep === 3 && (
          <div className="form-grid profile-wizard-form">
            <label className="field">
              <span className="label">Phone number</span>
              <input
                className="input"
                type="tel"
                value={values.phone}
                onChange={(event) => onChange('phone', event.target.value)}
                placeholder="Enter your business phone"
                autoComplete="tel"
              />
              {errors.phone && <span className="inline-error">{errors.phone}</span>}
            </label>
          </div>
        )}
      </section>

      <div className="sticky-actions profile-wizard-actions">
        <button className="btn btn-secondary" type="button" onClick={onPrevious} disabled={activeStep === 0 || uploading}>
          Previous
        </button>
        <button className="btn btn-primary" type="button" onClick={onNext} disabled={uploading}>
          {isLastStep ? 'Finish' : 'Next'}
        </button>
      </div>
    </div>
  );
}

function CompanyProfile() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { profile, loading, error, loadProfile, saveProfile } = useBusinessProfile();

  const fileInputRef = useRef(null);

  const [status, setStatus] = useState('');
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [uploading, setUploading] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardMode, setWizardMode] = useState(false);
  const [values, setValues] = useState(() => toFormValues(profile));

  useEffect(() => {
    loadProfile().catch(() => {
      // Inline state handles retry messaging.
    });
  }, [loadProfile]);

  useEffect(() => {
    if (!profile) return;
    setValues(toFormValues(profile));
    setWizardMode(!isProfileComplete(profile));
    setWizardStep(0);
  }, [profile]);

  useEffect(() => {
    if (!status) return undefined;
    const timer = setTimeout(() => setStatus(''), 2600);
    return () => clearTimeout(timer);
  }, [status]);

  const logoPreviewUrl = useMemo(() => resolveStorageAccessUrl(values.logoUrl || ''), [values.logoUrl]);

  const setFieldValue = (field, nextValue) => {
    setValues((prev) => ({ ...prev, [field]: nextValue }));
    setFieldErrors((prev) => ({ ...prev, [field]: '' }));
    setFormError('');
  };

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
      const context = {
        entityType: 'template_images',
        field: 'logo'
      };
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
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const persistProfile = async () => {
    const nextErrors = validateProfile(values);
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return false;
    }

    const payload = {
      businessName: normalizeText(values.businessName),
      phone: normalizeText(values.phone),
      city: normalizeText(values.city),
      address: normalizeText(values.address),
      logoUrl: normalizeText(values.logoUrl)
    };

    try {
      await saveProfile(payload);
      setFormError('');
      setStatus('Company profile saved.');
      setWizardMode(false);
      return true;
    } catch (err) {
      setFormError(err?.message || 'Unable to save company profile.');
      return false;
    }
  };

  const handleSave = async () => {
    await persistProfile();
  };

  const handleWizardNext = async () => {
    if (wizardStep === 0 && !normalizeText(values.businessName)) {
      setFieldErrors((prev) => ({ ...prev, businessName: 'Business name is required.' }));
      return;
    }

    if (wizardStep === WIZARD_STEPS.length - 1) {
      const success = await persistProfile();
      if (success) {
        navigate('/more', { replace: true });
      }
      return;
    }

    setWizardStep((prev) => Math.min(prev + 1, WIZARD_STEPS.length - 1));
  };

  const handleWizardPrevious = () => {
    setWizardStep((prev) => Math.max(prev - 1, 0));
  };

  if (loading && !profile) {
    return (
      <div className="stack">
        <section className="state-loading" aria-live="polite">
          <div className="skeleton-card">
            <div className="skeleton skeleton-line long" />
            <div className="skeleton skeleton-line short" />
          </div>
          <div className="skeleton-card">
            <div className="skeleton skeleton-line long" />
            <div className="skeleton skeleton-line short" />
          </div>
        </section>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="stack">
        <section className="state-error" role="alert">
          <p className="state-title">Could not load company profile.</p>
          <p className="state-message">{error}</p>
          <div className="state-actions">
            <button className="btn btn-secondary" type="button" onClick={() => loadProfile({ force: true })}>
              {t('common.tryAgain')}
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="stack company-profile-page">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            handleUploadLogo(file);
          }
        }}
      />

      {status && <div className="toast">{status}</div>}
      {formError && (
        <section className="state-error" role="alert">
          <p className="state-message">{formError}</p>
        </section>
      )}

      {wizardMode ? (
        <ProfileWizard
          values={values}
          errors={fieldErrors}
          uploading={uploading || loading}
          activeStep={wizardStep}
          onChange={setFieldValue}
          onChooseLogo={handleChooseLogo}
          onNext={handleWizardNext}
          onPrevious={handleWizardPrevious}
          onSkipLogo={() => setFieldValue('logoUrl', '')}
        />
      ) : (
        <>
          <section className="card">
            <p className="kicker">Business settings</p>
            <h2 className="title" style={{ marginBottom: 6 }}>
              Company Profile
            </h2>
            <p className="subtle">Manage company details used across your invoices.</p>
          </section>

          <section className="card">
            <div className="form-grid">
              <label className="field">
                <span className="label">Company logo</span>
                <div className="profile-logo-picker profile-logo-picker-small">
                  {logoPreviewUrl ? <img src={logoPreviewUrl} alt="Company logo" /> : <span>No image selected</span>}
                </div>
                <div className="toolbar">
                  <button className="btn btn-secondary" type="button" onClick={handleChooseLogo} disabled={uploading || loading}>
                    {uploading ? 'Uploading...' : logoPreviewUrl ? 'Replace image' : 'Choose image'}
                  </button>
                  {logoPreviewUrl && (
                    <button className="btn btn-ghost" type="button" onClick={() => setFieldValue('logoUrl', '')}>
                      Remove
                    </button>
                  )}
                </div>
              </label>

              <label className="field">
                <span className="label">Business name</span>
                <input
                  className="input"
                  type="text"
                  value={values.businessName}
                  onChange={(event) => setFieldValue('businessName', event.target.value)}
                  placeholder="Business name"
                  autoComplete="organization"
                />
                {fieldErrors.businessName && <span className="inline-error">{fieldErrors.businessName}</span>}
              </label>

              <label className="field">
                <span className="label">Phone number</span>
                <input
                  className="input"
                  type="tel"
                  value={values.phone}
                  onChange={(event) => setFieldValue('phone', event.target.value)}
                  placeholder="Phone number"
                  autoComplete="tel"
                />
                {fieldErrors.phone && <span className="inline-error">{fieldErrors.phone}</span>}
              </label>

              <label className="field">
                <span className="label">City</span>
                <input
                  className="input"
                  type="text"
                  value={values.city}
                  onChange={(event) => setFieldValue('city', event.target.value)}
                  placeholder="City"
                />
              </label>

              <label className="field">
                <span className="label">Address</span>
                <textarea
                  className="input"
                  rows={4}
                  value={values.address}
                  onChange={(event) => setFieldValue('address', event.target.value)}
                  placeholder="Street, building, floor"
                />
              </label>
            </div>
          </section>

          <div className="sticky-actions">
            <button className="btn btn-secondary" type="button" onClick={() => navigate('/more')} disabled={loading || uploading}>
              {t('common.cancel')}
            </button>
            <button className="btn btn-primary" type="button" onClick={handleSave} disabled={loading || uploading}>
              {loading ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default CompanyProfile;
