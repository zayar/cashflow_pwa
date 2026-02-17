import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { getUsername } from '../lib/auth';
import { createSubscriptionOrder, getSubscriptionStatus } from '../lib/paymentsApi';

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatMoney(amount, currency) {
  const number = Number(amount);
  const safe = Number.isFinite(number) ? number : 0;
  const formatted = safe.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return `${currency} ${formatted}`;
}

const PREMIUM_FEATURES = [
  { label: 'Inventory Management', my: 'ပစ္စည်းကုန်လက်ကျန် စီမံခန့်ခွဲမှု' },
  { label: 'Purchase Orders', my: 'ဈေးဝယ်မှာယ်စာများ' },
  { label: 'Transfer Orders', my: 'လွှဲပြောင်းမှာယ်စာများ' },
  { label: 'Credit Notes', my: 'ခရက်ဒစ်နုတ်စာများ' },
  { label: 'P&L Reports', my: 'အမြတ်အရှုံး အစီရင်ခံစာများ' },
  { label: 'Cashflow Reports', my: 'ငွေသားစီမံခန့်ခွဲမှု အစီရင်ခံစာများ' },
  { label: 'Bill Management', my: 'ဘက်လမ်းစီမံခန့်ခွဲမှု' },
  { label: 'Inventory Valuation', my: 'ပစ္စည်းတန်ဖိုးသတ်မှတ်ချက်' },
  { label: 'Warehouse Reports', my: 'ဂိုဒေါင်အစီရင်ခံစာများ' },
  { label: 'Trial Balance', my: 'စာရင်းချုပ်ညှိစာရင်း' },
];

const PAYMENT_METHODS = [
  { id: 'APLUS', label: 'A+ Wallet' },
  { id: 'AYAPAY', label: 'AYA Pay' },
  { id: 'KPAY', label: 'KBZ Pay' }
];

