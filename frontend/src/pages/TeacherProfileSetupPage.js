import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, Gift, Loader2 } from 'lucide-react';

export default function TeacherProfileSetupPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [error, setError] = useState('');
  const [profileData, setProfileData] = useState({
    full_name: user?.name || '',
    short_bio: '',
    areas_of_expertise: [],
    courses_offered: [],
    academic_degrees: [],
    certifications: [],
    years_of_experience: 0,
    languages_spoken: [],
    hourly_rate: '',
    availability_schedule: {},
    online_tools: [],
    portfolio_links: []
  });

  const [currentInput, setCurrentInput] = useState({
    expertise: '',
    course: '',
    degree: '',
    certification: '',
    language: '',
    tool: '',
    link: ''
  });

  // Free materials state (managed separately — saved immediately to API, not bundled with profile form)
  const [freeMaterials, setFreeMaterials] = useState([]);
  const [newMaterial, setNewMaterial] = useState({ title: '', type: 'pdf_link', url: '', description: '' });
  const [addingMaterial, setAddingMaterial] = useState(false);
  const [removingIndex, setRemovingIndex] = useState(null);

  useEffect(() => {
    // Try to load existing profile — if found, populate form for editing
    const loadProfile = async () => {
      try {
        const res = await api.get('/teachers/profile');
        const p = res.data;
        setIsEditMode(true);
        setProfileData({
          full_name: p.full_name || user?.name || '',
          short_bio: p.short_bio || '',
          areas_of_expertise: p.areas_of_expertise || [],
          courses_offered: p.courses_offered || [],
          academic_degrees: p.academic_degrees || [],
          certifications: p.certifications || [],
          years_of_experience: p.years_of_experience ?? 0,
          languages_spoken: p.languages_spoken || [],
          hourly_rate: p.hourly_rate || '',
          availability_schedule: p.availability_schedule || {},
          online_tools: p.online_tools || [],
          portfolio_links: p.portfolio_links || []
        });
        setFreeMaterials(p.free_materials || []);
      } catch (err) {
        // No profile yet — setup mode, form stays blank
        setIsEditMode(false);
      } finally {
        setInitialLoading(false);
      }
    };
    loadProfile();
  }, [user]);

  const handleChange = (e) => {
    setProfileData({
      ...profileData,
      [e.target.name]: e.target.value
    });
  };

  const handleArrayInput = (field, inputField) => {
    if (currentInput[inputField].trim()) {
      setProfileData({
        ...profileData,
        [field]: [...profileData[field], currentInput[inputField].trim()]
      });
      setCurrentInput({ ...currentInput, [inputField]: '' });
    }
  };

  const removeArrayItem = (field, index) => {
    setProfileData({
      ...profileData,
      [field]: profileData[field].filter((_, i) => i !== index)
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = {
        ...profileData,
        hourly_rate: parseFloat(profileData.hourly_rate) || null
      };

      // Always POST — backend uses upsert so this works for both create and update
      await api.post('/teachers/profile', payload);

      toast.success(isEditMode
        ? 'Profile updated successfully!'
        : 'Profile created! Awaiting admin approval.');
      navigate('/teacher/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMaterial = async () => {
    if (!newMaterial.title.trim() || !newMaterial.url.trim()) return;
    setAddingMaterial(true);
    try {
      const res = await api.post('/teachers/profile/materials', newMaterial);
      setFreeMaterials(res.data.free_materials || []);
      setNewMaterial({ title: '', type: 'pdf_link', url: '', description: '' });
      toast.success('Resource added');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add resource');
    } finally {
      setAddingMaterial(false);
    }
  };

  const handleRemoveMaterial = async (index) => {
    if (!window.confirm('Remove this resource?')) return;
    setRemovingIndex(index);
    try {
      const res = await api.delete(`/teachers/profile/materials/${index}`);
      setFreeMaterials(res.data.free_materials || []);
      toast.success('Resource removed');
    } catch (err) {
      toast.error('Failed to remove resource');
    } finally {
      setRemovingIndex(null);
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                {isEditMode ? 'Edit Your Teacher Profile' : 'Set Up Your Teacher Profile'}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {isEditMode
                  ? 'Update your profile details. Changes will be saved immediately.'
                  : 'Complete your profile to start offering teaching services. Your profile will be reviewed by our team before going live.'}
              </p>
            </div>
            {isEditMode && (
              <button
                type="button"
                onClick={() => navigate('/teacher/dashboard')}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
              >
                ← Back to Dashboard
              </button>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Basic Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                  <input
                    type="text"
                    name="full_name"
                    value={profileData.full_name}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Short Bio</label>
                  <textarea
                    name="short_bio"
                    value={profileData.short_bio}
                    onChange={handleChange}
                    rows={4}
                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                    placeholder="Tell students about yourself and your teaching philosophy..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Years of Experience</label>
                  <input
                    type="number"
                    name="years_of_experience"
                    value={profileData.years_of_experience}
                    onChange={handleChange}
                    min="0"
                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>
            </div>

            {/* Expertise */}
            <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Areas of Expertise</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={currentInput.expertise}
                  onChange={(e) => setCurrentInput({ ...currentInput, expertise: e.target.value })}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleArrayInput('areas_of_expertise', 'expertise'))}
                  className="flex-1 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="e.g., Mathematics, Physics"
                />
                <button
                  type="button"
                  onClick={() => handleArrayInput('areas_of_expertise', 'expertise')}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-500 transition-colors"
                >
                  Add
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {profileData.areas_of_expertise.map((item, index) => (
                  <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-indigo-100 text-indigo-800">
                    {item}
                    <button
                      type="button"
                      onClick={() => removeArrayItem('areas_of_expertise', index)}
                      className="ml-2 text-indigo-600 hover:text-indigo-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Courses Offered */}
            <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Courses/Subjects Offered</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={currentInput.course}
                  onChange={(e) => setCurrentInput({ ...currentInput, course: e.target.value })}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleArrayInput('courses_offered', 'course'))}
                  className="flex-1 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                  placeholder="e.g., Calculus I, Algebra"
                />
                <button
                  type="button"
                  onClick={() => handleArrayInput('courses_offered', 'course')}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Add
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {profileData.courses_offered.map((item, index) => (
                  <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
                    {item}
                    <button
                      type="button"
                      onClick={() => removeArrayItem('courses_offered', index)}
                      className="ml-2 text-green-600 hover:text-green-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Academic Degrees */}
            <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Academic Degrees</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={currentInput.degree}
                  onChange={(e) => setCurrentInput({ ...currentInput, degree: e.target.value })}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleArrayInput('academic_degrees', 'degree'))}
                  className="flex-1 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                  placeholder="e.g., PhD in Mathematics, MIT"
                />
                <button
                  type="button"
                  onClick={() => handleArrayInput('academic_degrees', 'degree')}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Add
                </button>
              </div>
              <div className="mt-2 space-y-1">
                {profileData.academic_degrees.map((item, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded border border-gray-200 dark:border-gray-700">
                    <span className="text-sm text-gray-700 dark:text-gray-300">{item}</span>
                    <button
                      type="button"
                      onClick={() => removeArrayItem('academic_degrees', index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Certifications */}
            <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Certifications</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={currentInput.certification}
                  onChange={(e) => setCurrentInput({ ...currentInput, certification: e.target.value })}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleArrayInput('certifications', 'certification'))}
                  className="flex-1 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                  placeholder="e.g., Google Certified Educator"
                />
                <button
                  type="button"
                  onClick={() => handleArrayInput('certifications', 'certification')}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Add
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {profileData.certifications.map((item, index) => (
                  <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-yellow-100 text-yellow-800">
                    {item}
                    <button
                      type="button"
                      onClick={() => removeArrayItem('certifications', index)}
                      className="ml-2 text-yellow-600 hover:text-yellow-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Languages */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Languages Spoken</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={currentInput.language}
                  onChange={(e) => setCurrentInput({ ...currentInput, language: e.target.value })}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleArrayInput('languages_spoken', 'language'))}
                  className="flex-1 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                  placeholder="e.g., English, Spanish"
                />
                <button
                  type="button"
                  onClick={() => handleArrayInput('languages_spoken', 'language')}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Add
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {profileData.languages_spoken.map((item, index) => (
                  <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                    {item}
                    <button
                      type="button"
                      onClick={() => removeArrayItem('languages_spoken', index)}
                      className="ml-2 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Pricing */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Pricing</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Hourly Rate ($)</label>
                <input
                  type="number"
                  name="hourly_rate"
                  value={profileData.hourly_rate}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                  placeholder="50.00"
                />
              </div>
            </div>

            {/* Online Tools */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Online Teaching Tools</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={currentInput.tool}
                  onChange={(e) => setCurrentInput({ ...currentInput, tool: e.target.value })}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleArrayInput('online_tools', 'tool'))}
                  className="flex-1 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                  placeholder="e.g., Zoom, Google Meet"
                />
                <button
                  type="button"
                  onClick={() => handleArrayInput('online_tools', 'tool')}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Add
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {profileData.online_tools.map((item, index) => (
                  <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-800">
                    {item}
                    <button
                      type="button"
                      onClick={() => removeArrayItem('online_tools', index)}
                      className="ml-2 text-purple-600 hover:text-purple-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Free Resources — only shown in edit mode since profile must exist first */}
            {isEditMode && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Free Resources for Students</h3>
                <p className="text-sm text-gray-500 mb-4">Upload PDFs, share video links, or add notes that students can view/download before deciding to hire you.</p>

                {/* Existing materials list */}
                {freeMaterials.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {freeMaterials.map((m, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 bg-gray-50 dark:bg-gray-900">
                        <div className="flex items-center space-x-3 min-w-0">
                          <span className="text-xl flex-shrink-0">
                            {m.type === 'video_link' ? '🎥' : m.type === 'pdf_link' ? '📄' : m.type === 'note' ? '📝' : '🔗'}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{m.title}</p>
                            {m.description && <p className="text-xs text-gray-500 truncate">{m.description}</p>}
                            <a href={m.url} target="_blank" rel="noopener noreferrer"
                               className="text-xs text-blue-600 hover:underline truncate block max-w-xs">
                              {m.url}
                            </a>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveMaterial(i)}
                          disabled={removingIndex === i}
                          className="ml-3 flex-shrink-0 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                        >
                          {removingIndex === i
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Trash2 className="h-4 w-4" />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {freeMaterials.length === 0 && (
                  <div className="flex items-center space-x-3 bg-blue-50 border border-dashed border-blue-200 rounded-xl px-4 py-4 mb-4">
                    <Gift className="h-5 w-5 text-blue-400 flex-shrink-0" />
                    <p className="text-sm text-blue-600">No resources added yet. Add a PDF or video link below — students see these on your profile before booking.</p>
                  </div>
                )}

                {/* Add new material inline form */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-900 space-y-3">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Add a resource</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 dark:text-gray-500 mb-1">Type</label>
                      <select
                        value={newMaterial.type}
                        onChange={e => setNewMaterial(prev => ({...prev, type: e.target.value}))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      >
                        <option value="pdf_link">📄 PDF / Document</option>
                        <option value="video_link">🎥 Video Link</option>
                        <option value="note">📝 Written Note</option>
                        <option value="external_link">🔗 External Link</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 dark:text-gray-500 mb-1">Title</label>
                      <input
                        type="text"
                        value={newMaterial.title}
                        onChange={e => setNewMaterial(prev => ({...prev, title: e.target.value}))}
                        placeholder="e.g. Sample Lesson Notes"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-400 dark:text-gray-500 mb-1">URL (Google Drive, Dropbox, YouTube, etc.)</label>
                      <input
                        type="url"
                        value={newMaterial.url}
                        onChange={e => setNewMaterial(prev => ({...prev, url: e.target.value}))}
                        placeholder="https://drive.google.com/..."
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-400 dark:text-gray-500 mb-1">Description <span className="font-normal text-gray-400">(optional)</span></label>
                      <input
                        type="text"
                        value={newMaterial.description}
                        onChange={e => setNewMaterial(prev => ({...prev, description: e.target.value}))}
                        placeholder="Brief description of what students will find inside"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleAddMaterial}
                      disabled={!newMaterial.title.trim() || !newMaterial.url.trim() || addingMaterial}
                      className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {addingMaterial
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Plus className="h-4 w-4" />}
                      <span>{addingMaterial ? 'Adding...' : 'Add Resource'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-6 flex gap-3">
              {isEditMode && (
                <button
                  type="button"
                  onClick={() => navigate('/teacher/dashboard')}
                  className="flex-1 py-3 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="flex-1 flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading
                  ? (isEditMode ? 'Saving...' : 'Creating Profile...')
                  : (isEditMode ? 'Save Changes' : 'Create Teacher Profile')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
