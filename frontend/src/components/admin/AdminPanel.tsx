import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUsers, createUser, changeUserPassword, updateUser } from '@/lib/api';

interface AdminPanelProps {
  onClose: () => void;
}

export function AdminPanel({ onClose }: AdminPanelProps) {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New User Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('agent');

  // Quick Change Password Dialog State
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [pwSubmitting, setPwSubmitting] = useState(false);

  // Full Edit Account Dialog State (Email, Password, Name, Role)
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState('agent');
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  useEffect(() => {
    fetchUsers();
    try {
      const local = localStorage.getItem('inbox_user');
      if (local) setCurrentUser(JSON.parse(local));
    } catch (e) {}
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load staff list.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await createUser({ name, email, password, role });
      setSuccess(`Account for ${name} created successfully!`);
      setName('');
      setEmail('');
      setPassword('');
      setRole('agent');
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create user account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setPwError('Password must be at least 6 characters long.');
      return;
    }

    setPwSubmitting(true);
    setPwError(null);
    setPwSuccess(null);

    try {
      await changeUserPassword(selectedUser.id, newPassword);
      setPwSuccess('Password updated successfully!');
      setNewPassword('');
      setTimeout(() => {
        setSelectedUser(null);
        setPwSuccess(null);
      }, 1500);
    } catch (err: any) {
      setPwError(err.response?.data?.message || 'Failed to update password.');
    } finally {
      setPwSubmitting(false);
    }
  };

  const openEditModal = (u: any) => {
    setEditingUser(u);
    setEditName(u.name || '');
    setEditEmail(u.email || '');
    setEditPassword('');
    setEditRole(u.role || 'agent');
    setEditError(null);
    setEditSuccess(null);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !editEmail.trim()) {
      setEditError('Full Name and Email Address are required.');
      return;
    }
    if (editPassword && editPassword.length < 6) {
      setEditError('New password must be at least 6 characters long.');
      return;
    }

    setEditSubmitting(true);
    setEditError(null);
    setEditSuccess(null);

    try {
      const payload: any = {
        name: editName.trim(),
        email: editEmail.trim(),
        role: editRole,
      };
      if (editPassword.trim()) {
        payload.password = editPassword.trim();
      }

      await updateUser(editingUser.id, payload);
      setEditSuccess('Account updated successfully!');

      // Sync local storage if editing the logged-in super admin
      if (currentUser && (currentUser.id === editingUser.id || currentUser.email === editingUser.email)) {
        const updatedLocal = { ...currentUser, name: editName.trim(), email: editEmail.trim(), role: editRole };
        setCurrentUser(updatedLocal);
        localStorage.setItem('inbox_user', JSON.stringify(updatedLocal));
      }

      fetchUsers();
      setTimeout(() => {
        setEditingUser(null);
        setEditSuccess(null);
      }, 1200);
    } catch (err: any) {
      setEditError(err.response?.data?.message || 'Failed to update account.');
    } finally {
      setEditSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#111B21] text-gray-200 select-none animate-fade-in relative">
      {/* Admin Header */}
      <div className="px-6 py-4 flex items-center justify-between bg-[#202C33] border-b border-[#2A3942]/30 shrink-0 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#00A884]/10 text-[#00A884]">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold text-white leading-tight">Super Admin Panel</h2>
            <span className="text-[11px] text-[#8696A0]">Manage accounts, edit staff emails & reset passwords</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Quick Change My Credentials Button */}
          {currentUser && (
            <button
              onClick={() => {
                const found = users.find((u) => u.id === currentUser.id || u.email === currentUser.email) || currentUser;
                openEditModal(found);
              }}
              className="px-3.5 py-2 bg-[#00A884]/15 hover:bg-[#00A884]/25 border border-[#00A884]/40 rounded-xl text-[#00A884] hover:text-emerald-300 text-xs font-semibold transition-smooth flex items-center gap-1.5 shadow-sm"
              title="Change My Email or Password"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              Change My Email / Password
            </button>
          )}

          {/* Go to Inbox */}
          <button
            onClick={onClose}
            className="px-3.5 py-2 bg-[#2A3942] hover:bg-[#374248] text-gray-300 hover:text-white rounded-xl text-xs font-semibold transition-smooth flex items-center gap-1.5 shadow-sm"
          >
            Go to Inbox &rarr;
          </button>

          {/* Logout Button */}
          <button
            onClick={() => {
              localStorage.removeItem('inbox_token');
              localStorage.removeItem('inbox_user');
              router.replace('/login');
            }}
            className="px-3.5 py-2 bg-red-600/10 hover:bg-red-600/25 border border-red-500/20 hover:border-red-500/40 rounded-xl text-red-400 hover:text-red-300 text-xs font-semibold transition-smooth flex items-center gap-1.5 shadow-sm"
            title="Log out"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Logout
          </button>
        </div>
      </div>

      {/* Main Admin Panel Grid */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col lg:flex-row gap-6">
        {/* Left Side: Create User Form */}
        <div className="w-full lg:w-[350px] bg-[#1F2C33] rounded-2xl p-5 border border-[#2A3942]/10 flex flex-col shrink-0 self-start">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#00A884]">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="8.5" cy="7.5" r="4"/>
              <line x1="20" y1="8" x2="20" y2="14"/>
              <line x1="23" y1="11" x2="17" y2="11"/>
            </svg>
            Add New Staff Account
          </h3>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-[#00a884]/10 border border-[#00a884]/20 text-[#00a884] text-xs rounded-xl">
              {success}
            </div>
          )}

          <form onSubmit={handleCreateUser} className="flex flex-col gap-4">
            <div>
              <label className="block text-[11px] text-[#8696A0] font-medium mb-1.5 uppercase tracking-wide">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Doe"
                className="w-full bg-[#2A3942] border border-[#2A3942] rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#00A884] transition-smooth"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] text-[#8696A0] font-medium mb-1.5 uppercase tracking-wide">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. user@mypainclinic.com"
                className="w-full bg-[#2A3942] border border-[#2A3942] rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#00A884] transition-smooth"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] text-[#8696A0] font-medium mb-1.5 uppercase tracking-wide">Initial Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Must be at least 6 characters"
                className="w-full bg-[#2A3942] border border-[#2A3942] rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#00A884] transition-smooth"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] text-[#8696A0] font-medium mb-1.5 uppercase tracking-wide">System Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-[#2A3942] border border-[#2A3942] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#00A884] cursor-pointer"
              >
                <option value="agent">Agent (Standard Staff)</option>
                <option value="admin">Admin (System Manager)</option>
                <option value="super_admin">Super Admin (Full Access)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 w-full bg-[#00A884] hover:bg-[#008F70] disabled:opacity-50 text-[#111B21] text-xs font-semibold py-2.5 rounded-xl transition-smooth shadow-lg flex items-center justify-center gap-2"
            >
              {submitting ? (
                <span className="w-4 h-4 border-2 border-[#111B21]/30 border-t-[#111B21] rounded-full animate-spin" />
              ) : (
                'Create Account'
              )}
            </button>
          </form>
        </div>

        {/* Right Side: Manage Staff Directory */}
        <div className="flex-1 bg-[#1F2C33] rounded-2xl p-5 border border-[#2A3942]/10 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#00A884]">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              Staff Account Directory ({users.length})
            </h3>

            <button
              onClick={fetchUsers}
              className="text-xs text-[#00A884] hover:text-emerald-300 font-medium flex items-center gap-1"
            >
              Refresh List
            </button>
          </div>

          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 py-20 text-[#8696A0]">
              <span className="w-8 h-8 border-3 border-[#00A884]/30 border-t-[#00A884] rounded-full animate-spin" />
              <span className="text-xs">Loading directory...</span>
            </div>
          ) : (
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#2A3942]/30 text-[#8696A0] uppercase font-semibold text-[10px] tracking-wider">
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Email Address</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Date Joined</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isSelf = currentUser && (currentUser.id === u.id || currentUser.email === u.email);
                    return (
                      <tr key={u.id} className="border-b border-[#2A3942]/20 hover:bg-[#2A3942]/20 transition-smooth">
                        <td className="py-3 px-4 font-semibold text-white flex items-center gap-2">
                          <span>{u.name}</span>
                          {isSelf && (
                            <span className="bg-[#00A884]/20 text-[#00A884] text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">
                              You
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-300 font-mono text-[11px]">{u.email}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wide uppercase ${
                            u.role === 'super_admin'
                              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                              : u.role === 'admin'
                              ? 'bg-[#00a884]/15 text-[#00a884] border border-[#00a884]/20'
                              : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20'
                          }`}>
                            {u.role === 'super_admin' ? 'Super Admin' : u.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#8696A0]">
                          {new Date(u.createdAt).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(u)}
                              className="px-2.5 py-1.5 bg-[#00A884]/15 hover:bg-[#00A884]/25 text-[#00A884] border border-[#00A884]/30 rounded-lg transition-smooth flex items-center gap-1 font-medium text-[11px]"
                              title="Edit Email, Name & Password"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                              Edit Account
                            </button>

                            <button
                              type="button"
                              onClick={() => setSelectedUser(u)}
                              className="px-2.5 py-1.5 bg-[#2A3942] hover:bg-[#374248] text-gray-300 hover:text-white rounded-lg transition-smooth flex items-center gap-1 font-medium text-[11px]"
                              title="Reset Password"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                              </svg>
                              Reset PW
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit Account Modal (Email, Password, Name, Role) */}
      {editingUser && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1F2C33] rounded-2xl w-full max-w-md border border-[#2A3942]/40 shadow-2xl overflow-hidden animate-scale-up">
            <div className="px-5 py-4 bg-[#202C33] border-b border-[#2A3942]/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#00A884]">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                <h4 className="font-semibold text-white text-sm">
                  Edit Account: <span className="text-[#00A884]">{editingUser.name}</span>
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-[#AEBAC1] hover:text-white transition-smooth"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="p-5 flex flex-col gap-4">
              {editError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl">
                  {editError}
                </div>
              )}
              {editSuccess && (
                <div className="p-3 bg-[#00a884]/10 border border-[#00a884]/20 text-[#00a884] text-xs rounded-xl font-medium">
                  {editSuccess}
                </div>
              )}

              <div>
                <label className="block text-[11px] text-[#8696A0] font-medium mb-1.5 uppercase tracking-wide">
                  Full Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#2A3942] border border-[#2A3942] rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#00A884] transition-smooth"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#8696A0] font-medium mb-1.5 uppercase tracking-wide">
                  Email Address
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full bg-[#2A3942] border border-[#2A3942] rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#00A884] transition-smooth font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#8696A0] font-medium mb-1.5 uppercase tracking-wide">
                  Change Password <span className="text-gray-500 normal-case font-normal">(Leave blank to keep unchanged)</span>
                </label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Enter new password (min. 6 characters)"
                  className="w-full bg-[#2A3942] border border-[#2A3942] rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#00A884] transition-smooth"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#8696A0] font-medium mb-1.5 uppercase tracking-wide">
                  Account Role
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full bg-[#2A3942] border border-[#2A3942] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#00A884] cursor-pointer"
                >
                  <option value="agent">Agent (Standard Staff)</option>
                  <option value="admin">Admin (Clinic Manager)</option>
                  <option value="super_admin">Super Admin (Full Access)</option>
                </select>
              </div>

              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 bg-[#2A3942] hover:bg-[#374248] text-white text-xs font-semibold py-2.5 rounded-xl transition-smooth"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="flex-1 bg-[#00A884] hover:bg-[#008F70] disabled:opacity-50 text-[#111B21] text-xs font-semibold py-2.5 rounded-xl transition-smooth shadow-lg flex items-center justify-center gap-1.5"
                >
                  {editSubmitting ? (
                    <span className="w-4 h-4 border-2 border-[#111B21]/30 border-t-[#111B21] rounded-full animate-spin" />
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Password Reset Dialog */}
      {selectedUser && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1F2C33] rounded-2xl w-full max-w-sm border border-[#2A3942]/30 shadow-2xl overflow-hidden animate-scale-up">
            <div className="px-5 py-4 bg-[#202C33] border-b border-[#2A3942]/30 flex items-center justify-between">
              <h4 className="font-semibold text-white text-sm">Quick Reset Password</h4>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="text-[#AEBAC1] hover:text-white transition-smooth"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="p-5 flex flex-col gap-4">
              <div className="p-3 bg-[#111B21]/50 rounded-xl border border-[#2A3942]/20">
                <span className="text-[10px] text-[#8696A0] block uppercase tracking-wide font-medium">User Profile</span>
                <span className="text-xs font-bold text-white block mt-0.5">{selectedUser.name}</span>
                <span className="text-[11px] text-gray-400 block mt-0.5 font-mono">{selectedUser.email}</span>
              </div>

              {pwError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl">
                  {pwError}
                </div>
              )}
              {pwSuccess && (
                <div className="p-3 bg-[#00a884]/10 border border-[#00a884]/20 text-[#00a884] text-xs rounded-xl">
                  {pwSuccess}
                </div>
              )}

              <div>
                <label className="block text-[11px] text-[#8696A0] font-medium mb-1.5 uppercase tracking-wide">New Secure Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Must be at least 6 characters"
                  className="w-full bg-[#2A3942] border border-[#2A3942] rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#00A884] transition-smooth"
                  required
                  autoFocus
                />
              </div>

              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="flex-1 bg-[#2A3942] hover:bg-[#374248] text-white text-xs font-semibold py-2.5 rounded-xl transition-smooth"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pwSubmitting}
                  className="flex-1 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-[#111B21] text-xs font-semibold py-2.5 rounded-xl transition-smooth shadow-lg flex items-center justify-center gap-1.5"
                >
                  {pwSubmitting ? (
                    <span className="w-4 h-4 border-2 border-[#111B21]/30 border-t-[#111B21] rounded-full animate-spin" />
                  ) : (
                    'Reset Password'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
