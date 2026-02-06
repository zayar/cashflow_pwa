import { gql, useQuery } from '@apollo/client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const {
    data: businessData,
    loading: businessLoading,
    error: businessError
  } = useQuery(GET_BUSINESS, { fetchPolicy: 'cache-and-network' });
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
      setError(e?.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const activeDefault = useMemo(() => templates.find((t) => t.is_default), [templates]);

  const handleNewTemplate = async () => {
    if (!businessId) return;
    setLoading(true);
    setError('');
    try {
      const baseName = activeDefault?.name || 'Invoice Template';
      const config = activeDefault ? safeParseConfigString(activeDefault.config_json) : defaultConfig;
      const created = await createTemplate({
        documentType: DOCUMENT_TYPE,
        name: `Copy of ${baseName}`,
        isDefault: false,
        config,
        businessId
      });
      setStatus('Template created');
      if (created?.id) {
        navigate(`/templates/${DOCUMENT_TYPE}/${created.id}/edit`);
      } else {
        await fetchTemplates();
      }
    } catch (e) {
      setError(e?.message || 'Failed to create template');
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
      setStatus('Template duplicated');
      await fetchTemplates();
    } catch (e) {
      setError(e?.message || 'Failed to duplicate template');
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
      setStatus('Default template updated');
      await fetchTemplates();
    } catch (e) {
      setError(e?.message || 'Failed to set default');
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
          <p style={{ marginTop: 0, marginBottom: 8, fontWeight: 700 }}>Could not load business data.</p>
          <p style={{ marginTop: 0, marginBottom: 12 }}>{businessError.message}</p>
        </section>
      </div>
    );
  }

  return (
    <div className="stack">
      <section className="card">
        <div className="card-header">
          <div>
            <p className="kicker">Templates</p>
            <h2 className="title">Invoice Templates</h2>
            <p className="subtle" style={{ marginTop: 4 }}>
              Add your logo, choose a brand color, and attach a payment QR.
            </p>
          </div>
          <button className="btn btn-primary" type="button" onClick={handleNewTemplate} disabled={loading}>
            + New template
          </button>
        </div>

        <div className="toolbar" style={{ justifyContent: 'space-between' }}>
          <span className="subtle">{templates.length} templates</span>
          <button className="btn btn-secondary" type="button" onClick={fetchTemplates} disabled={loading}>
            Refresh
          </button>
        </div>

        {status && <div className="toast" style={{ marginTop: 10 }}>{status}</div>}
      </section>

      {error && (
        <section className="state-error" role="alert">
          <p style={{ marginTop: 0, marginBottom: 8, fontWeight: 700 }}>Could not load templates.</p>
          <p style={{ marginTop: 0, marginBottom: 12 }}>{error}</p>
          <button className="btn btn-secondary" type="button" onClick={fetchTemplates}>
            Try again
          </button>
        </section>
      )}

      {!error && templates.length === 0 && (
        <section className="state-empty" role="status">
          <p style={{ marginTop: 0, marginBottom: 8, fontWeight: 700 }}>No templates yet.</p>
          <p style={{ margin: 0 }}>Create one to customize how invoices look on PDF and printouts.</p>
        </section>
      )}

      {!error && templates.length > 0 && (
        <ul className="list" aria-live="polite">
          {templates.map((template) => (
            <li key={template.id} className="list-card">
              <div className="template-list-row">
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 800 }}>{template.name || 'Invoice Template'}</p>
                  <div className="list-meta" style={{ marginTop: 6 }}>
                    {template.is_default && <span className="badge badge-success">Default</span>}
                    <span className="meta-chip">Updated {formatShortDate(template.updated_at)}</span>
                  </div>
                </div>
              </div>

              <div className="toolbar" style={{ marginTop: 12 }}>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => navigate(`/templates/${DOCUMENT_TYPE}/${template.id}/edit`)}
                >
                  Edit
                </button>
                <button className="btn btn-ghost" type="button" onClick={() => handleDuplicate(template)}>
                  Duplicate
                </button>
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => handleSetDefault(template)}
                  disabled={template.is_default}
                >
                  Set default
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Templates;
