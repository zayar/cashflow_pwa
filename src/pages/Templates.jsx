import { gql, useQuery } from '@apollo/client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import {
  createTemplate,
  listTemplates,
  safeParseConfigString,
  setDefaultTemplate
} from '../lib/templatesApi';
import { formatShortDate } from '../lib/formatters';

const GET_BUSINESS = gql`
  query GetBusinessForTemplates {
    getBusiness {
      id
      name
    }
  }
`;

const DOCUMENT_TYPE = 'invoice';

const defaultConfig = {
  theme: {
    primaryColor: '#1677ff',
    textColor: '#111827',
    tableHeaderBg: '#f3f4f6',
    tableHeaderText: '#111827',
    borderColor: '#e5e7eb'
  },
  header: {
    showLogo: true
  },
  footer: {
    termsText: ''
  },
  layout: {
    paperSize: 'A4',
    orientation: 'portrait',
    marginsIn: { top: 1, bottom: 1, left: 0.2, right: 0.2 }
  }
};

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
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!status) return undefined;
    const timer = setTimeout(() => setStatus(''), 3000);
    return () => clearTimeout(timer);
  }, [status]);

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

  const activeDefault = useMemo(() => templates.find((t) => t.is_default), [templates]);

  const handleNewTemplate = async () => {
    if (!businessId) return;
    setLoading(true);
    setError('');
    try {
      const baseName = activeDefault?.name || t('templates.invoiceTemplate');
      const config = activeDefault ? safeParseConfigString(activeDefault.config_json) : defaultConfig;
      const created = await createTemplate({
        documentType: DOCUMENT_TYPE,
        name: `Copy of ${baseName}`,
        isDefault: false,
        config,
        businessId
      });
      setStatus(t('templates.templateCreated'));
      if (created?.id) {
        navigate(`/templates/${DOCUMENT_TYPE}/${created.id}/edit`);
      } else {
        await fetchTemplates();
      }
    } catch (e) {
      setError(e?.message || t('templates.failedCreate'));
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async (row) => {
    if (!businessId || !row) return;
    setLoading(true);
    setError('');
    try {
      const config = safeParseConfigString(row?.config_json);
      await createTemplate({
        documentType: DOCUMENT_TYPE,
        name: `Copy of ${row?.name || 'Template'}`,
        isDefault: false,
        config,
        businessId
      });
      setStatus(t('templates.templateDuplicated'));
      await fetchTemplates();
    } catch (e) {
      setError(e?.message || t('templates.failedDuplicate'));
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (row) => {
    if (!businessId || !row?.id) return;
    setLoading(true);
    setError('');
    try {
      await setDefaultTemplate(row.id, businessId);
      setStatus(t('templates.defaultUpdated'));
      await fetchTemplates();
    } catch (e) {
      setError(e?.message || t('templates.failedSetDefault'));
    } finally {
      setLoading(false);
    }
  };

  if ((loading || businessLoading) && templates.length === 0) {
    return (
      <div className="stack">
        <section className="state-loading" aria-live="polite">
          {Array.from({ length: 3 }).map((_, index) => (
            <div className="skeleton-card" key={index}>
              <div className="skeleton skeleton-line long" />
              <div className="skeleton skeleton-line short" />
            </div>
          ))}
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
        <div className="card-header">
          <div>
            <p className="kicker">{t('templates.kicker')}</p>
            <h2 className="title">{t('templates.title')}</h2>
            <p className="subtle" style={{ marginTop: 4 }}>
              {t('templates.subtitle')}
            </p>
          </div>
          <button className="btn btn-primary" type="button" onClick={handleNewTemplate} disabled={loading}>
            {t('templates.create')}
          </button>
        </div>

        <div className="toolbar" style={{ justifyContent: 'space-between' }}>
          <span className="subtle">{t('templates.count', { count: templates.length })}</span>
          <button className="btn btn-secondary" type="button" onClick={fetchTemplates} disabled={loading}>
            {t('common.refresh')}
          </button>
        </div>

        {status && <div className="toast" style={{ marginTop: 10 }}>{status}</div>}
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

      {!error && templates.length === 0 && (
        <section className="state-empty" role="status">
          <p className="state-title">{t('templates.emptyTitle')}</p>
          <p className="state-message">{t('templates.emptyMessage')}</p>
          <div className="state-actions">
            <button className="btn btn-primary" type="button" onClick={handleNewTemplate} disabled={loading}>
              {t('templates.createTemplate')}
            </button>
          </div>
        </section>
      )}

      {!error && templates.length > 0 && (
        <ul className="list" aria-live="polite">
          {templates.map((template) => (
            <li key={template.id} className="list-card">
              <div className="template-list-row">
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 800 }}>{template.name || t('templates.invoiceTemplate')}</p>
                  <div className="list-meta" style={{ marginTop: 6 }}>
                    {template.is_default && <span className="badge badge-success">{t('common.default')}</span>}
                    <span className="meta-chip">{t('templates.updated', { date: formatShortDate(template.updated_at) })}</span>
                  </div>
                </div>
              </div>

              <div className="toolbar" style={{ marginTop: 12 }}>
                <div className="template-list-actions">
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => navigate(`/templates/${DOCUMENT_TYPE}/${template.id}/edit`)}
                  >
                    {t('common.edit')}
                  </button>
                  <button className="btn btn-ghost" type="button" onClick={() => handleDuplicate(template)}>
                    {t('common.duplicate')}
                  </button>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() => handleSetDefault(template)}
                    disabled={template.is_default}
                  >
                    {t('common.setDefault')}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Templates;
