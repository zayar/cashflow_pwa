import { Link, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { getToken } from '../lib/auth';
import BrandLogo from '../components/BrandLogo';
import { useI18n } from '../i18n';

function Welcome() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const titleLines = String(t('welcome.title') || '').split('\n').filter(Boolean);

  // If already logged in, redirect to invoices
  useEffect(() => {
    if (getToken()) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  return (
    <div style={{
      // Use dynamic viewport height so "Get Started" stays visible on mobile browsers.
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background decoration */}
      <div style={{
        position: 'absolute',
        top: '-10%',
        right: '-20%',
        width: '80%',
        height: '50%',
        background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(34, 211, 238, 0.05) 100%)',
        borderRadius: '50%',
        filter: 'blur(60px)'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '10%',
        left: '-10%',
        width: '60%',
        height: '40%',
        background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.08) 0%, rgba(37, 99, 235, 0.05) 100%)',
        borderRadius: '50%',
        filter: 'blur(60px)'
      }} />

      {/* Logo Header */}
      <div style={{
        padding: '22px 24px',
        display: 'flex',
        alignItems: 'center',
        zIndex: 1
      }}>
        <BrandLogo
          variant="full"
          className="welcome-brand-logo"
          title="Cashflow"
          decorative={false}
        />
      </div>

      {/* Main Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0 24px 12px',
        zIndex: 1
      }}>
        {/* Hero Illustration */}
        <div className="welcome-hero-shell">
          {/* Main portrait card */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(-5deg)',
            width: 320,
            height: 330,
            borderRadius: 30,
            border: '1px solid rgba(255,255,255,0.45)',
            boxShadow: '0 22px 45px rgba(15, 23, 42, 0.28)',
            overflow: 'hidden',
            background: 'linear-gradient(160deg, #ffffff 0%, #f4f8ff 60%, #edf3ff 100%)'
          }}>
            <img
              src="/hero-girl-real.jpg"
              alt={t('welcome.heroAlt')}
              onError={(event) => {
                event.currentTarget.src = '/hero-girl.svg';
              }}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scale(1.06)',
                objectPosition: 'center 22%'
              }}
            />
          </div>

          {/* Secondary glass card (background) */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-38%, -38%) rotate(11deg)',
            width: 260,
            height: 240,
            background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.92) 0%, rgba(239, 246, 255, 0.74) 100%)',
            borderRadius: 24,
            boxShadow: '0 15px 30px rgba(100, 116, 139, 0.2)',
            backdropFilter: 'blur(4px)',
            zIndex: -1
          }} />

          {/* Floating elements */}
          <div style={{
            position: 'absolute',
            top: 20,
            right: 10,
            width: 50,
            height: 50,
            background: 'rgba(255, 255, 255, 0.74)',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 20px rgba(30, 41, 59, 0.14)',
            backdropFilter: 'blur(5px)',
            animation: 'float 3s ease-in-out infinite'
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 4v16" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" />
              <path d="M16 7.5c0-1.38-1.79-2.5-4-2.5s-4 1.12-4 2.5 1.79 2.5 4 2.5 4 1.12 4 2.5-1.79 2.5-4 2.5-4-1.12-4-2.5" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <div style={{
            position: 'absolute',
            bottom: 30,
            left: 0,
            width: 40,
            height: 40,
            background: 'rgba(255, 255, 255, 0.74)',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 6px 15px rgba(30, 41, 59, 0.14)',
            backdropFilter: 'blur(5px)',
            animation: 'float 3s ease-in-out infinite 0.5s'
          }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="5" y="4.5" width="14" height="15" rx="2.2" stroke="#1e293b" strokeWidth="1.9" />
              <path d="M8 9h8M8 12h8M8 15h5" stroke="#1e293b" strokeWidth="1.9" strokeLinecap="round" />
            </svg>
          </div>

          <div style={{
            position: 'absolute',
            top: 58,
            left: 8,
            width: 46,
            height: 46,
            background: 'rgba(255, 255, 255, 0.74)',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 20px rgba(30, 41, 59, 0.14)',
            backdropFilter: 'blur(5px)',
            animation: 'float 3s ease-in-out infinite 0.9s'
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 19h16" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" />
              <path d="M7 16v-4M12 16V8M17 16V6" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Headline */}
        <h1 className="welcome-title">
          {titleLines[0] || t('welcome.title')}
          {titleLines.length > 1 ? <br /> : null}
          {titleLines.length > 1 ? titleLines[1] : null}
        </h1>

        <p className="welcome-copy">
          {t('welcome.copy')}
        </p>
      </div>

      {/* Bottom Action */}
      <div className="welcome-actions">
        <button onClick={() => navigate('/login')} className="welcome-primary-btn" type="button">
          {t('welcome.getStarted')}
        </button>
        <p className="welcome-actions-subline">
          {t('welcome.alreadyHaveAccount')}{' '}
          <Link to="/login" className="welcome-secondary-link">
            {t('welcome.logIn')}
          </Link>
        </p>
        <p className="welcome-powered">
          {t('welcome.poweredBy')}
        </p>
      </div>
    </div>
  );
}

export default Welcome;
