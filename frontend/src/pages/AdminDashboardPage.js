import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Axios instance with admin token
const adminApi = axios.create({ baseURL: API_BASE });
adminApi.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('admin_access_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// ─── Small reusable components ──────────────────────────────────────────────

function StatCard({ label, value, color = 'blue', icon }) {
  const colors = {
    blue: 'bg-blue-900/40 border-blue-700 text-blue-400',
    red: 'bg-red-900/40 border-red-700 text-red-400',
    green: 'bg-green-900/40 border-green-700 text-green-400',
    yellow: 'bg-yellow-900/40 border-yellow-700 text-yellow-400',
  };
  return (
    <div className={`rounded-xl border p-5 ${colors[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</span>
        {icon}
      </div>
      <div className="text-3xl font-bold text-white">{value ?? '—'}</div>
    </div>
  );
}

function Badge({ text, color = 'gray' }) {
  const map = {
    gray: 'bg-gray-700 text-gray-300',
    red: 'bg-red-900 text-red-300',
    green: 'bg-green-900 text-green-300',
    yellow: 'bg-yellow-900 text-yellow-300',
    blue: 'bg-blue-900 text-blue-300',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${map[color]}`}>
      {text}
    </span>
  );
}

function ConfirmButton({ label, onClick, color = 'red', small = false }) {
  const base = small ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm';
  const c = color === 'red'
    ? 'bg-red-700 hover:bg-red-600 text-white'
    : color === 'green'
    ? 'bg-green-700 hover:bg-green-600 text-white'
    : 'bg-gray-700 hover:bg-gray-600 text-white';
  return (
    <button onClick={onClick} className={`${base} ${c} rounded-lg font-medium transition`}>
      {label}
    </button>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────

const TABS = ['Overview', 'Users', 'Teachers', 'Marketplace', 'Notes'];

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const adminName = localStorage.getItem('admin_name') || 'Admin';
  const [activeTab, setActiveTab] = useState('Overview');

  // Stats
  const [stats, setStats] = useState(null);

  // Users tab
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [usersTotal, setUsersTotal] = useState(0);
  const [banModal, setBanModal] = useState(null); // { userId, name }
  const [banReason, setBanReason] = useState('');

  // Teachers tab
  const [teachers, setTeachers] = useState([]);
  const [teacherFilter, setTeacherFilter] = useState('pending');

  // Marketplace tab
  const [marketNotes, setMarketNotes] = useState([]);

  // Notes tab
  const [userNotes, setUserNotes] = useState([]);

  // ── Fetch helpers ────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    try {
      const res = await adminApi.get('/admin/stats');
      setStats(res.data);
    } catch {
      toast.error('Failed to load stats');
    }
  }, []);

  const fetchUsers = useCallback(async (search = '') => {
    try {
      const params = search ? { search } : {};
      const res = await adminApi.get('/admin/users', { params: { ...params, limit: 100 } });
      setUsers(res.data.users);
      setUsersTotal(res.data.total);
    } catch {
      toast.error('Failed to load users');
    }
  }, []);

  const fetchTeachers = useCallback(async (statusFilter = 'pending') => {
    try {
      const res = await adminApi.get('/admin/teachers/all', { params: { status_filter: statusFilter, limit: 100 } });
      setTeachers(res.data.profiles);
    } catch {
      toast.error('Failed to load teachers');
    }
  }, []);

  const fetchMarketNotes = useCallback(async () => {
    try {
      const res = await adminApi.get('/admin/content/marketplace', { params: { limit: 100 } });
      setMarketNotes(res.data.notes);
    } catch {
      toast.error('Failed to load marketplace notes');
    }
  }, []);

  const fetchUserNotes = useCallback(async () => {
    try {
      const res = await adminApi.get('/admin/content/notes', { params: { limit: 100 } });
      setUserNotes(res.data.notes);
    } catch {
      toast.error('Failed to load notes');
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (activeTab === 'Users') fetchUsers(userSearch);
    if (activeTab === 'Teachers') fetchTeachers(teacherFilter);
    if (activeTab === 'Marketplace') fetchMarketNotes();
    if (activeTab === 'Notes') fetchUserNotes();
  }, [activeTab, teacherFilter, fetchUsers, fetchTeachers, fetchMarketNotes, fetchUserNotes, userSearch]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleBan = async () => {
    if (!banReason.trim()) { toast.error('Ban reason is required'); return; }
    try {
      await adminApi.post(`/admin/users/${banModal.userId}/ban`, { reason: banReason });
      toast.success(`${banModal.name} banned`);
      setBanModal(null); setBanReason('');
      fetchUsers(userSearch);
    } catch { toast.error('Failed to ban user'); }
  };

  const handleUnban = async (userId, name) => {
    try {
      await adminApi.post(`/admin/users/${userId}/unban`);
      toast.success(`${name} unbanned`);
      fetchUsers(userSearch);
    } catch { toast.error('Failed to unban'); }
  };

  const handleDeleteUser = async (userId, name) => {
    if (!window.confirm(`Permanently delete ${name}? This cannot be undone.`)) return;
    try {
      await adminApi.delete(`/admin/users/${userId}`);
      toast.success(`${name} deleted`);
      fetchUsers(userSearch);
    } catch { toast.error('Failed to delete user'); }
  };

  const handleApproveTeacher = async (profileId, name) => {
    try {
      await adminApi.post(`/admin/teachers/${profileId}/approve`);
      toast.success(`${name} approved`);
      fetchTeachers(teacherFilter);
    } catch { toast.error('Failed to approve'); }
  };

  const handleRejectTeacher = async (profileId, name) => {
    const reason = window.prompt(`Rejection reason for ${name}:`);
    if (reason === null) return;
    try {
      await adminApi.post(`/admin/teachers/${profileId}/reject`, { reason });
      toast.success(`${name} rejected`);
      fetchTeachers(teacherFilter);
    } catch { toast.error('Failed to reject'); }
  };

  const handleDeleteMarketNote = async (noteId, title) => {
    if (!window.confirm(`Remove "${title}" from marketplace?`)) return;
    try {
      await adminApi.delete(`/admin/content/marketplace/${noteId}`);
      toast.success('Note removed');
      fetchMarketNotes();
    } catch { toast.error('Failed to remove note'); }
  };

  const handleDeleteNote = async (noteId, title) => {
    if (!window.confirm(`Delete note "${title}"?`)) return;
    try {
      await adminApi.delete(`/admin/content/notes/${noteId}`);
      toast.success('Note deleted');
      fetchUserNotes();
    } catch { toast.error('Failed to delete note'); }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_access_token');
    localStorage.removeItem('admin_refresh_token');
    localStorage.removeItem('admin_name');
    navigate('/admin/login');
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Top bar */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold leading-none">PeerLearn Admin</h1>
            <span className="text-xs text-gray-500">Superuser Dashboard</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">Signed in as <span className="text-white font-medium">{adminName}</span></span>
          <button
            onClick={handleLogout}
            className="text-sm bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav className="bg-gray-900 border-b border-gray-800 px-6 flex gap-1">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === tab
                ? 'border-red-500 text-red-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </nav>

      <main className="p-6 max-w-7xl mx-auto">

        {/* ── Overview ── */}
        {activeTab === 'Overview' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">Platform Overview</h2>
            {stats ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="Total Users" value={stats.users.total} color="blue" />
                  <StatCard label="Students" value={stats.users.students} color="green" />
                  <StatCard label="Teachers" value={stats.users.teachers} color="yellow" />
                  <StatCard label="Banned Accounts" value={stats.users.banned} color="red" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <StatCard label="Marketplace Notes" value={stats.content.marketplace_notes} color="blue" />
                  <StatCard label="User Notes" value={stats.content.notes} color="green" />
                  <StatCard label="Pending Teacher Approvals" value={stats.teachers.pending_approval} color="yellow" />
                </div>
              </>
            ) : (
              <div className="text-gray-500">Loading stats…</div>
            )}
          </div>
        )}

        {/* ── Users ── */}
        {activeTab === 'Users' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Users <span className="text-gray-500 text-base font-normal">({usersTotal})</span></h2>
              <input
                className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-sm text-white w-64
                           focus:outline-none focus:border-red-500"
                placeholder="Search by name or email…"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchUsers(userSearch)}
              />
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-800 text-gray-400">
                  <tr>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">Role</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Joined</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {users.map((u) => (
                    <tr key={u._id} className="hover:bg-gray-800/50">
                      <td className="px-4 py-3 font-medium">{u.name}</td>
                      <td className="px-4 py-3 text-gray-400">{u.email}</td>
                      <td className="px-4 py-3">
                        <Badge
                          text={u.role}
                          color={u.role === 'admin' ? 'red' : u.role === 'teacher' ? 'yellow' : 'blue'}
                        />
                      </td>
                      <td className="px-4 py-3">
                        {u.is_banned
                          ? <Badge text="banned" color="red" />
                          : u.is_verified
                          ? <Badge text="active" color="green" />
                          : <Badge text="unverified" color="gray" />
                        }
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        {u.role !== 'admin' && (
                          <>
                            {u.is_banned ? (
                              <ConfirmButton
                                label="Unban"
                                color="green"
                                small
                                onClick={() => handleUnban(u._id, u.name)}
                              />
                            ) : (
                              <ConfirmButton
                                label="Ban"
                                color="red"
                                small
                                onClick={() => { setBanModal({ userId: u._id, name: u.name }); setBanReason(''); }}
                              />
                            )}
                            <ConfirmButton
                              label="Delete"
                              color="gray"
                              small
                              onClick={() => handleDeleteUser(u._id, u.name)}
                            />
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No users found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Teachers ── */}
        {activeTab === 'Teachers' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Teacher Profiles</h2>
              <div className="flex gap-2">
                {['pending', 'approved', 'rejected'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setTeacherFilter(s)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                      teacherFilter === s
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4">
              {teachers.map((p) => (
                <div key={p._id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">
                        {p.user?.name || 'Unknown Teacher'}
                      </span>
                      <Badge
                        text={p.status}
                        color={p.status === 'approved' ? 'green' : p.status === 'rejected' ? 'red' : 'yellow'}
                      />
                    </div>
                    <p className="text-xs text-gray-400">{p.user?.email}</p>
                    {p.subjects && p.subjects.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">Subjects: {p.subjects.join(', ')}</p>
                    )}
                    {p.bio && <p className="text-sm text-gray-400 mt-2 line-clamp-2">{p.bio}</p>}
                    {p.rejection_reason && (
                      <p className="text-xs text-red-400 mt-1">Rejected: {p.rejection_reason}</p>
                    )}
                  </div>
                  {p.status === 'pending' && (
                    <div className="flex gap-2 shrink-0">
                      <ConfirmButton
                        label="Approve"
                        color="green"
                        onClick={() => handleApproveTeacher(p._id, p.user?.name || p._id)}
                      />
                      <ConfirmButton
                        label="Reject"
                        color="red"
                        onClick={() => handleRejectTeacher(p._id, p.user?.name || p._id)}
                      />
                    </div>
                  )}
                </div>
              ))}
              {teachers.length === 0 && (
                <div className="text-center text-gray-500 py-12">No {teacherFilter} teachers</div>
              )}
            </div>
          </div>
        )}

        {/* ── Marketplace ── */}
        {activeTab === 'Marketplace' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Marketplace Notes <span className="text-gray-500 text-base font-normal">({marketNotes.length})</span></h2>
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-800 text-gray-400">
                  <tr>
                    <th className="px-4 py-3 text-left">Title</th>
                    <th className="px-4 py-3 text-left">Seller</th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-left">Price</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {marketNotes.map((n) => (
                    <tr key={n._id} className="hover:bg-gray-800/50">
                      <td className="px-4 py-3 font-medium">{n.title}</td>
                      <td className="px-4 py-3 text-gray-400">{n.seller?.name || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge text={n.category || 'other'} color="blue" />
                      </td>
                      <td className="px-4 py-3">
                        {n.is_free ? <Badge text="Free" color="green" /> : `${n.price} pts`}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ConfirmButton
                          label="Remove"
                          color="red"
                          small
                          onClick={() => handleDeleteMarketNote(n._id, n.title)}
                        />
                      </td>
                    </tr>
                  ))}
                  {marketNotes.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No marketplace notes</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Notes ── */}
        {activeTab === 'Notes' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">User Notes <span className="text-gray-500 text-base font-normal">({userNotes.length})</span></h2>
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-800 text-gray-400">
                  <tr>
                    <th className="px-4 py-3 text-left">Title</th>
                    <th className="px-4 py-3 text-left">Owner</th>
                    <th className="px-4 py-3 text-left">Created</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {userNotes.map((n) => (
                    <tr key={n._id} className="hover:bg-gray-800/50">
                      <td className="px-4 py-3 font-medium">{n.title || 'Untitled'}</td>
                      <td className="px-4 py-3 text-gray-400">{n.owner?.name || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {n.created_at ? new Date(n.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ConfirmButton
                          label="Delete"
                          color="red"
                          small
                          onClick={() => handleDeleteNote(n._id, n.title || 'Untitled')}
                        />
                      </td>
                    </tr>
                  ))}
                  {userNotes.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No notes</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ── Ban Modal ── */}
      {banModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold mb-1">Ban User</h3>
            <p className="text-gray-400 text-sm mb-4">
              You are about to ban <span className="text-white font-medium">{banModal.name}</span>.
              Provide a reason (visible to the user).
            </p>
            <textarea
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white
                         focus:outline-none focus:border-red-500 resize-none"
              rows={3}
              placeholder="e.g. Violation of community guidelines…"
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
            />
            <div className="flex gap-3 mt-4 justify-end">
              <button
                onClick={() => setBanModal(null)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition"
              >
                Cancel
              </button>
              <button
                onClick={handleBan}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition"
              >
                Confirm Ban
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
