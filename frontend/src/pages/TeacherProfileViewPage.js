import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Gift } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

export default function TeacherProfileViewPage() {
  const { teacherId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [teacher, setTeacher] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showHireModal, setShowHireModal] = useState(false);
  const [hireData, setHireData] = useState({ session_type:'hourly', subject:'', description:'', duration_hours:1, start_time:'' });

  useEffect(() => { fetchTeacherProfile(); }, [teacherId]);

  const fetchTeacherProfile = async () => {
    setLoading(true);
    try { const r = await api.get(`/teachers/${teacherId}`); setTeacher(r.data); }
    catch(e){ console.error(e); } finally { setLoading(false); }
  };

  const handleHireSubmit = async (e) => {
    e.preventDefault();
    try {
      const startDate = new Date(hireData.start_time);
      const endDate = new Date(startDate.getTime() + (parseInt(hireData.duration_hours)||1)*3600000);
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      await api.post('/teachers/hire', { teacher_id:teacherId, ...hireData, duration_hours:parseInt(hireData.duration_hours), start_time:startDate.toISOString(), end_time:endDate.toISOString(), timezone });
      alert('Hire request sent successfully!');
      setShowHireModal(false);
      navigate('/dashboard');
    } catch(e){ alert('Failed: '+(e.response?.data?.detail||'Unknown error')); }
  };

  const handleMessageTeacher = async () => {
    try { await api.post(`/messages/conversations/${teacher.user_id}`); navigate(`/messages/${teacher.user_id}`); }
    catch(e){ alert('Failed: '+(e.response?.data?.detail||'Unknown error')); }
  };

  const inp = "w-full border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500";
  const lbl = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2";
  const card = "bg-white dark:bg-gray-800 shadow rounded-xl border border-gray-100 dark:border-gray-700/60 p-6";

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950"><div className="text-xl text-gray-600 dark:text-gray-400">Loading...</div></div>;
  if (!teacher) return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950"><div className="text-xl text-red-500">Teacher not found</div></div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className={`${card} mb-6`}>
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-shrink-0">
              {teacher.profile_picture ? (
                <img src={teacher.profile_picture} alt={teacher.full_name} className="h-32 w-32 rounded-full object-cover"/>
              ) : (
                <div className="h-32 w-32 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                  <span className="text-5xl text-indigo-600 dark:text-indigo-400 font-semibold">{teacher.full_name.charAt(0)}</span>
                </div>
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{teacher.full_name}</h1>
              <div className="flex items-center mb-4 flex-wrap gap-2">
                <span className="text-yellow-500 text-xl">⭐</span>
                <span className="ml-1 text-lg font-semibold text-gray-900 dark:text-white">{teacher.average_rating.toFixed(1)}</span>
                <span className="text-gray-500 dark:text-gray-400">({teacher.total_reviews} reviews)</span>
                <span className="text-gray-400 dark:text-gray-600">•</span>
                <span className="text-gray-600 dark:text-gray-400">{teacher.total_students} students</span>
                <span className="text-gray-400 dark:text-gray-600">•</span>
                <span className="text-gray-600 dark:text-gray-400">{teacher.total_sessions} sessions</span>
              </div>
              <p className="text-gray-700 dark:text-gray-300 mb-4">{teacher.short_bio}</p>
              <div className="flex gap-3">
                <button onClick={() => setShowHireModal(true)}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors">
                  Hire Teacher
                </button>
                <button onClick={handleMessageTeacher}
                  className="px-6 py-3 border border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 font-semibold transition-colors">
                  Send Message
                </button>
              </div>
            </div>
            {/* Pricing Card */}
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-xl p-6 text-center flex-shrink-0">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Starting from</div>
              <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">${teacher.hourly_rate}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">per hour</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            {/* About */}
            <div className={card}>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">About</h2>
              <div className="space-y-3 text-gray-700 dark:text-gray-300">
                <div><span className="font-semibold text-gray-900 dark:text-white">Experience:</span> {teacher.years_of_experience} years</div>
                <div><span className="font-semibold text-gray-900 dark:text-white">Languages:</span> {teacher.languages_spoken.join(', ')}</div>
                <div><span className="font-semibold text-gray-900 dark:text-white">Teaching Tools:</span> {teacher.online_tools.join(', ')}</div>
              </div>
            </div>

            {/* Expertise */}
            <div className={card}>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Areas of Expertise</h2>
              <div className="flex flex-wrap gap-2">
                {teacher.areas_of_expertise.map((exp,i) => (
                  <span key={i} className="px-3 py-2 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 font-medium">{exp}</span>
                ))}
              </div>
            </div>

            {/* Courses */}
            <div className={card}>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Courses Offered</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {teacher.courses_offered.map((course,i) => (
                  <div key={i} className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-indigo-400 dark:hover:border-indigo-600 text-gray-800 dark:text-gray-200 transition-colors">{course}</div>
                ))}
              </div>
            </div>

            {/* Free Resources */}
            {teacher.free_materials?.length > 0 && (
              <div className={card}>
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                    <Gift className="h-4 w-4 text-green-600 dark:text-green-400"/>
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900 dark:text-white">Free Resources</h2>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Preview {teacher.full_name}'s teaching style — free to view or download</p>
                  </div>
                </div>
                <div className="grid gap-3">
                  {teacher.free_materials.map((material,i) => {
                    const isPdf = material.type==='pdf_link', isVideo = material.type==='video_link';
                    const actionLabel = isPdf?'📥 Download / View':isVideo?'▶ Watch':'🔗 Open';
                    const actionClass = isPdf?'bg-orange-600 hover:bg-orange-700 text-white':isVideo?'bg-red-600 hover:bg-red-700 text-white':'bg-blue-600 hover:bg-blue-700 text-white';
                    return (
                      <div key={i} className="flex items-center space-x-3 p-4 bg-gradient-to-r from-blue-50 to-white dark:from-blue-900/10 dark:to-gray-800 border border-blue-100 dark:border-blue-900/40 rounded-xl hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm transition-all">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isPdf?'bg-orange-100 dark:bg-orange-900/30':isVideo?'bg-red-100 dark:bg-red-900/30':material.type==='note'?'bg-purple-100 dark:bg-purple-900/30':'bg-blue-100 dark:bg-blue-900/30'}`}>
                          <span className="text-xl">{isPdf?'📄':isVideo?'🎥':material.type==='note'?'📝':'🔗'}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-0.5">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{material.title}</p>
                            <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-semibold">FREE</span>
                          </div>
                          {material.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{material.description}</p>}
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 capitalize">{isPdf?'PDF / Document':isVideo?'Video':material.type==='note'?'Written Note':'External Link'}</p>
                        </div>
                        <a href={material.url} target="_blank" rel="noopener noreferrer" download={isPdf||undefined}
                          className={`flex-shrink-0 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${actionClass}`}>
                          {actionLabel}
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Reviews */}
            <div className={card}>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Reviews ({teacher.total_reviews})</h2>
              {teacher.recent_reviews?.length > 0 ? (
                <div className="space-y-4">
                  {teacher.recent_reviews.map(review => (
                    <div key={review.id} className="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-0">
                      <div className="flex items-start">
                        {review.student_avatar && <img src={review.student_avatar} alt={review.student_name} className="h-10 w-10 rounded-full object-cover"/>}
                        <div className="ml-3 flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-gray-900 dark:text-white">{review.student_name}</h4>
                            <div className="flex items-center"><span className="text-yellow-500">⭐</span><span className="ml-1 font-semibold text-gray-900 dark:text-white">{review.rating}</span></div>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{review.comment}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{new Date(review.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-gray-600 dark:text-gray-400">No reviews yet</p>}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className={card}>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Qualifications</h3>
              {teacher.academic_degrees.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">Academic Degrees</h4>
                  <ul className="space-y-2">
                    {teacher.academic_degrees.map((d,i) => <li key={i} className="text-sm text-gray-600 dark:text-gray-400">• {d}</li>)}
                  </ul>
                </div>
              )}
              {teacher.certifications.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">Certifications</h4>
                  <ul className="space-y-2">
                    {teacher.certifications.map((c,i) => <li key={i} className="text-sm text-gray-600 dark:text-gray-400">• {c}</li>)}
                  </ul>
                </div>
              )}
            </div>
            {teacher.portfolio_links?.length > 0 && (
              <div className={card}>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Portfolio</h3>
                <div className="space-y-2">
                  {teacher.portfolio_links.map((link,i) => (
                    <a key={i} href={link} target="_blank" rel="noopener noreferrer"
                      className="block text-indigo-600 dark:text-indigo-400 hover:underline text-sm">{link}</a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hire Modal */}
      {showHireModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-700">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Hire {teacher.full_name}</h3>
            <form onSubmit={handleHireSubmit} className="space-y-4">
              <div>
                <label className={lbl}>Session Type</label>
                <select value={hireData.session_type} onChange={e=>setHireData({...hireData,session_type:e.target.value})} className={inp}>
                  <option value="hourly">Hourly Session</option>
                  <option value="course">Full Course</option>
                  <option value="monthly">Monthly Plan</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Subject</label>
                <input type="text" required value={hireData.subject} onChange={e=>setHireData({...hireData,subject:e.target.value})}
                  className={inp} placeholder="e.g., Calculus, Physics"/>
              </div>
              {hireData.session_type==='hourly' && (
                <div>
                  <label className={lbl}>Number of Hours</label>
                  <input type="number" min="1" value={hireData.duration_hours} onChange={e=>setHireData({...hireData,duration_hours:e.target.value})} className={inp}/>
                </div>
              )}
              <div>
                <label className={lbl}>Session Start Time</label>
                <input type="datetime-local" required value={hireData.start_time} onChange={e=>setHireData({...hireData,start_time:e.target.value})} className={inp}/>
              </div>
              <div>
                <label className={lbl}>Additional Details</label>
                <textarea value={hireData.description} onChange={e=>setHireData({...hireData,description:e.target.value})}
                  rows={3} className={inp} placeholder="Tell the teacher about your learning goals..."/>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 p-3 rounded-lg text-gray-700 dark:text-gray-300 text-sm space-y-2">
                <div className="flex justify-between"><span>Rate:</span><span>${teacher.hourly_rate}/hour</span></div>
                {hireData.session_type==='hourly' && <>
                  <div className="flex justify-between"><span>Hours:</span><span>{hireData.duration_hours}</span></div>
                  <div className="flex justify-between font-bold text-gray-900 dark:text-white"><span>Total:</span><span>${(teacher.hourly_rate*hireData.duration_hours).toFixed(2)}</span></div>
                </>}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={()=>setShowHireModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors">
                  Send Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
