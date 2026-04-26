import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Clock, XCircle, Play, FileText, Plus, Trash2, Star, Gift, Loader2, ExternalLink } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

export default function TeacherDashboardPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [requests, setRequests] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [myReviews, setMyReviews] = useState([]);

  // Free materials state
  const [newMaterial, setNewMaterial] = useState({ title: '', type: 'video_link', url: '', description: '' });
  const [addingMaterial, setAddingMaterial] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const profileRes = await api.get('/teachers/profile');
      setProfile(profileRes.data);

      // Only fetch analytics/requests/sessions if approved
      if (profileRes.data?.status === 'approved') {
        const [analyticsRes, requestsRes, sessionsRes, reviewsRes] = await Promise.all([
          api.get('/teachers/dashboard/analytics'),
          api.get('/teachers/hire/requests/received'),
          api.get('/teachers/sessions/my-sessions'),
          api.get('/teachers/profile/my-reviews'),
        ]);
        setAnalytics(analyticsRes.data);
        setRequests(requestsRes.data);
        setSessions(sessionsRes.data);
        setMyReviews(reviewsRes.data);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAction = async (requestId, action) => {
    try {
      await api.put(`/teachers/hire/requests/${requestId}`, { status: action });
      fetchDashboardData();
    } catch (error) {
      console.error('Failed to update request:', error);
    }
  };

  const handleAddMaterial = async () => {
    if (!newMaterial.title.trim() || !newMaterial.url.trim()) return;
    setAddingMaterial(true);
    try {
      const res = await api.post('/teachers/profile/materials', newMaterial);
      setProfile(prev => ({ ...prev, free_materials: res.data.free_materials }));
      setNewMaterial({ title: '', type: 'video_link', url: '', description: '' });
    } catch (err) {
      console.error('Failed to add material:', err);
    } finally {
      setAddingMaterial(false);
    }
  };

  const handleRemoveMaterial = async (index) => {
    if (!window.confirm('Remove this resource?')) return;
    try {
      const res = await api.delete(`/teachers/profile/materials/${index}`);
      setProfile(prev => ({ ...prev, free_materials: res.data.free_materials }));
    } catch (err) {
      console.error('Failed to remove material:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-500">Loading...</div>
      </div>
    );
  }

  // ── Profile incomplete gate (just registered, haven't set up profile yet)
  if (profile && profile.status === 'profile_incomplete') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Complete Your Teacher Profile</h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-6">
            Welcome! Before you can start teaching, please fill in your profile details.
            Once submitted, our admin team will review and approve your application.
          </p>
          <Link
            to="/teacher/profile/edit"
            className="inline-block w-full py-3 px-4 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
          >
            Set Up My Profile
          </Link>
        </div>
      </div>
    );
  }

  // ── Pending approval gate ─────────────────────────────────────────────────
  if (profile && profile.status === 'pending') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="h-8 w-8 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Application Under Review</h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-6">
            Your teacher application has been submitted and is being reviewed by our admin team.
            You'll receive an email once your profile is approved.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">What happens next</p>
            <ul className="space-y-1.5">
              <li className="text-sm text-amber-800 flex items-start space-x-2">
                <span className="text-amber-500 mt-0.5">→</span>
                <span>Admin reviews your qualifications and experience</span>
              </li>
              <li className="text-sm text-amber-800 flex items-start space-x-2">
                <span className="text-amber-500 mt-0.5">→</span>
                <span>You receive an approval or feedback email</span>
              </li>
              <li className="text-sm text-amber-800 flex items-start space-x-2">
                <span className="text-amber-500 mt-0.5">→</span>
                <span>Once approved, your profile becomes visible to students</span>
              </li>
            </ul>
          </div>
          <p className="text-xs text-gray-400 mt-6">Usually takes 1–2 business days</p>
        </div>
      </div>
    );
  }

  // ── Rejected gate ─────────────────────────────────────────────────────────
  if (profile && profile.status === 'rejected') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-red-200 max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Application Not Approved</h2>
          <p className="text-gray-500 text-sm mb-4">
            Your teacher application was reviewed but could not be approved at this time.
          </p>
          {profile.rejection_reason && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-left mb-4">
              <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-1">Feedback from admin</p>
              <p className="text-sm text-red-800">{profile.rejection_reason}</p>
            </div>
          )}
          <p className="text-sm text-gray-500">Please address the feedback above and contact support to reapply.</p>
        </div>
      </div>
    );
  }

  // ── Full dashboard (approved) ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {profile?.profile_picture && (
                <img src={profile.profile_picture} alt="Profile" className="h-16 w-16 rounded-full object-cover" />
              )}
              <div className="ml-4">
                <h1 className="text-2xl font-bold text-gray-900">{profile?.full_name || user?.name}</h1>
                <p className="text-sm text-gray-600">
                  Status:{' '}
                  <span className="font-semibold text-green-600">Approved</span>
                </p>
              </div>
            </div>
            <Link to="/teacher/profile/edit" className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
              Edit Profile
            </Link>
          </div>
        </div>

        {/* Analytics Cards */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-white shadow rounded-lg p-6">
              <div className="text-sm text-gray-600">Total Students</div>
              <div className="text-3xl font-bold text-gray-900">{analytics.total_students}</div>
            </div>
            <div className="bg-white shadow rounded-lg p-6">
              <div className="text-sm text-gray-600">Total Sessions</div>
              <div className="text-3xl font-bold text-gray-900">{analytics.total_sessions}</div>
            </div>
            <div className="bg-white shadow rounded-lg p-6">
              <div className="text-sm text-gray-600">Average Rating</div>
              <div className="text-3xl font-bold text-gray-900">{analytics.average_rating.toFixed(1)} ⭐</div>
            </div>
            <div className="bg-white shadow rounded-lg p-6">
              <div className="text-sm text-gray-600">Pending Requests</div>
              <div className="text-3xl font-bold text-indigo-600">{analytics.pending_requests}</div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {['overview', 'requests', 'sessions', 'freeMaterials', 'reviews'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-4 px-6 text-sm font-medium capitalize ${
                    activeTab === tab
                      ? 'border-b-2 border-indigo-500 text-indigo-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'requests' ? `Hire Requests (${requests.filter(r => r.status === 'pending').length})`
                    : tab === 'freeMaterials' ? 'Free Materials'
                    : tab === 'reviews' ? `Reviews (${myReviews.length})`
                    : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
                  {requests.length === 0 && sessions.length === 0 ? (
                    <p className="text-gray-600">No recent activity</p>
                  ) : (
                    <div className="space-y-4">
                      {requests.slice(0, 3).map((request) => (
                        <div key={request.id} className="border-l-4 border-indigo-500 pl-4 py-2">
                          <p className="font-medium">New hire request from {request.student.name}</p>
                          <p className="text-sm text-gray-600">Subject: {request.subject} • ${request.total_price}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Requests Tab */}
            {activeTab === 'requests' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold mb-4">Hire Requests</h3>
                {requests.length === 0 ? (
                  <p className="text-gray-600">No hire requests yet</p>
                ) : (
                  requests.map((request) => (
                    <div key={request.id} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            {request.student.avatar && (
                              <img src={request.student.avatar} alt={request.student.name} className="h-10 w-10 rounded-full object-cover mr-3" />
                            )}
                            <div>
                              <h4 className="font-semibold">{request.student.name}</h4>
                              <p className="text-sm text-gray-600">{request.student.email}</p>
                            </div>
                          </div>
                          <div className="space-y-1 mb-3">
                            <p><span className="font-medium">Subject:</span> {request.subject}</p>
                            <p><span className="font-medium">Session Type:</span> {request.session_type}</p>
                            <p><span className="font-medium">Price:</span> ${request.total_price}</p>
                            {request.description && <p><span className="font-medium">Description:</span> {request.description}</p>}
                          </div>
                          <p className="text-sm text-gray-500">Requested on {new Date(request.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="ml-4">
                          {request.status === 'pending' ? (
                            <div className="space-x-2">
                              <button onClick={() => handleRequestAction(request.id, 'accepted')} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">Accept</button>
                              <button onClick={() => handleRequestAction(request.id, 'rejected')} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Reject</button>
                            </div>
                          ) : (
                            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                              request.status === 'accepted' ? 'bg-green-100 text-green-800' :
                              request.status === 'rejected' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>{request.status}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Sessions Tab */}
            {activeTab === 'sessions' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold mb-4">Teaching Sessions</h3>
                {sessions.length === 0 ? (
                  <p className="text-gray-600">No sessions scheduled yet</p>
                ) : (
                  sessions.map((session) => (
                    <div key={session.id} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            {session.other_party.avatar && (
                              <img src={session.other_party.avatar} alt={session.other_party.name} className="h-10 w-10 rounded-full object-cover mr-3" />
                            )}
                            <div>
                              <h4 className="font-semibold">{session.other_party.name}</h4>
                              <p className="text-sm text-gray-600">Student</p>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p><span className="font-medium">Subject:</span> {session.subject}</p>
                            <p><span className="font-medium">Duration:</span> {session.duration_minutes} minutes</p>
                            {session.scheduled_time && <p><span className="font-medium">Scheduled:</span> {new Date(session.scheduled_time).toLocaleString()}</p>}
                            {session.meeting_link && (
                              <p><span className="font-medium">Meeting Link:</span>{' '}
                                <a href={session.meeting_link} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">Join Meeting</a>
                              </p>
                            )}
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          session.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                          session.status === 'completed' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>{session.status}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Free Materials Tab */}
            {activeTab === 'freeMaterials' && (
              <div className="space-y-6">

                {/* ADD MATERIAL FORM — always visible */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Add Free Resource</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Resource Type</label>
                      <select
                        value={newMaterial.type}
                        onChange={e => setNewMaterial(prev => ({...prev, type: e.target.value}))}
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                      >
                        <option value="video_link">🎥 Video Link (YouTube, Vimeo)</option>
                        <option value="pdf_link">📄 PDF Link (Google Drive, Dropbox)</option>
                        <option value="note">📝 Written Note / Article</option>
                        <option value="external_link">🔗 External Resource</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Title</label>
                      <input
                        value={newMaterial.title}
                        onChange={e => setNewMaterial(prev => ({...prev, title: e.target.value}))}
                        placeholder="e.g. Introduction to Calculus"
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">URL / Link</label>
                      <input
                        value={newMaterial.url}
                        onChange={e => setNewMaterial(prev => ({...prev, url: e.target.value}))}
                        placeholder="https://..."
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Description <span className="text-gray-400 font-normal">(optional)</span></label>
                      <textarea
                        value={newMaterial.description}
                        onChange={e => setNewMaterial(prev => ({...prev, description: e.target.value}))}
                        placeholder="Briefly describe what students will learn from this resource..."
                        rows={2}
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end mt-4">
                    <button
                      onClick={handleAddMaterial}
                      disabled={!newMaterial.title.trim() || !newMaterial.url.trim() || addingMaterial}
                      className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                    >
                      <span>{addingMaterial ? 'Adding...' : '+ Add Resource'}</span>
                    </button>
                  </div>
                </div>

                {/* MATERIALS LIST */}
                <div className="space-y-3">
                  <h3 className="text-base font-semibold text-gray-900">
                    Your Free Resources ({(profile?.free_materials || []).length})
                  </h3>
                  {(profile?.free_materials || []).length === 0 ? (
                    <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-8 text-center">
                      <p className="text-sm font-medium text-gray-700">No free resources yet</p>
                      <p className="text-xs text-gray-400 mt-1">Add videos, PDFs, or notes above to show students your teaching style</p>
                    </div>
                  ) : (
                    (profile?.free_materials || []).map((material, index) => (
                      <div key={index} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start justify-between hover:border-blue-200 transition-colors">
                        <div className="flex items-start space-x-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-100">
                            <span className="text-lg">
                              {material.type === 'video_link' ? '🎥' : material.type === 'pdf_link' ? '📄' : material.type === 'note' ? '📝' : '🔗'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900">{material.title}</p>
                            {material.description && <p className="text-xs text-gray-500 mt-0.5">{material.description}</p>}
                            <a href={material.url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:text-blue-800 mt-1 block truncate max-w-md">
                              {material.url}
                            </a>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveMaterial(index)}
                          className="ml-3 px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>

              </div>
            )}

            {/* Reviews Tab */}
            {activeTab === 'reviews' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold mb-4">My Reviews ({myReviews.length})</h3>
                {myReviews.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-14 h-14 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Star className="h-6 w-6 text-yellow-400" />
                    </div>
                    <p className="text-gray-700 font-medium">No reviews yet</p>
                    <p className="text-sm text-gray-500 mt-1">Reviews appear here after students complete sessions with you.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {myReviews.map((review, i) => (
                      <div key={review.id || i} className="bg-white border border-gray-200 rounded-xl p-5">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3">
                            {review.student_avatar ? (
                              <img src={review.student_avatar} alt={review.student_name} className="h-10 w-10 rounded-full object-cover" />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                <span className="text-indigo-600 font-semibold text-sm">{(review.student_name || 'A')[0].toUpperCase()}</span>
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{review.student_name || 'Anonymous'}</p>
                              <p className="text-xs text-gray-400">{review.created_at ? new Date(review.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-0.5">
                            {[1,2,3,4,5].map(s => (
                              <Star key={s} className={`h-4 w-4 ${s <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />
                            ))}
                          </div>
                        </div>
                        {review.comment && (
                          <p className="text-sm text-gray-700 mt-3 leading-relaxed">{review.comment}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
