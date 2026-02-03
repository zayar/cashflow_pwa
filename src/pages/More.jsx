import { useNavigate } from 'react-router-dom';
import { clearToken } from '../lib/auth';

function More() {
  const navigate = useNavigate();

  const handleLogout = () => {
    clearToken();
    navigate('/login');
  };

  return (
    <div className="card">
      <p className="subtle">Settings</p>
      <h2 className="heading">More</h2>
      <p className="subtle">Offline mode, exports, and preferences will live here.</p>
      
      <div style={{ marginTop: 24 }}>
        <button 
          onClick={handleLogout} 
          className="btn" 
          style={{ 
            width: '100%', 
            background: '#fee2e2', 
            color: '#ef4444', 
            border: '1px solid #fecaca' 
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}

export default More;