function Subscribe() {
  const { t, lang } = useI18n();
  const [billing, setBilling] = useState('yearly');
  const [paymentMethod, setPaymentMethod] = useState('APLUS');
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState(() => localStorage.getItem('subscription-pending-id') || '');
  const [pendingStatus, setPendingStatus] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const premiumPlan = {
    id: 'premium',
    name: 'Cashflow Pro',
    monthly: { amount: 29900, currency: 'MMK' },
    yearly: { amount: 299900, currency: 'MMK', was: 359760 }
  };

  const activePrice = billing === 'yearly' ? premiumPlan.yearly : premiumPlan.monthly;
  const priceLine = `${formatMoney(activePrice.amount, activePrice.currency)}/${billing === 'yearly' ? 'yr' : 'mo'}`;
  const perMonthYearly = Math.round(premiumPlan.yearly.amount / 12);

  const requestText = [
    `Cashflow Pro upgrade request`,
    `User: ${getUsername() || 'unknown'}`,
    `Plan: ${premiumPlan.name}`,
    `Billing: ${billing}`,
    `Payment: ${paymentMethod}`,
    `Price: ${priceLine}`,
    `Date: ${new Date().toISOString()}`
  ].join('\n');

  const handleCreateOrder = async () => {
    setError('');
    setCreatingOrder(true);
    try {
      const payload = {
        plan: billing === 'yearly' ? 'YEARLY' : 'MONTHLY',
        payment_method: paymentMethod,
        amount: billing === 'yearly' ? premiumPlan.yearly.amount : premiumPlan.monthly.amount,
        currency: activePrice.currency
      };
      const res = await createSubscriptionOrder(payload);
      setPendingOrderId(res.payment_id);
      localStorage.setItem('subscription-pending-id', res.payment_id);
      if (res.link) {
        window.open(res.link, '_blank');
      }
      setPendingStatus({ status: res.status });
    } catch (err) {
      setError(err?.message || 'Failed to start payment');
    } finally {
      setCreatingOrder(false);
    }
  };

  const refreshStatus = async (orderId) => {
    if (!orderId) return;
    try {
      const res = await getSubscriptionStatus(orderId);
      setPendingStatus(res);
      if (res.status === 'PAID' || res.subscription?.status === 'ACTIVE') {
        localStorage.removeItem('subscription-pending-id');
      }
    } catch (err) {
      setError(err?.message || 'Could not check status');
    }
  };

  useEffect(() => {
    if (pendingOrderId) {
      refreshStatus(pendingOrderId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOrderId]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(requestText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const isMyanmar = lang === 'my';

  return (
    <div className="subscribe-premium">
      {/* Hero Section with App Preview */}
      <section className="premium-hero">
        <div className="premium-hero-content">
          <span className="premium-badge">Pro</span>
          <h1 className="premium-title">
            {isMyanmar ? 'အကောင့်အမြင့်တင်မည်' : 'Upgrade to Pro'}
          </h1>
          <p className="premium-subtitle">
            {isMyanmar 
              ? 'လုပ်ငန်းစီမံခန့်ခွဲမှုအပြည့်အဝကို ရယူလိုက်ပါ' 
              : 'Get the complete business management suite'}
          </p>
        </div>
        
        {/* App Preview Illustrations */}
        <div className="premium-showcase">
          <div className="showcase-card showcase-card-1">
            <div className="preview-ui preview-dashboard">
              <div className="preview-sidebar"></div>
              <div className="preview-content">
                <div className="preview-chart"></div>
                <div className="preview-stats">
                  <div></div><div></div><div></div>
                </div>
              </div>
            </div>
            <span className="showcase-label">{isMyanmar ? 'ဒက်ရှ်ဘုတ်' : 'Dashboard'}</span>
          </div>
          <div className="showcase-card showcase-card-2">
            <div className="preview-ui preview-invoice">
              <div className="preview-header"></div>
              <div className="preview-lines">
                <div></div><div></div><div></div>
              </div>
              <div className="preview-total"></div>
            </div>
            <span className="showcase-label">{isMyanmar ? 'အင်ဗွိုက်စ်' : 'Invoices'}</span>
          </div>
          <div className="showcase-card showcase-card-3">
            <div className="preview-ui preview-reports">
              <div className="preview-bar-chart">
                <div></div><div></div><div></div><div></div>
              </div>
              <div className="preview-pie"></div>
            </div>
            <span className="showcase-label">{isMyanmar ? 'အစီရင်ခံစာ' : 'Reports'}</span>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="premium-features">
        <h2 className="features-title">
          {isMyanmar ? 'ပြည့်စုံသော အကောင့်စီမံခန့်ခွဲမှု' : 'Full Accounting Suite'}
        </h2>
        <div className="features-grid">
          {PREMIUM_FEATURES.map((feature, index) => (
            <div key={index} className="feature-item">
              <span className="feature-check">
                <CheckIcon />
              </span>
              <span className="feature-label">
                {isMyanmar ? feature.my : feature.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section className="premium-pricing">
        <div className="pricing-card">
          <h3 className="pricing-name">Cashflow Pro</h3>
          
          <div className="pricing-tabs">
            <button
              type="button"
              className={`pricing-tab ${billing === 'monthly' ? 'active' : ''}`}
              onClick={() => setBilling('monthly')}
            >
              {isMyanmar ? 'လစဉ်' : 'Monthly'}
            </button>
            <button
              type="button"
              className={`pricing-tab ${billing === 'yearly' ? 'active' : ''}`}
              onClick={() => setBilling('yearly')}
            >
              {isMyanmar ? 'နှစ်စဉ်' : 'Yearly'}
              <span className="pricing-save">
                {isMyanmar ? 'Save MMK 59,860' : 'Save MMK 59,860'}
              </span>
            </button>
          </div>

          <div className="pricing-amount">
            <span className="price">{formatMoney(activePrice.amount, activePrice.currency)}</span>
            <span className="period">/{billing === 'yearly' ? (isMyanmar ? 'နှစ်' : 'year') : (isMyanmar ? 'လ' : 'month')}</span>
          </div>
          
          {billing === 'yearly' && (
            <p className="pricing-note">
              {isMyanmar 
                ? `MMK ${formatMoney(premiumPlan.yearly.was, 'MMK')} မှ ${formatMoney(perMonthYearly, 'MMK')}/လ`
                : `Was ${formatMoney(premiumPlan.yearly.was, 'MMK')} • Now ${formatMoney(perMonthYearly, 'MMK')}/mo`}
            </p>
          )}
        </div>
      </section>

      {/* Payment Methods */}
      <section className="premium-payment">
        <p className="payment-label">{isMyanmar ? 'မှာယ်မည့် ပေးချေမှု' : 'Payment Method'}</p>
        <div className="payment-options">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m.id}
              className={`payment-option ${paymentMethod === m.id ? 'active' : ''}`}
              type="button"
              onClick={() => setPaymentMethod(m.id)}
            >
              <span className="payment-radio" />
              <span className="payment-name">{m.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* CTA Button */}
      <div className="premium-cta">
        <button 
          className="btn-upgrade-premium" 
          type="button" 
          onClick={handleCreateOrder} 
          disabled={creatingOrder}
        >
          {creatingOrder 
            ? (isMyanmar ? 'မှာယ်နေသည်...' : 'Processing...')
            : (isMyanmar ? 'အခုပြည့်စုံစီမံခန့်ခွဲမှုရယူ' : 'Upgrade to Pro Now')}
        </button>
        <p className="cta-note">
          {isMyanmar 
            ? 'စာရင်းသွင်းပြီးပါက လုပ်ငန်းစီမံခန့်ခွဲမှုအပြည့်အဝကို အသုံးပြုနိုင်ပါသည်'
            : 'Get instant access to full accounting suite after subscription'}
        </p>
        
        {error ? <p className="error-message">{error}</p> : null}
        
        {pendingOrderId ? (
          <div className="pending-status">
            <p>{isMyanmar ? 'ငွေပေးချေမှုစောင့်ဆိုင်းနေသည်' : 'Payment pending'}</p>
            <p className="pending-id">ID: {pendingOrderId}</p>
            <div className="pending-actions">
              <button className="btn-secondary" type="button" onClick={() => refreshStatus(pendingOrderId)}>
                {isMyanmar ? 'စစ်ဆေးရန်' : 'Check Status'}
              </button>
              <button 
                className="btn-ghost" 
                type="button"
                onClick={() => {
                  localStorage.removeItem('subscription-pending-id');
                  setPendingOrderId('');
                  setPendingStatus(null);
                }}
              >
                {isMyanmar ? 'ဖျက်ရန်' : 'Clear'}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Copy Request Text (Fallback) */}
      <div className="premium-fallback">
        <button type="button" className="btn-text" onClick={handleCopy}>
          {copied 
            ? (isMyanmar ? 'ကူးယူပြီးပါပြီ' : 'Copied!') 
            : (isMyanmar ? 'မှာယ်စာကူးယူရန်' : 'Copy Request')}
        </button>
      </div>

      <style>{`
        .subscribe-premium {
          max-width: 680px;
          margin: 0 auto;
          padding: 24px 20px calc(120px + env(safe-area-inset-bottom));
          background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
        }
        
        .premium-hero {
          text-align: center;
          margin-bottom: 32px;
        }
        
        .premium-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
          color: #fbbf24;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          border-radius: 20px;
          margin-bottom: 16px;
        }
        
        .premium-badge::before {
          content: '★';
          color: #fbbf24;
        }
        
        .premium-title {
          font-size: 28px;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 8px;
          letter-spacing: -0.02em;
        }
        
        .premium-subtitle {
          font-size: 16px;
          color: #64748b;
          margin: 0;
        }
        
        .premium-showcase {
          display: flex;
          gap: 12px;
          margin-top: 24px;
          justify-content: center;
          perspective: 1000px;
        }
        
        .showcase-card {
          position: relative;
          width: 140px;
          height: 100px;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.3);
          transition: transform 0.3s ease;
        }
        
        .showcase-card:hover {
          transform: translateY(-4px);
        }
        
        .showcase-card-1 {
          transform: rotateY(-8deg) translateZ(20px);
          z-index: 3;
        }
        
        .showcase-card-2 {
          transform: translateZ(40px);
          z-index: 2;
          width: 160px;
          height: 110px;
          margin-top: -10px;
        }
        
        .showcase-card-3 {
          transform: rotateY(8deg) translateZ(20px);
          z-index: 1;
        }
        
        .showcase-card img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .preview-ui {
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
          padding: 10px;
          display: flex;
          gap: 8px;
        }
        
        .preview-dashboard {
          flex-direction: row;
        }
        
        .preview-sidebar {
          width: 30px;
          background: #1e293b;
          border-radius: 4px;
        }
        
        .preview-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        
        .preview-chart {
          flex: 1;
          background: linear-gradient(180deg, #3b82f6 0%, #60a5fa 100%);
          border-radius: 4px;
          opacity: 0.3;
        }
        
        .preview-stats {
          display: flex;
          gap: 4px;
          height: 24px;
        }
        
        .preview-stats > div {
          flex: 1;
          background: white;
          border-radius: 3px;
        }
        
        .preview-invoice {
          flex-direction: column;
          gap: 6px;
        }
        
        .preview-header {
          height: 20px;
          background: linear-gradient(90deg, #0f172a 0%, #1e293b 100%);
          border-radius: 4px;
        }
        
        .preview-lines {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .preview-lines > div {
          height: 14px;
          background: white;
          border-radius: 3px;
        }
        
        .preview-lines > div:nth-child(2) {
          width: 85%;
        }
        
        .preview-lines > div:nth-child(3) {
          width: 70%;
        }
        
        .preview-total {
          height: 22px;
          background: linear-gradient(90deg, #22c55e 0%, #4ade80 100%);
          border-radius: 4px;
          opacity: 0.6;
        }
        
        .preview-reports {
          flex-direction: column;
          gap: 6px;
        }
        
        .preview-bar-chart {
          flex: 1;
          display: flex;
          align-items: flex-end;
          gap: 4px;
          padding: 4px 0;
        }
        
        .preview-bar-chart > div {
          flex: 1;
          background: linear-gradient(180deg, #8b5cf6 0%, #a78bfa 100%);
          border-radius: 2px 2px 0 0;
        }
        
        .preview-bar-chart > div:nth-child(1) { height: 60%; }
        .preview-bar-chart > div:nth-child(2) { height: 85%; }
        .preview-bar-chart > div:nth-child(3) { height: 45%; }
        .preview-bar-chart > div:nth-child(4) { height: 70%; }
        
        .preview-pie {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: conic-gradient(#f59e0b 0deg 120deg, #22c55e 120deg 240deg, #3b82f6 240deg 360deg);
          margin-left: auto;
        }
        
        .showcase-label {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 6px 8px;
          background: linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.7) 100%);
          color: white;
          font-size: 11px;
          font-weight: 700;
          text-align: center;
        }
        
        .premium-features {
          margin-bottom: 28px;
        }
        
        .features-title {
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 16px;
          text-align: center;
        }
        
        .features-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }
        
        @media (min-width: 480px) {
          .features-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        
        .feature-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          background: white;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          transition: all 0.2s ease;
        }
        
        .feature-item:hover {
          border-color: #cbd5e1;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        
        .feature-check {
          width: 22px;
          height: 22px;
          border-radius: 6px;
          background: #dcfce7;
          color: #16a34a;
          display: grid;
          place-items: center;
          flex-shrink: 0;
        }
        
        .feature-check svg {
          width: 14px;
          height: 14px;
        }
        
        .feature-label {
          font-size: 13px;
          font-weight: 600;
          color: #334155;
          line-height: 1.3;
        }
        
        .premium-pricing {
          margin-bottom: 24px;
        }
        
        .pricing-card {
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
          border-radius: 20px;
          padding: 24px;
          color: white;
          text-align: center;
          box-shadow: 0 20px 40px rgba(15, 23, 42, 0.3);
        }
        
        .pricing-name {
          font-size: 20px;
          font-weight: 800;
          margin: 0 0 16px;
          color: #fbbf24;
        }
        
        .pricing-tabs {
          display: flex;
          gap: 8px;
          justify-content: center;
          margin-bottom: 20px;
        }
        
        .pricing-tab {
          padding: 10px 20px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.2);
          background: rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.8);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .pricing-tab.active {
          background: white;
          color: #0f172a;
          border-color: white;
        }
        
        .pricing-save {
          font-size: 10px;
          padding: 2px 8px;
          background: #22c55e;
          color: white;
          border-radius: 10px;
          font-weight: 700;
        }
        
        .pricing-amount {
          margin-bottom: 8px;
        }
        
        .price {
          font-size: 42px;
          font-weight: 900;
          letter-spacing: -0.02em;
        }
        
        .period {
          font-size: 18px;
          font-weight: 500;
          opacity: 0.7;
        }
        
        .pricing-note {
          font-size: 13px;
          opacity: 0.6;
          margin: 0;
        }
        
        .premium-payment {
          margin-bottom: 24px;
        }
        
        .payment-label {
          font-size: 13px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin: 0 0 12px;
          text-align: center;
        }
        
        .payment-options {
          display: flex;
          gap: 12px;
          justify-content: center;
          flex-wrap: wrap;
        }
        
        .payment-option {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 20px;
          border-radius: 12px;
          border: 2px solid #e2e8f0;
          background: white;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .payment-option.active {
          border-color: #1e293b;
          background: #f8fafc;
        }
        
        .payment-radio {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 2px solid #cbd5e1;
          position: relative;
        }
        
        .payment-option.active .payment-radio {
          border-color: #1e293b;
        }
        
        .payment-option.active .payment-radio::after {
          content: '';
          position: absolute;
          inset: 3px;
          border-radius: 50%;
          background: #1e293b;
        }
        
        .payment-name {
          font-size: 14px;
          font-weight: 700;
          color: #334155;
        }
        
        .premium-cta {
          text-align: center;
        }
        
        .btn-upgrade-premium {
          width: 100%;
          max-width: 400px;
          padding: 18px 32px;
          border-radius: 16px;
          border: none;
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
          color: #0f172a;
          font-size: 17px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 8px 24px rgba(251, 191, 36, 0.4);
          margin-bottom: 12px;
        }
        
        .btn-upgrade-premium:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(251, 191, 36, 0.5);
        }
        
        .btn-upgrade-premium:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
        
        .cta-note {
          font-size: 13px;
          color: #64748b;
          margin: 0 0 16px;
        }
        
        .error-message {
          color: #dc2626;
          font-size: 14px;
          font-weight: 600;
          margin: 8px 0;
        }
        
        .pending-status {
          margin-top: 16px;
          padding: 16px;
          background: #fef3c7;
          border-radius: 12px;
          border: 1px solid #fcd34d;
        }
        
        .pending-status p {
          margin: 0 0 4px;
          font-weight: 700;
          color: #92400e;
        }
        
        .pending-id {
          font-size: 12px;
          opacity: 0.7;
        }
        
        .pending-actions {
          display: flex;
          gap: 8px;
          margin-top: 12px;
          justify-content: center;
        }
        
        .btn-secondary {
          padding: 10px 18px;
          border-radius: 10px;
          border: 1px solid #cbd5e1;
          background: white;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }
        
        .btn-ghost {
          padding: 10px 18px;
          border-radius: 10px;
          border: none;
          background: transparent;
          font-size: 13px;
          font-weight: 600;
          color: #92400e;
          cursor: pointer;
        }
        
        .premium-fallback {
          text-align: center;
          margin-top: 20px;
        }
        
        .btn-text {
          padding: 8px 16px;
          border: none;
          background: transparent;
          color: #64748b;
          font-size: 13px;
          font-weight: 600;
          text-decoration: underline;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

export default Subscribe;
