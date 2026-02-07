import { gql, useQuery } from '@apollo/client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  DOCUMENT_TYPES,
  getTemplate,
  safeParseConfigString,
  setDefaultTemplate,
  updateTemplate
} from '../lib/templatesApi';
import { completeUpload, resolveStorageAccessUrl, signUpload, uploadToSignedUrl } from '../lib/uploadApi';
import TemplateInvoicePreview from '../components/TemplateInvoicePreview';

const GET_BUSINESS = gql`
  query GetBusinessForTemplateEditor {
    getBusiness {
      id
      name
    }
  }
`;

const defaultConfig = {
  theme: {
    primaryColor: '#1677ff',
    textColor: '#111827',
    tableHeaderBg: '#111827',
    tableHeaderText: '#ffffff',
    borderColor: '#e2e8f0'
  },
  header: {
    showLogo: true
  },
  footer: {
    termsText: '',
    qrTitle: '',
    qrImageUrl: ''
  },
  layout: {
    paperSize: 'A4',
    orientation: 'portrait',
    marginsIn: { top: 1, bottom: 1, left: 0.2, right: 0.2 }
  }
};


function mergeConfig(parsed) {
  return {
    ...defaultConfig,
    ...parsed,
    theme: { ...defaultConfig.theme, ...(parsed?.theme || {}) },
    header: { ...defaultConfig.header, ...(parsed?.header || {}) },
    footer: { ...defaultConfig.footer, ...(parsed?.footer || {}) },
    layout: { ...defaultConfig.layout, ...(parsed?.layout || {}) }
  };
}

function validateImage(file) {
  if (!file) return 'Select an image to upload.';
  const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png';
  if (!isJpgOrPng) return 'You can only upload JPG/PNG files.';
  const isLt1M = file.size / 1024 / 1024 < 1;
  if (!isLt1M) return 'Image must be smaller than 1MB.';
  return '';
}

