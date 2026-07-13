import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import TagPicker from '../components/TagPicker';
import api from '../api/axios';
import toast from 'react-hot-toast';

const GMAIL_RE = /@gmail\.com$/i;

function validateEmail(email) {
  if (!email.includes('@')) return 'Enter a valid email';
  if (!GMAIL_RE.test(email)) return 'Only @gmail.com emails are allowed for now.';
  return null;
}

export default function Register() {
  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState('details'); // 'details' | 'otp'
  const [form, setForm] = useState({
    username: '', email: '', password: '', college: '', bio: '', otp: ''
  });
  const [interests, setInterests] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => { if (isAuthenticated) navigate('/'); }, [isAuthenticated]);

  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => setCooldown(c => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const { data: tags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: () => api.get('/tags/').then((r) => r.data),
  });

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const validateDetails = () => {
    const errs = {};
    if (form.username.length < 3) errs.username = 'Min 3 characters';
    if (!/^[a-zA-Z0-9_]+$/.test(form.username)) errs.username = 'Letters, numbers, underscores only';
    const emailErr = validateEmail(form.email);
    if (emailErr) errs.email = emailErr;
    if (form.password.length < 8) errs.password = 'Min 8 characters';
    if (!form.college.trim()) errs.college = 'Enter your college name';
    if (interests.length < 3) errs.interests = 'Select at least 3 interests';
    return errs;
  };

  const handleSendOTP = async (e) => {
    if (e) e.preventDefault();
    const errs = validateDetails();
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    try {
      // Bypassing OTP for Django migration to use direct user creation
      await register({ ...form, interests });
      toast.success('Welcome to CampusLink! 🎉');
      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.error;
      toast.error(typeof msg === 'string' ? msg : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndRegister = async (e) => {
    e.preventDefault();
    if (form.otp.length !== 6) {
      setErrors({ otp: 'OTP must be 6 digits' });
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await register({ ...form, interests });
      toast.success('Welcome to CampusLink! 🎉');
      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.error;
      toast.error(typeof msg === 'string' ? msg : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card slide-up" style={{ maxWidth: 560 }}>
        <div className="auth-logo">CampusLink</div>
        <p className="auth-subtitle">Your college social network — join the community</p>

        {step === 'details' && (
          <form onSubmit={handleSendOTP} className="auth-form">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input className="form-input" placeholder="coolstudent" value={form.username} onChange={set('username')} />
                {errors.username && <span className="form-error">{errors.username}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">College</label>
                <input className="form-input" placeholder="MIT" value={form.college} onChange={set('college')} />
                {errors.college && <span className="form-error">{errors.college}</span>}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Email (@gmail.com)</label>
              <input className="form-input" type="email" placeholder="you@gmail.com" value={form.email} onChange={set('email')} />
              {errors.email && <span className="form-error">{errors.email}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" placeholder="Min 8 characters" value={form.password} onChange={set('password')} />
              {errors.password && <span className="form-error">{errors.password}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Bio (optional)</label>
              <textarea className="form-input" placeholder="Tell us about yourself…" value={form.bio} onChange={set('bio')} style={{ minHeight: 70 }} />
            </div>

            <div className="form-group">
              <label className="form-label">Your Interests (pick at least 3)</label>
              <TagPicker tags={tags} selected={interests} onChange={setInterests} min={3} />
              {errors.interests && <span className="form-error">{errors.interests}</span>}
            </div>

            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
              {loading ? 'Sending Code…' : 'Continue 🚀'}
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerifyAndRegister} className="auth-form">
            <div className="form-group">
              <label className="form-label">Enter Verification Code</label>
              <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '8px' }}>
                We sent a 6-digit code to <strong>{form.email}</strong>
              </p>
              <input 
                className="form-input" 
                type="text" 
                maxLength={6}
                placeholder="000000" 
                value={form.otp} 
                onChange={set('otp')} 
                style={{ fontSize: '1.5rem', letterSpacing: '4px', textAlign: 'center' }}
              />
              {errors.otp && <span className="form-error">{errors.otp}</span>}
            </div>

            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
              {loading ? 'Verifying…' : 'Verify & Create Account'}
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
              onClick={() => setStep('details')} 
              disabled={loading}
              style={{ marginTop: '4px', border: 'none' }}
            >
              ← Back to Details
            </button>
          </form>
        )}

        {step === 'details' && (
          <p className="auth-link">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        )}
      </div>
    </div>
  );
}
