import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function ForgotPassword() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState('email'); // 'email' | 'otp' | 'reset'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => { if (isAuthenticated) navigate('/'); }, [isAuthenticated, navigate]);

  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => setCooldown(c => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSendOTP = async (e) => {
    if (e) e.preventDefault();
    if (!email.includes('@')) return toast.error('Enter a valid email');

    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      toast.success('If the email is registered, an OTP was sent.');
      setStep('otp');
      setCooldown(60);
    } catch (err) {
      toast.error('Failed to request password reset');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) return toast.error('OTP must be 6 digits');

    setLoading(true);
    try {
      await api.post('/auth/verify-otp', { email, otp, purpose: 'reset' });
      toast.success('Code verified. Enter your new password.');
      setStep('reset');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid or expired OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) return toast.error('Password must be at least 8 characters');

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { email, otp, newPassword });
      toast.success('Password reset successfully! You can now log in.');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card slide-up" style={{ maxWidth: 400 }}>
        <div className="auth-logo">CampusLink</div>
        <p className="auth-subtitle">Reset your password</p>

        {step === 'email' && (
          <form onSubmit={handleSendOTP} className="auth-form">
            <div className="form-group">
              <label className="form-label">Email address</label>
              <input 
                className="form-input" 
                type="email" 
                placeholder="you@gmail.com" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required
              />
            </div>

            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
              {loading ? 'Sending Code…' : 'Send Reset Code'}
            </button>
            <p className="auth-link" style={{ marginTop: 12 }}>
              <Link to="/login">← Back to Login</Link>
            </p>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerifyOTP} className="auth-form">
            <div className="form-group">
              <label className="form-label">Enter Verification Code</label>
              <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '8px' }}>
                We sent a 6-digit code to <strong>{email}</strong>
              </p>
              <input 
                className="form-input" 
                type="text" 
                maxLength={6}
                placeholder="000000" 
                value={otp} 
                onChange={e => setOtp(e.target.value)} 
                style={{ fontSize: '1.5rem', letterSpacing: '4px', textAlign: 'center' }}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
              {loading ? 'Verifying…' : 'Verify Code'}
            </button>

            <button 
              type="button" 
              className="btn btn-ghost btn-full" 
              onClick={() => handleSendOTP()} 
              disabled={cooldown > 0 || loading}
              style={{ marginTop: '8px' }}
            >
              {cooldown > 0 ? `Resend Code in ${cooldown}s` : 'Resend Code'}
            </button>
            <button 
              type="button" 
              className="btn btn-ghost btn-full" 
              onClick={() => setStep('email')} 
              disabled={loading}
              style={{ marginTop: '4px', border: 'none' }}
            >
              ← Change Email
            </button>
          </form>
        )}

        {step === 'reset' && (
          <form onSubmit={handleResetPassword} className="auth-form">
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input 
                className="form-input" 
                type="password" 
                placeholder="Min 8 characters" 
                value={newPassword} 
                onChange={e => setNewPassword(e.target.value)} 
                required
              />
            </div>

            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
              {loading ? 'Resetting…' : 'Reset Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
