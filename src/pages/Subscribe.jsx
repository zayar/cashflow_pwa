import { useMemo, useState } from 'react';
import Modal from '../components/Modal';
import { useI18n } from '../i18n';
import { getUsername } from '../lib/auth';

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 10.8v5.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 7.6h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function formatMoney(amount, currency) {
  const number = Number(amount);
  const safe = Number.isFinite(number) ? number : 0;
  const formatted = safe.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return `${currency} ${formatted}`;
}

function computePerMonth(yearlyAmount) {
  const number = Number(yearlyAmount);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.round(number / 12);
}

function PlanOption({ title, priceLine, metaLine, active, onClick }) {
  return (
    <button type="button" className={`plan-option ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="plan-radio" aria-hidden="true" />
      <div style={{ minWidth: 0 }}>
        <p className="plan-option-title">{title}</p>
        <p className="plan-option-price">{priceLine}</p>
        {metaLine ? <p className="plan-option-meta">{metaLine}</p> : null}
      </div>
    </button>
  );
}

function Subscribe() {
  const { t } = useI18n();
  const [selectedPlan, setSelectedPlan] = useState('plus');
  const [billing, setBilling] = useState('monthly'); // monthly | yearly
  const [showFeaturesFor, setShowFeaturesFor] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const plans = useMemo(
    () => [
      {
        id: 'essential',
        accent: 'essential',
        popular: false,
        name: t('subscribe.plans.essential.name'),
        blurb: t('subscribe.plans.essential.blurb'),
        monthly: { amount: 9900, currency: 'MMK' },
        yearly: { amount: 99900, currency: 'MMK', was: 119760 },
        features: [
          t('subscribe.plans.essential.f1'),
          t('subscribe.plans.essential.f2'),
          t('subscribe.plans.essential.f3'),
          t('subscribe.plans.essential.f4')
        ]
      },
      {
        id: 'plus',
        accent: 'plus',
        popular: true,
        name: t('subscribe.plans.plus.name'),
        blurb: t('subscribe.plans.plus.blurb'),
        monthly: { amount: 19900, currency: 'MMK' },
        yearly: { amount: 199900, currency: 'MMK', was: 239760 },
        features: [
          t('subscribe.plans.plus.f1'),
          t('subscribe.plans.plus.f2'),
          t('subscribe.plans.plus.f3'),
          t('subscribe.plans.plus.f4'),
          t('subscribe.plans.plus.f5')
        ]
      },
      {
        id: 'premium',
        accent: 'premium',
        popular: false,
        name: t('subscribe.plans.premium.name'),
        blurb: t('subscribe.plans.premium.blurb'),
        monthly: { amount: 29900, currency: 'MMK' },
        yearly: { amount: 299900, currency: 'MMK', was: 359760 },
        features: [
          t('subscribe.plans.premium.f1'),
          t('subscribe.plans.premium.f2'),
          t('subscribe.plans.premium.f3'),
          t('subscribe.plans.premium.f4'),
          t('subscribe.plans.premium.f5')
        ]
      }
    ],
    [t]
  );

  const activePlan = useMemo(() => plans.find((p) => p.id === selectedPlan) || plans[1], [plans, selectedPlan]);
  const activePrice = billing === 'yearly' ? activePlan.yearly : activePlan.monthly;
  const priceLine =
    billing === 'yearly'
      ? `${formatMoney(activePrice.amount, activePrice.currency)}/${t('subscribe.year')}`
      : `${formatMoney(activePrice.amount, activePrice.currency)}/${t('subscribe.month')}`;

  const perMonthForYearly = billing === 'yearly' ? computePerMonth(activePlan.yearly.amount) : 0;
  const perMonthLine =
    billing === 'yearly' ? `${formatMoney(perMonthForYearly, activePlan.yearly.currency)}/${t('subscribe.month')}` : '';

  const requestText = useMemo(() => {
    const username = getUsername() || 'unknown';
    return [
      `Cashflow Pro upgrade request`,
      `User: ${username}`,
      `Plan: ${activePlan.name}`,
      `Billing: ${billing}`,
      `Price: ${priceLine}`,
      `Date: ${new Date().toISOString()}`
    ].join('\n');
  }, [activePlan.name, billing, priceLine]);

  const handleUpgrade = async () => {
    setCopied(false);
    setShowRequestModal(true);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(requestText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard might be blocked; user can manually copy from the textarea.
      setCopied(false);
    }
  };

  return (
    <div className="stack subscribe-page">
      <section className="subscribe-hero">
        <div className="subscribe-hero-top">
          <div className="subscribe-hero-icon" aria-hidden="true">
            <InfoIcon />
          </div>
          <div style={{ minWidth: 0 }}>
            <p className="kicker">{t('subscribe.kicker')}</p>
            <h2 className="title" style={{ marginBottom: 6 }}>
              {t('subscribe.title')}
            </h2>
            <p className="subtle" style={{ marginTop: 0 }}>
              {t('subscribe.subtitle')}
            </p>
          </div>
        </div>
      </section>

      <div className="plan-stack">
        {plans.map((plan) => {
          const isSelected = plan.id === selectedPlan;
          const yearlyPerMonth = computePerMonth(plan.yearly.amount);
          return (
            <section key={plan.id} className={`plan-card ${plan.accent} ${isSelected ? 'selected' : ''}`}>
              <div className="plan-head">
                <div style={{ minWidth: 0 }}>
                  {plan.popular ? <span className="plan-badge">{t('subscribe.mostPopular')}</span> : null}
                  <h3 className="plan-title">{plan.name}</h3>
                  <p className="subtle" style={{ margin: 0 }}>
                    {plan.blurb}
                  </p>
                </div>
                <button
                  type="button"
                  className="plan-pick"
                  onClick={() => {
                    setSelectedPlan(plan.id);
                    setBilling('monthly');
                  }}
                >
                  {isSelected ? t('subscribe.selected') : t('subscribe.select')}
                </button>
              </div>

              <div className="plan-options">
                <PlanOption
                  title={t('subscribe.monthly')}
                  priceLine={`${formatMoney(plan.monthly.amount, plan.monthly.currency)}/${t('subscribe.month')}`}
                  metaLine=""
                  active={isSelected && billing === 'monthly'}
                  onClick={() => {
                    setSelectedPlan(plan.id);
                    setBilling('monthly');
                  }}
                />
                <PlanOption
                  title={t('subscribe.yearly')}
                  priceLine={`${formatMoney(plan.yearly.amount, plan.yearly.currency)}/${t('subscribe.year')}`}
                  metaLine={`${formatMoney(plan.yearly.was, plan.yearly.currency)} ${t('subscribe.was')} • ${formatMoney(yearlyPerMonth, plan.yearly.currency)}/${t('subscribe.month')}`}
                  active={isSelected && billing === 'yearly'}
                  onClick={() => {
                    setSelectedPlan(plan.id);
                    setBilling('yearly');
                  }}
                />
              </div>

              <div className="plan-features">
                <p className="plan-features-kicker">{t('subscribe.everythingIncludes', { name: plan.name })}</p>
                <ul className="plan-features-list">
                  {plan.features.slice(0, 4).map((f) => (
                    <li key={f} className="plan-feature">
                      <span className="plan-feature-icon" aria-hidden="true">
                        <CheckIcon />
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="plan-more"
                  onClick={() => setShowFeaturesFor((prev) => (prev === plan.id ? '' : plan.id))}
                >
                  {showFeaturesFor === plan.id ? t('subscribe.hideAllFeatures') : t('subscribe.seeAllFeatures')}
                </button>
                {showFeaturesFor === plan.id ? (
                  <ul className="plan-features-list more" style={{ marginTop: 10 }}>
                    {plan.features.slice(4).map((f) => (
                      <li key={f} className="plan-feature">
                        <span className="plan-feature-icon" aria-hidden="true">
                          <CheckIcon />
                        </span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      <div className="subscribe-sticky">
        <button className="btn btn-primary subscribe-cta" type="button" onClick={handleUpgrade}>
          <span className="subscribe-cta-title">{t('subscribe.upgradeNow')}</span>
          <span className="subscribe-cta-sub">
            {activePlan.name} {billing === 'yearly' ? t('subscribe.yearlyPlan') : t('subscribe.monthlyPlan')} •{' '}
            {billing === 'yearly' ? perMonthLine : priceLine}
          </span>
        </button>
      </div>

      {showRequestModal && (
        <Modal title={t('subscribe.requestTitle')} onClose={() => setShowRequestModal(false)}>
          <div className="form-grid">
            <p className="subtle" style={{ marginTop: 0 }}>
              {t('subscribe.requestCopy')}
            </p>
            <textarea className="input" rows={7} readOnly value={requestText} style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace' }} />
            <div className="toolbar" style={{ justifyContent: 'space-between' }}>
              <button className="btn btn-secondary" type="button" onClick={() => setShowRequestModal(false)}>
                {t('common.close')}
              </button>
              <button className="btn btn-primary" type="button" onClick={handleCopy}>
                {copied ? t('subscribe.copied') : t('subscribe.copyRequest')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default Subscribe;

