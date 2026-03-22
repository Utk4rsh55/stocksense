import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-layout-centered">
      <div className="banner-bg-animation">
        <div className="glow-orb orb-1"></div>
        <div className="glow-orb orb-2"></div>
      </div>

      <div className="login-form-container">
        <div className="login-card-modern">
          <div className="login-logo-centered">
            <div className="logo-icon-large">S</div>
            <h2>StockSense</h2>
          </div>
          
          <div className="form-header">
            <h2>Welcome Back</h2>
            <p>Sign in to your dashboard to continue</p>
          </div>

          {error && <div className="login-error-modern">{error}</div>}

          <form onSubmit={handleSubmit} className="modern-form">
            <div className="form-group-modern">
              <label>Username</label>
              <input
                id="login-username"
                type="text"
                placeholder="admin or cashier"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="form-group-modern">
              <label>Password</label>
              <input
                id="login-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            
            <button
              id="login-submit"
              className="btn-modern-primary"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <span className="btn-spinner"></span>
              ) : 'Access Dashboard'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
