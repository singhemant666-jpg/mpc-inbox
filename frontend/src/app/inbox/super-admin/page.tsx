'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AdminPanel } from '@/components/admin/AdminPanel';
import { login, getProfile } from '@/lib/api';

export default function SuperAdminPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-bypass login form if already authenticated as admin
  useEffect(() => {
    async function verifyActiveSession() {
      try {
        const token = localStorage.getItem('inbox_token');
        const localUser = localStorage.getItem('inbox_user');
        
        if (token && localUser) {
          const parsed = JSON.parse(localUser);
          if (parsed.role === 'super_admin') {
            const profile = await getProfile();
            if (profile && profile.role === 'super_admin') {
              setIsAuthenticated(true);
            }
          }
        }
      } catch (e) {
        // Active session check failed or expired, load the login gate
      } finally {
        setCheckingSession(false);
      }
    }
    verifyActiveSession();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await login(email.trim(), password);
      
      if (data.user.role !== 'super_admin') {
        setError('Access Denied: Standard staff accounts cannot access the Super Admin Panel.');
        return;
      }

      // Save token and user details to localStorage so they are logged in
      localStorage.setItem('inbox_token', data.access_token);
      localStorage.setItem('inbox_user', JSON.stringify(data.user));

      setIsAuthenticated(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="h-screen w-screen bg-[#0B141A] flex flex-col items-center justify-center gap-3 text-gray-400 select-none">
        <span className="w-9 h-9 border-3 border-[#00A884]/30 border-t-[#00A884] rounded-full animate-spin" />
        <span className="text-xs font-medium">Loading session...</span>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="h-screen w-screen bg-[#111B21]">
        <AdminPanel onClose={() => {
          // Send user back to their inbox
          router.push('/inbox');
        }} />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-[#0B141A] flex items-center justify-center p-4 select-none relative overflow-hidden font-sans">
      
      {/* Decorative WhatsApp Style Dark Background Pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat" />

      {/* Glassmorphic Login Card */}
      <div className="w-full max-w-md bg-[#1F2C33] border border-[#2A3942]/40 rounded-3xl shadow-2xl p-8 z-10 flex flex-col items-center animate-scale-up">
        
        {/* Lock/Security Icon Container */}
        <div className="w-16 h-16 rounded-full bg-yellow-500/10 text-yellow-500 flex items-center justify-center border border-yellow-500/20 shadow-lg shadow-yellow-950/20 mb-5 relative group">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <div className="absolute inset-0 rounded-full border border-yellow-500/30 scale-110 group-hover:scale-125 transition-smooth" />
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-white tracking-wide text-center">Super Admin Access</h2>
        <p className="text-[#8696A0] text-xs text-center mt-1.5 mb-6 max-w-xs leading-relaxed">
          Please authenticate with your administrator credentials to proceed.
        </p>

        {/* Error Notification */}
        {error && (
          <div className="w-full mb-5 p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-2xl text-left leading-relaxed animate-shake">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">
          <div>
            <label className="block text-[10px] text-[#8696A0] font-semibold uppercase tracking-wider mb-2">Username / Email</label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@mypainclinic.com"
                className="w-full bg-[#2A3942] border border-[#2A3942] rounded-2xl pl-11 pr-4 py-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-smooth"
                required
                autoFocus
              />
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-[#8696A0] font-semibold uppercase tracking-wider mb-2">Security Password</label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#2A3942] border border-[#2A3942] rounded-2xl pl-11 pr-4 py-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-smooth"
                required
              />
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-3 w-full bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-[#0B141A] text-xs font-bold py-3.5 rounded-2xl transition-smooth shadow-lg shadow-yellow-950/20 flex items-center justify-center gap-2 tracking-wide cursor-pointer"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-[#0B141A]/30 border-t-[#0B141A] rounded-full animate-spin" />
            ) : (
              'Verify & Access'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
