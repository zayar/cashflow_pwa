import { gql, useQuery } from '@apollo/client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { listTemplates, safeParseConfigString } from '../lib/templatesApi';
import { resolveStorageAccessUrl } from '../lib/uploadApi';
import { formatShortDate } from '../lib/formatters';
import TemplateInvoicePreview from '../components/TemplateInvoicePreview';

const GET_BUSINESS = gql`
  query GetBusinessForTemplates {
    getBusiness {
      id
      name
    }
  }
`;

const DOCUMENT_TYPE = 'invoice';

function Templates() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const {
    data: businessData,
    loading: businessLoading,
    error: businessError
  } = useQuery(GET_BUSINESS, { fetchPolicy: 'cache-first', nextFetchPolicy: 'cache-first' });
  const businessId = businessData?.getBusiness?.id;

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchTemplates = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setError('');
    try {
      const rows = await listTemplates(DOCUMENT_TYPE, businessId);
      setTemplates(rows);
    } catch (e) {
      setError(e?.message || t('templates.failedLoad'));
    } finally {
      setLoading(false);
    }
  }, [businessId, t]);

  useEffect(() => {
    fetchTemplates();
  }, [businessId]);

  const activeTemplate = useMemo(
    () => templates.find((tpl) => tpl.is_default) || templates[0] || null,
    [templates]
  );

  const config = useMemo(
    () => (activeTemplate ? safeParseConfigString(activeTemplate.config_json) : null),
    [activeTemplate]
  );

  const theme = config?.theme || {};
  const logoUrl = useMemo(() => resolveStorageAccessUrl(config?.header?.logoUrl || ''), [config]);
  const qrUrl = useMemo(() => resolveStorageAccessUrl(config?.footer?.qrImageUrl || ''), [config]);

  const primaryColor = theme.primaryColor || '#1677ff';
  const tableHeaderBg = theme.tableHeaderBg || '#111827';
  const tableHeaderText = theme.tableHeaderText || '#ffffff';

  const previewVars = useMemo(
    () => ({
      '--template-primary': primaryColor,
      '--template-text': theme.textColor || '#111827',
      '--template-border': theme.borderColor || '#e2e8f0',
      '--template-table-header-bg': tableHeaderBg,
      '--template-table-header-text': tableHeaderText
    }),
    [primaryColor, tableHeaderBg, tableHeaderText, theme.textColor, theme.borderColor]
  );

  if ((loading || businessLoading) && templates.length === 0) {
    return (
      <div className="stack">
        <section className="state-loading" aria-live="polite">
          <div className="skeleton-card">
            <div className="skeleton skeleton-line long" />
            <div className="skeleton skeleton-line short" />
          </div>
          <div className="skeleton-card" style={{ minHeight: 200 }}>
            <div className="skeleton skeleton-line long" />
            <div className="skeleton skeleton-line long" />
            <div className="skeleton skeleton-line short" />
          </div>
        </section>
      </div>
    );
  }

  if (businessError) {
    return (
      <div className="stack">
        <section className="state-error" role="alert">
          <p className="state-title">{t('templates.couldNotLoadBusiness')}</p>
          <p className="state-message">{businessError.message}</p>
        </section>
      </div>
    );
  }

  return (
    <div className="stack">
      <section className="card">
        <p className="kicker">{t('templates.kicker')}</p>
        <h2 className="title">{t('templates.title')}</h2>
        <p className="subtle" style={{ marginTop: 4 }}>
          {t('templates.subtitle')}
        </p>
      </section>

      {error && (
        <section className="state-error" role="alert">
          <p className="state-title">{t('templates.couldNotLoad')}</p>
          <p className="state-message">{error}</p>
          <div className="state-actions">
            <button className="btn btn-secondary" type="button" onClick={fetchTemplates}>
              {t('common.tryAgain')}
            </button>
          </div>
        </section>
      )}

      {!error && !activeTemplate && !loading && (
        <section className="state-empty" role="status">
          <p className="state-title">{t('templates.emptyTitle')}</p>
          <p className="state-message">{t('templates.emptyMessage')}</p>
        </section>
      )}

      {!error && activeTemplate && (
        <>
          <section className="card tpl-hero">
            <div className="tpl-hero-top">
              <div className="tpl-hero-info">
                <h3 className="tpl-hero-name">
                  {activeTemplate.name || t('templates.invoiceTemplate')}
                </h3>
                <div className="list-meta" style={{ marginTop: 6 }}>
                  {activeTemplate.is_default && (
                    <span className="badge badge-success">{t('common.default')}</span>
                  )}
                  <span className="meta-chip">
                    {t('templates.updated', { date: formatShortDate(activeTemplate.updated_at) })}
                  </span>
                </div>
              </div>
            </div>

            <div className="tpl-features">
              <div className="tpl-color-dots">
                <span
                  className="tpl-color-dot"
                  style={{ background: primaryColor }}
                  title={t('templateEditor.primaryColor')}
                />
                <span
                  className="tpl-color-dot"
                  style={{ background: tableHeaderBg }}
                  title={t('templateEditor.tableHeaderBg')}
                />
              </div>
              <div className="tpl-feature-tags">
                {logoUrl && <span className="tpl-tag">{t('templateEditor.logo')}</span>}
                {qrUrl && <span className="tpl-tag">{t('templateEditor.qrCode')}</span>}
              </div>
            </div>

            <button
              className="btn btn-primary tpl-edit-btn"
              type="button"
              onClick={() => navigate(`/templates/${DOCUMENT_TYPE}/${activeTemplate.id}/edit`)}
              disabled={loading}
            >
              {t('templates.editTemplate')}
            </button>
          </section>

          <section className="card template-preview-card" style={previewVars}>
            <div className="card-header" style={{ marginBottom: 10 }}>
              <div>
                <p className="kicker">{t('templateEditor.preview')}</p>
                <h3 className="title" style={{ marginBottom: 0 }}>
                  {t('templateEditor.livePreview')}
                </h3>
              </div>
            </div>
            <TemplateInvoicePreview logoUrl={logoUrl} qrUrl={qrUrl} />
          </section>
        </>
      )}
    </div>
  );
}

export default Templates;
