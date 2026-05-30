import React, { useState } from 'react';
import { LogIn, UserPlus, Lock, Mail, AlertCircle, Zap } from 'lucide-react';
import { login, register } from '../api';

interface AuthProps {
  onLogin: (token: string, userId: string, name: string) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const data = await login(email, password);
        onLogin(data.access_token, data.user_id, data.name);
      } else {
        const data = await register(email, password, name);
        onLogin(data.access_token, data.user_id, data.name);
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-secondary)', padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 400, background: 'var(--bg-primary)',
        borderRadius: 16, border: '1px solid var(--border)',
        boxShadow: '0 10px 40px rgba(0,0,0,0.05)', padding: '32px 36px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, var(--feuji-red), var(--feuji-amber))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={24} color="white" />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
            PerfSight AI
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
            {isLogin ? 'Welcome back. Sign in to your workspace.' : 'Create your enterprise performance workspace.'}
          </p>
        </div>

        {error && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, background: 'var(--glow-red)',
            border: '1px solid rgba(220,38,38,0.2)', color: 'var(--accent-red)',
            fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!isLogin && (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                Full Name
              </label>
              <input
                className="input" type="text" placeholder="Jane Doe" required={!isLogin}
                value={name} onChange={e => setName(e.target.value)}
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                className="input" type="email" placeholder="jane@company.com" required
                value={email} onChange={e => setEmail(e.target.value)}
                style={{ paddingLeft: 40 }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                className="input" type="password" placeholder="••••••••" required
                value={password} onChange={e => setPassword(e.target.value)}
                style={{ paddingLeft: 40 }}
              />
            </div>
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '12px 16px', fontSize: 14, marginTop: 8 }}>
            {loading ? <div className="spinner" style={{ width: 18, height: 18 }} /> : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--text-secondary)' }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => { setIsLogin(!isLogin); setError(null); }}
            style={{ background: 'none', border: 'none', color: 'var(--feuji-red)', fontWeight: 600, cursor: 'pointer' }}>
            {isLogin ? 'Sign up' : 'Log in'}
          </button>
        </div>
      </div>
    </div>
  );
};
