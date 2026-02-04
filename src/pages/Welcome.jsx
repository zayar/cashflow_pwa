import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { getToken } from '../lib/auth';
import BrandLogo from '../components/BrandLogo';

function Welcome() {
  const navigate = useNavigate();

  // If already logged in, redirect to invoices
  useEffect(() => {
    if (getToken()) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  return (
    <div style={{
      minHeight: '100vh',
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
        padding: '32px 24px',
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
        padding: '0 32px',
        zIndex: 1
      }}>
        {/* Hero Illustration */}
        <div style={{
          width: '100%',
          maxWidth: 340,
          height: 320,
          marginBottom: 40,
          position: 'relative'
        }}>
          {/* Main portrait card */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(-5deg)',
            width: 250,
            height: 250,
            borderRadius: 28,
            border: '1px solid rgba(255,255,255,0.45)',
            boxShadow: '0 22px 45px rgba(15, 23, 42, 0.28)',
            overflow: 'hidden',
            background: '#0f172a'
          }}>
            <img
              src="/hero-girl.svg"
              alt="Portrait of a confident business owner"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
            <div style={{
              position: 'absolute',
              left: 14,
              bottom: 14,
              padding: '8px 11px',
              borderRadius: 12,
              background: 'rgba(15, 23, 42, 0.52)',
              color: 'white',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.02em',
              backdropFilter: 'blur(6px)'
            }}>
              Paid invoices +32%
            </div>
          </div>

          {/* Secondary glass card (background) */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-38%, -38%) rotate(11deg)',
            width: 215,
            height: 180,
            background: 'linear-gradient(135deg, rgba(71, 85, 105, 0.45) 0%, rgba(30, 41, 59, 0.34) 100%)',
            borderRadius: 20,
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
            background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 20px rgba(251, 191, 36, 0.3)',
            animation: 'float 3s ease-in-out infinite'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
              <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>
            </svg>
          </div>

          <div style={{
            position: 'absolute',
            bottom: 30,
            left: 0,
            width: 40,
            height: 40,
            background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 6px 15px rgba(139, 92, 246, 0.3)',
            animation: 'float 3s ease-in-out infinite 0.5s'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
            </svg>
          </div>

          <div style={{
            position: 'absolute',
            top: 58,
            left: 8,
            width: 46,
            height: 46,
            background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 20px rgba(2, 132, 199, 0.34)',
            animation: 'float 3s ease-in-out infinite 0.9s'
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 19h16" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <rect x="6" y="11" width="3" height="6" rx="1" fill="white" />
              <rect x="11" y="8" width="3" height="9" rx="1" fill="white" />
              <rect x="16" y="5" width="3" height="12" rx="1" fill="white" />
            </svg>
          </div>
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: 32,
          fontWeight: 800,
          color: '#1e293b',
          textAlign: 'center',
          lineHeight: 1.2,
          marginBottom: 16,
          letterSpacing: '-0.5px'
        }}>
          Fast and easy<br />invoice solution.
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: 16,
          color: '#64748b',
          textAlign: 'center',
          lineHeight: 1.6,
          marginBottom: 40,
          maxWidth: 280
        }}>
          Create, send, and track professional invoices in seconds. Get paid faster with Cashflow.
        </p>
      </div>

      {/* Bottom Action */}
      <div style={{
        padding: '32px',
        zIndex: 1
      }}>
        <button
          onClick={() => navigate('/login')}
          style={{
            width: '100%',
            padding: '18px 24px',
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            color: 'white',
            border: 'none',
            borderRadius: 16,
            fontSize: 17,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 10px 30px rgba(30, 41, 59, 0.3)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.boxShadow = '0 15px 35px rgba(30, 41, 59, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 10px 30px rgba(30, 41, 59, 0.3)';
          }}
        >
          Get Started
        </button>

        <p style={{
          textAlign: 'center',
          marginTop: 20,
          fontSize: 13,
          color: '#94a3b8'
        }}>
          Powered by Cashflow
        </p>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
}

export default Welcome;