function TemplateEditor() {
  const navigate = useNavigate();
  const { templateId, documentType: documentTypeParam } = useParams();
  const documentType = documentTypeParam || 'invoice';

  const {
    data: businessData,
    loading: businessLoading,
    error: businessError
  } = useQuery(GET_BUSINESS, { fetchPolicy: 'cache-and-network' });
  const businessId = businessData?.getBusiness?.id;

  const [loading, setLoading] = useState(false);
  const [template, setTemplate] = useState(null);
  const [name, setName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [config, setConfig] = useState(defaultConfig);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const label = useMemo(() => {
    return DOCUMENT_TYPES.find((type) => type.key === documentType)?.label || 'Template';
  }, [documentType]);

  const logoUrl = useMemo(() => resolveStorageAccessUrl(config?.header?.logoUrl || ''), [config?.header?.logoUrl]);
  const qrUrl = useMemo(() => resolveStorageAccessUrl(config?.footer?.qrImageUrl || ''), [config?.footer?.qrImageUrl]);

  const dirty = useMemo(() => {
    if (!savedSnapshot) return false;
    const current = JSON.stringify({ name, isDefault, config });
    return current !== savedSnapshot;
  }, [config, isDefault, name, savedSnapshot]);

  const loadTemplate = useCallback(async () => {
    if (!templateId || !businessId) return;
    setLoading(true);
    setError('');
    try {
      const data = await getTemplate(templateId, businessId);
      setTemplate(data);
      setName(data?.name || '');
      setIsDefault(Boolean(data?.is_default));
      const parsed = safeParseConfigString(data?.config_json);
      const merged = mergeConfig(parsed);
      setConfig(merged);
      setSavedSnapshot(
        JSON.stringify({
          name: data?.name || '',
          isDefault: Boolean(data?.is_default),
          config: merged
        })
      );
    } catch (e) {
      setError(e?.message || 'Failed to load template');
    } finally {
      setLoading(false);
    }
  }, [businessId, templateId]);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  useEffect(() => {
    if (!status) return undefined;
    const timer = setTimeout(() => setStatus(''), 3000);
    return () => clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    const beforeUnload = (event) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  const handleSave = async () => {
    if (!template?.id || !businessId) return;
    setLoading(true);
    setError('');
    try {
      const updated = await updateTemplate({
        id: template.id,
        documentType,
        name,
        isDefault,
        config,
        businessId
      });
      setTemplate(updated);
      setSavedSnapshot(JSON.stringify({ name, isDefault, config }));
      setStatus('Saved');
    } catch (e) {
      setError(e?.message || 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (!savedSnapshot) return;
    try {
      const parsed = JSON.parse(savedSnapshot);
      setName(parsed.name || '');
      setIsDefault(Boolean(parsed.isDefault));
      setConfig(parsed.config || defaultConfig);
      setStatus('Changes reverted');
    } catch {
      setError('Failed to revert changes');
    }
  };

  const handleSetDefault = async () => {
    if (!template?.id || !businessId) return;
    setLoading(true);
    setError('');
    try {
      await setDefaultTemplate(template.id, businessId);
      setIsDefault(true);
      setStatus('Set as default');
      await loadTemplate();
    } catch (e) {
      setError(e?.message || 'Failed to set default');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async ({ file, target }) => {
    const validationError = validateImage(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const context = {
        entityType: 'template_images',
        field: 'image'
      };
      const signed = await signUpload({ file, context });
      await uploadToSignedUrl({ signed, file });
      const completed = await completeUpload({
        objectKey: signed.objectKey,
        mimeType: file.type,
        context
      });

      const raw = completed?.objectKey || signed?.objectKey || '';

      if (target === 'logo') {
        setConfig((prev) => ({
          ...prev,
          header: { ...(prev?.header || {}), logoUrl: raw }
        }));
        setStatus('Logo uploaded');
      }

      if (target === 'qr') {
        setConfig((prev) => ({
          ...prev,
          footer: { ...(prev?.footer || {}), qrImageUrl: raw }
        }));
        setStatus('QR uploaded');
      }
    } catch (e) {
      setError(e?.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (event, target) => {
    const file = event.target.files?.[0];
    if (file) {
      handleUpload({ file, target });
    }
    event.target.value = '';
  };

  const handleRemoveLogo = () => {
    if (!window.confirm('Remove the current logo?')) return;
    setConfig((prev) => ({
      ...prev,
      header: { ...(prev?.header || {}), logoUrl: '' }
    }));
    setStatus('Logo removed');
  };

  const handleRemoveQr = () => {
    if (!window.confirm('Remove the QR image?')) return;
    setConfig((prev) => ({
      ...prev,
      footer: { ...(prev?.footer || {}), qrImageUrl: '' }
    }));
    setStatus('QR removed');
  };

  const theme = config?.theme || {};
  const primaryColor = theme.primaryColor || defaultConfig.theme.primaryColor;
  const textColor = theme.textColor || defaultConfig.theme.textColor;
  const borderColor = theme.borderColor || defaultConfig.theme.borderColor;
  const tableHeaderBg = theme.tableHeaderBg || primaryColor;
  const tableHeaderText = theme.tableHeaderText || '#ffffff';

  const previewVars = useMemo(
    () => ({
      '--template-primary': primaryColor,
      '--template-text': textColor,
      '--template-border': borderColor,
      '--template-table-header-bg': tableHeaderBg,
      '--template-table-header-text': tableHeaderText
    }),
    [borderColor, primaryColor, tableHeaderBg, tableHeaderText, textColor]
  );

  if (businessError) {
    return (
      <div className="stack">
        <section className="state-error" role="alert">
          <p style={{ marginTop: 0, marginBottom: 10, fontWeight: 800 }}>Could not load business data.</p>
          <p style={{ marginTop: 0, marginBottom: 14 }}>{businessError.message}</p>
        </section>
      </div>
    );
  }

  if ((loading || businessLoading) && !template) {
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

  if (error && !template && !loading) {
    return (
      <div className="stack">
        <section className="state-error" role="alert">
          <p style={{ marginTop: 0, marginBottom: 10, fontWeight: 800 }}>Could not load this template.</p>
          <p style={{ marginTop: 0, marginBottom: 14 }}>{error}</p>
          <button className="btn btn-secondary" type="button" onClick={loadTemplate}>
            Try again
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="stack template-editor">
      <section className="card">
        <div className="card-header">
          <div>
            <p className="kicker">{label}</p>
            <h2 className="title" style={{ marginBottom: 4 }}>
              Template Editor
            </h2>
            <p className="subtle">Mobile-first editor for invoice branding. Changes apply instantly to the preview.</p>
          </div>
          {isDefault && <span className="badge badge-success">Default</span>}
        </div>

        <div className="form-grid">
          <label className="field">
            <span className="label">Template name</span>
            <input className="input" value={name} onChange={(event) => setName(event.target.value)} />
          </label>

          <div className="toolbar" style={{ justifyContent: 'space-between' }}>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => navigate('/templates')}
              disabled={loading}
            >
              Back to templates
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={handleSetDefault}
              disabled={loading || isDefault}
            >
              Set default
            </button>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <p className="kicker">Branding</p>
            <h3 className="title" style={{ marginBottom: 0 }}>
              Logo
            </h3>
          </div>
        </div>
        <div className="upload-card">
          <div className="upload-preview" aria-label="Logo preview">
            {logoUrl ? <img src={logoUrl} alt="Logo" /> : <span>No logo</span>}
          </div>
          <div className="upload-meta">
            <p className="subtle" style={{ margin: 0 }}>
              Upload a transparent PNG or JPG under 1MB.
            </p>
            <div className="upload-actions">
              <label className="btn btn-secondary">
                {logoUrl ? 'Replace' : 'Upload'}
                <input
                  className="file-input"
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(event) => handleFileChange(event, 'logo')}
                  disabled={loading}
                />
              </label>
              <button className="btn btn-ghost" type="button" onClick={handleRemoveLogo} disabled={!logoUrl || loading}>
                Remove
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <p className="kicker">Colors</p>
            <h3 className="title" style={{ marginBottom: 0 }}>
              Primary color
            </h3>
          </div>
        </div>
        <div className="color-stack">
          <label className="field">
            <span className="label">Primary color</span>
            <div className="color-row">
              <div className="color-swatch" style={{ background: primaryColor }} />
              <input
                className="color-input"
                type="color"
                value={primaryColor}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    theme: { ...(prev?.theme || {}), primaryColor: event.target.value }
                  }))
                }
              />
              <span className="meta-chip">{primaryColor.toUpperCase()}</span>
            </div>
          </label>

          <label className="field">
            <span className="label">Table header bg</span>
            <div className="color-row">
              <div className="color-swatch" style={{ background: tableHeaderBg }} />
              <input
                className="color-input"
                type="color"
                value={tableHeaderBg}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    theme: { ...(prev?.theme || {}), tableHeaderBg: event.target.value }
                  }))
                }
              />
              <span className="meta-chip">{tableHeaderBg.toUpperCase()}</span>
            </div>
          </label>

          <label className="field">
            <span className="label">Table header text</span>
            <div className="color-row">
              <div className="color-swatch" style={{ background: tableHeaderText }} />
              <input
                className="color-input"
                type="color"
                value={tableHeaderText}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    theme: { ...(prev?.theme || {}), tableHeaderText: event.target.value }
                  }))
                }
              />
              <span className="meta-chip">{tableHeaderText.toUpperCase()}</span>
            </div>
          </label>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <p className="kicker">Payment</p>
            <h3 className="title" style={{ marginBottom: 0 }}>
              QR code
            </h3>
          </div>
        </div>
        <div className="upload-card">
          <div className="upload-preview upload-preview-qr" aria-label="QR preview">
            {qrUrl ? <img src={qrUrl} alt="QR" /> : <span>No QR</span>}
          </div>
          <div className="upload-meta">
            <p className="subtle" style={{ margin: 0 }}>
              This QR appears next to the invoice notes.
            </p>
            <div className="upload-actions">
              <label className="btn btn-secondary">
                {qrUrl ? 'Replace' : 'Upload'}
                <input
                  className="file-input"
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(event) => handleFileChange(event, 'qr')}
                  disabled={loading}
                />
              </label>
              <button className="btn btn-ghost" type="button" onClick={handleRemoveQr} disabled={!qrUrl || loading}>
                Remove
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="card template-preview-card" style={previewVars}>
        <div className="card-header" style={{ marginBottom: 10 }}>
          <div>
            <p className="kicker">Preview</p>
            <h3 className="title" style={{ marginBottom: 0 }}>
              Live invoice preview
            </h3>
          </div>
        </div>
        <TemplateInvoicePreview logoUrl={logoUrl} qrUrl={qrUrl} />
      </section>

      {(status || error) && (
        <section className={error ? 'state-error' : 'surface-card'} role="status" aria-live="polite">
          <p style={{ margin: 0 }}>{error || status}</p>
        </section>
      )}

      <div className="sticky-actions">
        <button className="btn btn-secondary" type="button" onClick={handleReset} disabled={!dirty || loading}>
          Discard changes
        </button>
        <button className="btn btn-primary" type="button" onClick={handleSave} disabled={!dirty || loading}>
          Save changes
        </button>
      </div>

    </div>
  );
}

export default TemplateEditor;
