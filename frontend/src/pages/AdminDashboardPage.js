import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Shield, LayoutDashboard, GraduationCap, Users, FileText, ShoppingBag, Star, LogOut, BookOpen, ChevronRight, X, Trash2 } from 'lucide-react';

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

const TABS = ['Overview', 'Users', 'Teachers', 'Marketplace', 'Notes', 'Reviews'];

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const adminName = localStorage.getItem('admin_name') || 'Admin';
  const [activeTab, setActiveTab] = useState('overview');

  // Stats
  const [stats, setStats] = useState(null);

  // Users tab
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [usersTotal, setUsersTotal] = useState(0);
  const [banModal, setBanModal] = useState(null);
  const [banReason, setBanReason] = useState('');

  // Students tab
  const [studentFilter, setStudentFilter] = useState('All');
  const [studentSearch, setStudentSearch] = useState('');
  const [banModalOpen, setBanModalOpen] = useState(false);
  const [banningUser, setBanningUser] = useState(null);

  // Content/Reviews sub-tab
  const [contentSubTab, setContentSubTab] = useState('notes');

  // Teachers tab
  const [teachers, setTeachers] = useState([]);
  const [teacherFilter, setTeacherFilter] = useState('All');
  const [teacherSearch, setTeacherSearch] = useState('');
  const [teacherSort, setTeacherSort] = useState('newest');
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingTeacher, setRejectingTeacher] = useState(null);
  const [teacherSubTab, setTeacherSubTab] = useState('list');   // 'list' | 'reviews'
  const [reviewSearch, setReviewSearch] = useState('');

  // Marketplace tab
  const [marketNotes, setMarketNotes] = useState([]);

  // Notes tab
  const [userNotes, setUserNotes] = useState([]);

  // Reviews tab
  const [reviews, setReviews] = useState([]);

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

  const fetchTeachers = useCallback(async () => {
    try {
      // Fetch ALL teachers — client-side filter tabs handle status filtering
      const res = await adminApi.get('/admin/teachers/all', { params: { limit: 100 } });
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

  const fetchReviews = useCallback(async () => {
    try {
      const res = await adminApi.get('/admin/content/reviews', { params: { limit: 100 } });
      setReviews(res.data.reviews);
    } catch {
      toast.error('Failed to load reviews');
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchTeachers(); // needed for Overview charts and sidebar badge
  }, [fetchStats, fetchTeachers]);

  useEffect(() => {
    if (activeTab === 'students') fetchUsers(userSearch);
    if (activeTab === 'teachers') fetchTeachers();
    if (activeTab === 'marketplace') fetchMarketNotes();
    if (activeTab === 'content') { fetchUserNotes(); fetchReviews(); }
    // Reviews nav item redirects to content tab, reviews sub-tab
    if (activeTab === 'reviews') {
      setActiveTab('content');
      setContentSubTab('reviews');
      fetchReviews();
    }
  }, [activeTab, teacherFilter, fetchUsers, fetchTeachers, fetchMarketNotes, fetchUserNotes, fetchReviews, userSearch]);

  // ── Actions ──────────────────────────────────────────────────────────────

  // Ban accepts (userId, reason) directly — modal owns state management
  const handleBan = async (userId, reason) => {
    if (!reason || !reason.trim()) { toast.error('Ban reason is required'); return; }
    try {
      await adminApi.post(`/admin/users/${userId}/ban`, { reason });
      toast.success('User banned');
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

  const handleApproveTeacher = async (profileId, nameOrUndef) => {
    try {
      await adminApi.post(`/admin/teachers/${profileId}/approve`);
      const label = nameOrUndef || selectedTeacher?.user?.name || 'Teacher';
      toast.success(`${label} approved as teacher`);
      setSelectedTeacher(null);
      fetchTeachers();
    } catch { toast.error('Failed to approve'); }
  };

  // Accepts reason directly — rejection modal handles the UX
  const handleRejectTeacher = async (profileId, reason) => {
    try {
      await adminApi.post(`/admin/teachers/${profileId}/reject`, { reason });
      toast.success('Teacher application rejected');
      setSelectedTeacher(null);
      fetchTeachers();
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

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm('Remove this review? This cannot be undone.')) return;
    try {
      await adminApi.delete(`/admin/content/reviews/${reviewId}`);
      toast.success('Review removed');
      fetchReviews();
    } catch { toast.error('Failed to remove review'); }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_access_token');
    localStorage.removeItem('admin_refresh_token');
    localStorage.removeItem('admin_name');
    navigate('/admin/login');
  };

  // ── Inline tab components ────────────────────────────────────────────────────

  // ── DonutChart (SVG, no deps) ────────────────────────────────────────────────
  const DonutChart = ({ segments, size = 130, strokeWidth = 20 }) => {
    const r = (size - strokeWidth) / 2;
    const circ = 2 * Math.PI * r;
    const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
    let cumPct = 0;
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
        {/* Track */}
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
        {segments.map((seg, i) => {
          const pct = seg.value / total;
          const dash = pct * circ;
          const gap  = circ - dash;
          const rotDeg = cumPct * 360 - 90;
          cumPct += pct;
          return (
            <circle key={i}
              cx={size/2} cy={size/2} r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dash} ${gap}`}
              strokeLinecap="butt"
              transform={`rotate(${rotDeg}, ${size/2}, ${size/2})`}
            />
          );
        })}
      </svg>
    );
  };

  // ── HorizontalBarChart (labels on left, bars on right — no label overlap) ────
  const HBarChart = ({ bars }) => {
    const max = Math.max(...bars.map(b => b.value), 1);
    const barH = 22;
    const gap  = 10;
    const labelW = 88;
    const chartW = 180;
    const totalH = bars.length * (barH + gap) - gap;
    return (
      <svg width={labelW + chartW + 40} height={totalH} style={{ overflow: 'visible', display: 'block' }}>
        {bars.map((bar, i) => {
          const bw = (bar.value / max) * chartW;
          const y = i * (barH + gap);
          return (
            <g key={i}>
              {/* Label */}
              <text x={labelW - 8} y={y + barH / 2 + 4} textAnchor="end" fontSize={11} fill="#6b7280" fontFamily="inherit">
                {bar.label}
              </text>
              {/* Track */}
              <rect x={labelW} y={y} width={chartW} height={barH} rx={6} fill="#f1f5f9" />
              {/* Bar */}
              {bw > 0 && (
                <rect x={labelW} y={y} width={bw} height={barH} rx={6} fill={bar.color} opacity={0.88} />
              )}
              {/* Value */}
              <text x={labelW + bw + 6} y={y + barH / 2 + 4} textAnchor="start" fontSize={11} fill="#374151" fontWeight="700" fontFamily="inherit">
                {bar.value}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  const OverviewTab = () => {
    const totalUsers = (stats?.users?.students ?? 0) + (stats?.users?.teachers ?? 0);
    const bannedUsers = stats?.users?.banned ?? 0;
    const pendingT  = teachers.filter(t => t.status === 'pending').length;
    const approvedT = teachers.filter(t => t.status === 'approved').length;
    const rejectedT = teachers.filter(t => t.status === 'rejected').length;

    const userSegments = [
      { label: 'Students', value: stats?.users?.students ?? 0, color: '#6366f1' },
      { label: 'Teachers', value: stats?.users?.teachers ?? 0, color: '#10b981' },
      { label: 'Banned',   value: bannedUsers,                  color: '#f43f5e' },
    ].filter(s => s.value > 0);

    const teacherSegments = [
      { label: 'Approved', value: approvedT, color: '#10b981' },
      { label: 'Pending',  value: pendingT,  color: '#f59e0b' },
      { label: 'Rejected', value: rejectedT, color: '#f43f5e' },
    ].filter(s => s.value > 0);

    const contentBars = [
      { label: 'Students',    value: stats?.users?.students ?? 0,             color: '#6366f1' },
      { label: 'Teachers',    value: stats?.users?.teachers ?? 0,             color: '#10b981' },
      { label: 'Documents',   value: stats?.content?.notes ?? 0,              color: '#8b5cf6' },
      { label: 'Marketplace', value: stats?.content?.marketplace_notes ?? 0,  color: '#f59e0b' },
      { label: 'Hire Reqs',   value: stats?.hire_requests?.total ?? 0,        color: '#3b82f6' },
    ];

    const statCards = [
      { label: 'Total Students',  value: stats?.users?.students ?? 0,            icon: Users,        color: '#6366f1', bg: '#eef2ff', sub: 'registered learners' },
      { label: 'Total Teachers',  value: stats?.users?.teachers ?? 0,            icon: GraduationCap,color: '#10b981', bg: '#ecfdf5', sub: `${pendingT} pending` },
      { label: 'Documents',       value: stats?.content?.notes ?? 0,             icon: FileText,     color: '#8b5cf6', bg: '#f5f3ff', sub: 'notes created' },
      { label: 'Marketplace',     value: stats?.content?.marketplace_notes ?? 0, icon: BookOpen,     color: '#f59e0b', bg: '#fffbeb', sub: 'for sale' },
    ];

    return (
      <div className="space-y-6">

        {/* ── KPI Stat Cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-5">
          {statCards.map(card => (
            <div key={card.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center space-x-4 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: card.bg }}>
                <card.icon className="h-6 w-6" style={{ color: card.color }} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{card.label}</p>
                <p className="text-2xl font-extrabold text-gray-900 leading-tight">{card.value.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Charts Row ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-5 gap-5">

          {/* User Breakdown donut */}
          <div className="col-span-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">User Breakdown</p>
            <div className="flex flex-col items-center">
              <div className="relative">
                <DonutChart
                  segments={userSegments.length ? userSegments : [{ label: 'None', value: 1, color: '#e2e8f0' }]}
                  size={130} strokeWidth={20}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-extrabold text-gray-900">{totalUsers}</span>
                  <span className="text-[10px] text-gray-400 -mt-1">users</span>
                </div>
              </div>
              <div className="w-full mt-4 space-y-2">
                {[
                  { label: 'Students', value: stats?.users?.students ?? 0, color: '#6366f1' },
                  { label: 'Teachers', value: stats?.users?.teachers ?? 0, color: '#10b981' },
                  { label: 'Banned',   value: bannedUsers,                  color: '#f43f5e' },
                ].map(s => (
                  <div key={s.label} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="text-xs text-gray-500">{s.label}</span>
                    </div>
                    <span className="text-xs font-bold text-gray-800">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Teacher Status donut */}
          <div className="col-span-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Teacher Status</p>
            <div className="flex flex-col items-center">
              <div className="relative">
                <DonutChart
                  segments={teacherSegments.length ? teacherSegments : [{ label: 'None', value: 1, color: '#e2e8f0' }]}
                  size={130} strokeWidth={20}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-extrabold text-gray-900">{approvedT + pendingT + rejectedT}</span>
                  <span className="text-[10px] text-gray-400 -mt-1">total</span>
                </div>
              </div>
              <div className="w-full mt-4 space-y-2">
                {[
                  { label: 'Approved', value: approvedT, color: '#10b981' },
                  { label: 'Pending',  value: pendingT,  color: '#f59e0b' },
                  { label: 'Rejected', value: rejectedT, color: '#f43f5e' },
                ].map(s => (
                  <div key={s.label} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="text-xs text-gray-500">{s.label}</span>
                    </div>
                    <span className="text-xs font-bold text-gray-800">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Horizontal Bar chart — Platform Content */}
          <div className="col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-5">Platform Activity</p>
            <div className="space-y-3">
              {contentBars.map(bar => {
                const max = Math.max(...contentBars.map(b => b.value), 1);
                const pct = (bar.value / max) * 100;
                return (
                  <div key={bar.label} className="flex items-center space-x-3">
                    <span className="text-xs text-gray-500 w-24 text-right flex-shrink-0">{bar.label}</span>
                    <div className="flex-1 h-6 bg-gray-100 rounded-lg overflow-hidden">
                      <div
                        className="h-full rounded-lg transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: bar.color, minWidth: bar.value > 0 ? '24px' : '0' }}
                      />
                    </div>
                    <span className="text-xs font-bold text-gray-700 w-6 text-right flex-shrink-0">{bar.value}</span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* ── Recent Teacher Applications ──────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Recent Teacher Applications</h2>
              <p className="text-xs text-gray-400 mt-0.5">{pendingT} awaiting review</p>
            </div>
            <button onClick={() => setActiveTab('teachers')}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors">
              View all →
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {teachers.slice(0, 5).map(teacher => (
              <div key={teacher._id} className="px-6 py-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {(teacher.user?.name || teacher.full_name || 'T')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{teacher.user?.name || teacher.full_name || 'Unknown'}</p>
                    <p className="text-xs text-gray-400">{teacher.user?.email || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                    teacher.status === 'pending'            ? 'bg-amber-100 text-amber-700' :
                    teacher.status === 'approved'           ? 'bg-green-100 text-green-700' :
                    teacher.status === 'profile_incomplete' ? 'bg-blue-100 text-blue-700'  : 'bg-red-100 text-red-700'
                  }`}>
                    {teacher.status === 'profile_incomplete' ? 'Incomplete' : teacher.status}
                  </span>
                  <button
                    onClick={() => { setSelectedTeacher(teacher); setActiveTab('teachers'); }}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    Review →
                  </button>
                </div>
              </div>
            ))}
            {teachers.length === 0 && (
              <p className="px-6 py-10 text-center text-gray-400 text-sm">No teacher applications yet</p>
            )}
          </div>
        </div>

      </div>
    );
  };

  const TeachersTab = () => {
    const filtered = teachers
      .filter(t => teacherFilter === 'All' || t.status === teacherFilter.toLowerCase())
      .filter(t => {
        if (!teacherSearch) return true;
        const q = teacherSearch.toLowerCase();
        return (t.user?.name||'').toLowerCase().includes(q) || (t.user?.email||'').toLowerCase().includes(q);
      });

    const filteredReviews = reviews.filter(r => {
      if (!reviewSearch) return true;
      return (r.teacher_name || '').toLowerCase().includes(reviewSearch.toLowerCase());
    });

    // Group reviews by teacher name for display
    const teacherReviewGroups = {};
    filteredReviews.forEach(r => {
      const name = r.teacher_name || 'Unknown Teacher';
      if (!teacherReviewGroups[name]) teacherReviewGroups[name] = [];
      teacherReviewGroups[name].push(r);
    });

    return (
      <div className="space-y-4">

        {/* Sub-tab toggle: Applications vs Reviews */}
        <div className="flex items-center justify-between">
          <div className="flex bg-white border border-gray-200 rounded-xl p-1 gap-1 shadow-sm">
            <button
              onClick={() => setTeacherSubTab('list')}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${teacherSubTab === 'list' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              Applications
            </button>
            <button
              onClick={() => { setTeacherSubTab('reviews'); fetchReviews(); }}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${teacherSubTab === 'reviews' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              Reviews
              {reviews.length > 0 && <span className="ml-2 bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">{reviews.length}</span>}
            </button>
          </div>
        </div>

        {/* ── APPLICATIONS sub-tab ─────────────────────────────────────────── */}
        {teacherSubTab === 'list' && (
          <div className="flex gap-6">
            <div className={`${selectedTeacher ? 'w-[55%]' : 'w-full'} transition-all duration-300 flex-shrink-0`}>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
                    {['All','Pending','Approved','Rejected'].map(f => (
                      <button key={f} onClick={() => setTeacherFilter(f)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${teacherFilter===f?'bg-white text-gray-900 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>
                        {f} ({f==='All'?teachers.length:teachers.filter(t=>t.status===f.toLowerCase()).length})
                      </button>
                    ))}
                  </div>
                  <input value={teacherSearch} onChange={e=>setTeacherSearch(e.target.value)} placeholder="Search name or email..."
                    className="flex-1 min-w-48 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                  <select value={teacherSort} onChange={e=>setTeacherSort(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 focus:outline-none">
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                  </select>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Teacher</th>
                      {!selectedTeacher && <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Subjects</th>}
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Applied</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map(teacher => (
                      <tr key={teacher._id}
                        onClick={() => setSelectedTeacher(selectedTeacher?._id===teacher._id?null:teacher)}
                        className={`cursor-pointer transition-colors ${selectedTeacher?._id===teacher._id?'bg-blue-50':'hover:bg-gray-50'}`}>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-9 h-9 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                              {(teacher.user?.name||'T')[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{teacher.user?.name||'Unknown'}</p>
                              <p className="text-xs text-gray-400 truncate">{teacher.user?.email}</p>
                            </div>
                          </div>
                        </td>
                        {!selectedTeacher && <td className="px-4 py-4"><p className="text-sm text-gray-600 truncate max-w-32">{([...(teacher.areas_of_expertise||[]), ...(teacher.courses_offered||[])]).join(', ')||'-'}</p></td>}
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            teacher.status==='pending'?'bg-amber-100 text-amber-700':teacher.status==='approved'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${teacher.status==='pending'?'bg-amber-500':teacher.status==='approved'?'bg-green-500':'bg-red-500'}`} />
                            {teacher.status.charAt(0).toUpperCase()+teacher.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-4"><p className="text-xs text-gray-400">{teacher.updated_at?new Date(teacher.updated_at).toLocaleDateString():'—'}</p></td>
                        <td className="px-4 py-4">
                          <ChevronRight className={`h-4 w-4 text-gray-300 transition-transform ${selectedTeacher?._id===teacher._id?'rotate-90 text-blue-500':''}`} />
                        </td>
                      </tr>
                    ))}
                    {filtered.length===0 && <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400 text-sm">No teachers match your filters</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedTeacher && (
              <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-y-auto">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
                  <button onClick={() => setSelectedTeacher(null)} className="flex items-center space-x-1 text-sm text-gray-500 hover:text-gray-700">
                    <X className="h-4 w-4" /><span>Close</span>
                  </button>
                  {selectedTeacher.status==='pending' && (
                    <div className="flex items-center space-x-2">
                      <button onClick={() => { setRejectingTeacher(selectedTeacher); setShowRejectModal(true); }}
                        className="px-4 py-1.5 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">Reject</button>
                      <button onClick={() => handleApproveTeacher(selectedTeacher._id)}
                        className="px-4 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors">Approve</button>
                    </div>
                  )}
                  {selectedTeacher.status==='approved' && <span className="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">Approved</span>}
                  {selectedTeacher.status==='rejected' && <span className="inline-flex items-center px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">Rejected</span>}
                </div>
                <div className="p-6 space-y-5">
                  <div className="flex items-start space-x-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
                      {(selectedTeacher.user?.name||'T')[0].toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">{selectedTeacher.user?.name}</h2>
                      <p className="text-sm text-gray-500">{selectedTeacher.user?.email}</p>
                      <p className="text-xs text-gray-400 mt-1">Applied {selectedTeacher.updated_at?new Date(selectedTeacher.updated_at).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'}):'Unknown'}</p>
                    </div>
                  </div>
                  {[
                    { label: 'Bio', value: selectedTeacher.short_bio },
                    { label: 'Subjects', value: ([...(selectedTeacher.areas_of_expertise||[]), ...(selectedTeacher.courses_offered||[])]).join(', ') },
                    { label: 'Experience', value: selectedTeacher.years_of_experience != null ? `${selectedTeacher.years_of_experience} years` : null },
                    { label: 'Hourly Rate', value: selectedTeacher.hourly_rate ? `$${selectedTeacher.hourly_rate}/hour` : null },
                    { label: 'Education', value: (selectedTeacher.academic_degrees||[]).join(', ') },
                    { label: 'Qualifications', value: (selectedTeacher.certifications||[]).join(', ') },
                    { label: 'Teaching Style', value: selectedTeacher.teaching_style },
                    { label: 'Rejection Reason', value: selectedTeacher.rejection_reason, danger: true },
                  ].filter(item => {
                    if (!item.value && item.value !== 0) return false;
                    const v = String(item.value).trim();
                    if (!v || v === '0 years' || v === '$0/hour' || v === '0') return false;
                    return true;
                  }).map(item => (
                    <div key={item.label} className={`p-4 rounded-xl ${item.danger?'bg-red-50 border border-red-100':'bg-gray-50'}`}>
                      <p className={`text-xs font-semibold uppercase tracking-wider mb-1.5 ${item.danger?'text-red-500':'text-gray-400'}`}>{item.label}</p>
                      <p className={`text-sm leading-relaxed ${item.danger?'text-red-700':'text-gray-700'}`}>{item.value}</p>
                    </div>
                  ))}
                  {(() => {
                    const fields = [
                      selectedTeacher.short_bio,
                      (selectedTeacher.areas_of_expertise||[]).join(''),
                      (selectedTeacher.courses_offered||[]).join(''),
                      selectedTeacher.years_of_experience,
                      selectedTeacher.hourly_rate,
                    ];
                    const filled = fields.filter(f => f && String(f).trim() && String(f) !== '0').length;
                    return filled < 2 ? (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <p className="text-sm text-amber-700 font-medium">Profile not yet completed</p>
                        <p className="text-xs text-amber-600 mt-1">This teacher registered but has not filled in their full profile details yet.</p>
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── REVIEWS sub-tab ───────────────────────────────────────────────── */}
        {teacherSubTab === 'reviews' && (
          <div className="space-y-4">
            {/* Search bar */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    value={reviewSearch}
                    onChange={e => setReviewSearch(e.target.value)}
                    placeholder="Search by teacher name..."
                    className="w-full pl-10 pr-4 border border-gray-200 rounded-lg py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  />
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {filteredReviews.length} review{filteredReviews.length !== 1 ? 's' : ''} found
                </span>
              </div>
            </div>

            {/* Reviews grouped by teacher */}
            {Object.keys(teacherReviewGroups).length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-16 text-center">
                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Star className="h-7 w-7 text-gray-300" />
                </div>
                <p className="text-gray-500 font-medium">No reviews found</p>
                <p className="text-xs text-gray-400 mt-1">{reviewSearch ? 'Try a different teacher name' : 'No teacher reviews have been submitted yet'}</p>
              </div>
            ) : (
              Object.entries(teacherReviewGroups).map(([teacherName, teacherRevs]) => (
                <div key={teacherName} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  {/* Teacher header */}
                  <div className="px-6 py-3.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {teacherName[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{teacherName}</p>
                        <p className="text-xs text-gray-400">{teacherRevs.length} review{teacherRevs.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      {(() => {
                        const avg = teacherRevs.reduce((s, r) => s + (r.rating || 0), 0) / teacherRevs.length;
                        return (
                          <>
                            <span className="text-amber-500 text-sm font-bold">{avg.toFixed(1)}</span>
                            <Star className="h-4 w-4 text-amber-400" style={{ fill: '#fbbf24' }} />
                            <span className="text-xs text-gray-400 ml-1">avg</span>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                  {/* Review rows */}
                  <table className="w-full">
                    <thead><tr className="border-b border-gray-50">
                      <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-2.5">Reviewer</th>
                      <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-2.5">Rating</th>
                      <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-2.5">Comment</th>
                      <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-2.5">Date</th>
                      <th className="px-4 py-2.5"></th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {teacherRevs.map(review => (
                        <tr key={review._id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-3.5">
                            <div className="flex items-center space-x-2">
                              <div className="w-7 h-7 bg-gradient-to-br from-violet-400 to-violet-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                {(review.reviewer_name || 'S')[0].toUpperCase()}
                              </div>
                              <p className="text-sm font-medium text-gray-800">{review.reviewer_name || '—'}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center space-x-0.5">
                              {[1,2,3,4,5].map(s => (
                                <Star key={s} className="h-3.5 w-3.5" style={{ color: s<=(review.rating||0)?'#fbbf24':'#d1d5db', fill: s<=(review.rating||0)?'#fbbf24':'#d1d5db' }} />
                              ))}
                              <span className="ml-1.5 text-xs font-bold text-gray-700">{review.rating}/5</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="text-sm text-gray-600 max-w-xs truncate">{review.comment || <span className="text-gray-300 italic">No comment</span>}</p>
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="text-xs text-gray-400">{review.created_at ? new Date(review.created_at).toLocaleDateString() : '—'}</p>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <button
                              onClick={() => { if (window.confirm('Remove this review? This cannot be undone.')) handleDeleteReview(review._id); }}
                              className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                              <Trash2 className="h-3 w-3" />
                              <span>Remove</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </div>
        )}

        {/* Reject modal */}
        {showRejectModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Reject Application</h3>
              <p className="text-sm text-gray-500 mb-4">This reason will be emailed to {rejectingTeacher?.user?.name}.</p>
              <textarea value={rejectReason} onChange={e=>setRejectReason(e.target.value)}
                placeholder="Explain why the application is being rejected and what they can improve..."
                rows={4} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 resize-none" />
              <p className={`text-xs mt-1 ${rejectReason.trim().length<20?'text-red-400':'text-green-500'}`}>
                {rejectReason.trim().length}/20 minimum characters
              </p>
              <div className="flex items-center justify-end space-x-3 mt-4">
                <button onClick={() => { setShowRejectModal(false); setRejectReason(''); setRejectingTeacher(null); }}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
                <button disabled={rejectReason.trim().length<20}
                  onClick={() => { handleRejectTeacher(rejectingTeacher._id, rejectReason.trim()); setShowRejectModal(false); setRejectReason(''); setRejectingTeacher(null); }}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };


  const StudentsTab = () => {
    const studs = users.filter(u => u.role === 'student');
    const filtered = studs
      .filter(u => studentFilter === 'All' || (studentFilter === 'Banned' ? u.is_banned : !u.is_banned))
      .filter(u => {
        if (!studentSearch) return true;
        const q = studentSearch.toLowerCase();
        return (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
      });
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
              {['All', 'Active', 'Banned'].map(f => (
                <button key={f} onClick={() => setStudentFilter(f)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${studentFilter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {f} ({f === 'All' ? studs.length : f === 'Banned' ? studs.filter(u => u.is_banned).length : studs.filter(u => !u.is_banned).length})
                </button>
              ))}
            </div>
            <input value={studentSearch} onChange={e => setStudentSearch(e.target.value)} placeholder="Search by name or email..."
              className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead><tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Student</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Joined</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(student => (
                <tr key={student._id} className={`transition-colors ${student.is_banned ? 'bg-red-50/50' : 'hover:bg-gray-50'}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${student.is_banned ? 'bg-red-400' : 'bg-gradient-to-br from-indigo-400 to-indigo-600'}`}>
                        {(student.name || 'S')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{student.name}</p>
                        <p className="text-xs text-gray-400 truncate">{student.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4"><p className="text-xs text-gray-400">{student.created_at ? new Date(student.created_at).toLocaleDateString() : '—'}</p></td>
                  <td className="px-4 py-4">
                    {student.is_banned ? (
                      <div>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5" />Banned
                        </span>
                        {student.ban_reason && <p className="text-xs text-red-400 mt-1 max-w-48 truncate">{student.ban_reason}</p>}
                      </div>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5" />Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center space-x-2">
                      {student.is_banned ? (
                        <button onClick={() => handleUnban(student._id)}
                          className="px-3 py-1.5 text-xs font-medium text-green-700 border border-green-200 rounded-lg hover:bg-green-50 transition-colors">Unban</button>
                      ) : (
                        <button onClick={() => { setBanningUser(student); setBanModalOpen(true); }}
                          className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">Ban</button>
                      )}
                      <button onClick={() => { if (window.confirm(`Delete ${student.name}? Cannot be undone.`)) handleDeleteUser(student._id, student.name); }}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-400 text-sm">No students match your filters</td></tr>}
            </tbody>
          </table>
        </div>
        {banModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Ban {banningUser?.name}?</h3>
              <p className="text-sm text-gray-500 mb-4">This user will immediately lose access to the platform.</p>
              <textarea value={banReason} onChange={e => setBanReason(e.target.value)}
                placeholder="Reason for ban..." rows={3}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 resize-none" />
              <div className="flex items-center justify-end space-x-3 mt-4">
                <button onClick={() => { setBanModalOpen(false); setBanReason(''); setBanningUser(null); }}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
                <button disabled={!banReason.trim()}
                  onClick={() => { handleBan(banningUser._id, banReason.trim()); setBanModalOpen(false); setBanReason(''); setBanningUser(null); }}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  Confirm Ban
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const ContentTab = () => (
    <div className="space-y-4">
      <div className="flex bg-gray-100 rounded-lg p-1 gap-1 w-fit">
        {[{ id: 'notes', label: 'Documents' }, { id: 'reviews', label: 'Reviews' }].map(t => (
          <button key={t.id} onClick={() => setContentSubTab(t.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${contentSubTab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {contentSubTab === 'notes' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead><tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Document</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Owner</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Created</th>
              <th className="px-4 py-3"></th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {userNotes.map(note => (
                <tr key={note._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="h-4 w-4 text-purple-600" />
                      </div>
                      <p className="text-sm font-medium text-gray-900 truncate max-w-64">{note.title || 'Untitled'}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4"><p className="text-sm text-gray-600">{note.owner_name || note.user_name || '—'}</p></td>
                  <td className="px-4 py-4"><p className="text-xs text-gray-400">{note.created_at ? new Date(note.created_at).toLocaleDateString() : '—'}</p></td>
                  <td className="px-4 py-4 text-right">
                    <button onClick={() => { if (window.confirm('Delete this document?')) handleDeleteNote(note._id, note.title); }}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {userNotes.length === 0 && <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-400 text-sm">No documents found</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {contentSubTab === 'reviews' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead><tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Reviewer</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Teacher</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Rating</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Comment</th>
              <th className="px-4 py-3"></th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {reviews.map(review => (
                <tr key={review._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4"><p className="text-sm font-medium text-gray-900">{review.reviewer_name || '—'}</p></td>
                  <td className="px-4 py-4"><p className="text-sm text-gray-600">{review.teacher_name || '—'}</p></td>
                  <td className="px-4 py-4">
                    <div className="flex items-center space-x-0.5">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} className="h-3.5 w-3.5" style={{ color: s<=(review.rating||0)?'#fbbf24':'#e5e7eb', fill: s<=(review.rating||0)?'#fbbf24':'#e5e7eb' }} />
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-4"><p className="text-sm text-gray-600 truncate max-w-48">{review.comment || '—'}</p></td>
                  <td className="px-4 py-4 text-right">
                    <button onClick={() => { if (window.confirm('Remove this review?')) handleDeleteReview(review._id); }}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {reviews.length === 0 && <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400 text-sm">No reviews found</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const MarketplaceTab = () => (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">Marketplace Listings</h2>
        <p className="text-sm text-gray-500 mt-0.5">{marketNotes.length} total listings</p>
      </div>
      <table className="w-full">
        <thead><tr className="bg-gray-50 border-b border-gray-100">
          <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Listing</th>
          <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Seller</th>
          <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Category</th>
          <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Price</th>
          <th className="px-4 py-3"></th>
        </tr></thead>
        <tbody className="divide-y divide-gray-50">
          {marketNotes.map(item => (
            <tr key={item._id} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <ShoppingBag className="h-4 w-4 text-amber-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate max-w-56">{item.title || 'Untitled'}</p>
                </div>
              </td>
              <td className="px-4 py-4"><p className="text-sm text-gray-600">{item.seller_name || '—'}</p></td>
              <td className="px-4 py-4">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{item.category || 'General'}</span>
              </td>
              <td className="px-4 py-4">
                <span className="text-sm font-semibold text-gray-900">{item.price || 0} <span className="text-xs text-gray-400 font-normal">credits</span></span>
              </td>
              <td className="px-4 py-4 text-right">
                <button onClick={() => { if (window.confirm('Remove this listing?')) handleDeleteMarketNote(item._id, item.title); }}
                  className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">Remove</button>
              </td>
            </tr>
          ))}
          {marketNotes.length === 0 && <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400 text-sm">No marketplace listings found</td></tr>}
        </tbody>
      </table>
    </div>
  );

  // ── Layout constants ─────────────────────────────────────────────────────────

  const tabTitles = {
    overview: 'Dashboard Overview',
    teachers: 'Teacher Management',
    students: 'Student Management',
    content: 'Content Moderation',
    marketplace: 'Marketplace',
    reviews: 'Reviews',
  };

  const tabSubtitles = {
    overview: 'Platform statistics and recent activity',
    teachers: 'Review and approve teacher applications',
    students: 'Manage student accounts',
    content: 'Moderate notes and documents',
    marketplace: 'Manage marketplace listings',
    reviews: 'Moderate teacher reviews',
  };

  const pendingTeachersCount = teachers.filter(t => t.status === 'pending').length;

  const navItems = [
    { id: 'overview',     label: 'Overview',     icon: LayoutDashboard },
    { id: 'teachers',     label: 'Teachers',     icon: GraduationCap,  badge: pendingTeachersCount },
    { id: 'students',     label: 'Students',     icon: Users },
    { id: 'content',      label: 'Content',      icon: FileText },
    { id: 'marketplace',  label: 'Marketplace',  icon: ShoppingBag },
  ];

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* SIDEBAR */}
      <aside className="w-60 bg-gray-900 flex flex-col flex-shrink-0">

        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">PeerLearn</p>
              <p className="text-gray-400 text-xs">Admin Panel</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                activeTab === item.id
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center space-x-3">
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </div>
              {item.badge > 0 && (
                <span className="bg-amber-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">A</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{adminName}</p>
              <p className="text-gray-500 text-xs">Super Admin</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-2 px-3 py-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg text-sm transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{tabTitles[activeTab]}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{tabSubtitles[activeTab]}</p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 text-sm text-green-600 bg-green-50 px-3 py-1.5 rounded-full border border-green-200">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              <span>System online</span>
            </div>
          </div>
        </header>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'teachers' && <TeachersTab />}
          {activeTab === 'students' && <StudentsTab />}
          {activeTab === 'content' && <ContentTab />}
          {activeTab === 'marketplace' && <MarketplaceTab />}
        </div>
      </main>
    </div>
  );
}
