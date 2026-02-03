import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { getToken } from '../lib/auth';

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
        gap: 12,
        zIndex: 1
      }}>
        <div style={{
          width: 44,
          height: 44,
          background: 'linear-gradient(135deg, #2563eb, #22d3ee)',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 16px rgba(37, 99, 235, 0.25)'
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" fill="white" fillOpacity="0.9"/>
            <path d="M14 2V8H20" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 18V12" stroke="#2563eb" strokeWidth="2" strokeLinecap="round"/>
            <path d="M9 15H15" stroke="#2563eb" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <span style={{
          fontSize: 22,
          fontWeight: 800,
          color: '#1e293b',
          letterSpacing: '-0.5px'
        }}>
          Cashflow
        </span>
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
        {/* Invoice Illustration */}
        <div style={{
          width: '100%',
          maxWidth: 320,
          height: 280,
          marginBottom: 40,
          position: 'relative'
        }}>
          {/* Main Invoice Card */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(-6deg)',
            width: 220,
            height: 160,
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            borderRadius: 16,
            boxShadow: '0 20px 40px rgba(16, 185, 129, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ color: 'white', fontSize: 12, fontWeight: 600, opacity: 0.9 }}>INVOICE</div>
              <div style={{
                width: 28,
                height: 28,
                background: 'rgba(255,255,255,0.2)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
              </div>
            </div>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginBottom: 4 }}>Total Amount</div>
              <div style={{ color: 'white', fontSize: 28, fontWeight: 800 }}>$1,250.00</div>
            </div>
          </div>

          {/* Secondary Invoice Card (background) */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-40%, -40%) rotate(12deg)',
            width: 200,
            height: 140,
            background: 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
            borderRadius: 16,
            boxShadow: '0 15px 30px rgba(100, 116, 139, 0.25)',
            opacity: 0.4,
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
