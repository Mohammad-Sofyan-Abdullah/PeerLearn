import React, { useState } from 'react';
import { useMutation, useQueryClient } from 'react-query';
// import { motion } from 'framer-motion'; // Removed unused import
import {
  User,
  Mail,
  GraduationCap,
  Edit3,
  Save,
  X,
  Camera,
  Plus,
  Trash2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Button from '../components/Button';
import toast from 'react-hot-toast';
import api from '../utils/api';

const ProfilePage = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    study_interests: [],
  });
  const [newInterest, setNewInterest] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const { user, updateProfile } = useAuth();
  const queryClient = useQueryClient();
  const [googleConnected, setGoogleConnected] = React.useState(false);

  // Sync with user.google_calendar_connected once the user object is loaded
  React.useEffect(() => {
    if (user) setGoogleConnected(!!user.google_calendar_connected);
  }, [user?.google_calendar_connected]);

  // Detect redirect back from Google OAuth (?google_connected=true)
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_connected') === 'true') {
      setGoogleConnected(true);
      toast.success('Google Calendar connected successfully!');
      window.history.replaceState({}, '', '/profile');
    } else if (params.get('google_connected') === 'false') {
      toast.error('Google Calendar connection failed. Please try again.');
      window.history.replaceState({}, '', '/profile');
    }
  }, []);

  const handleConnectGoogle = async () => {
    try {
      const response = await api.get('/auth/google/calendar/connect');
      window.location.href = response.data.auth_url;
    } catch (err) {
      // Full diagnostic — open browser DevTools Console to see this
      console.error('[ConnectGoogle] Full error object:', err);
      console.error('[ConnectGoogle] Response status:', err?.response?.status);
      console.error('[ConnectGoogle] Response data:', err?.response?.data);
      console.error('[ConnectGoogle] Detail:', err?.response?.data?.detail);
      toast.error('Failed to initiate Google connection: ' + (err?.response?.data?.detail || err?.message || 'Unknown error'));
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!window.confirm('Disconnect Google Calendar? Automatic Meet links will no longer be created for your sessions.')) return;
    try {
      await api.delete('/auth/google/calendar/disconnect');
      setGoogleConnected(false);
      toast.success('Google Calendar disconnected');
    } catch (err) {
      toast.error('Failed to disconnect');
    }
  };

  // Initialize form data when user data loads
  React.useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        bio: user.bio || '',
        study_interests: user.study_interests || [],
      });
    }
  }, [user]);

  // Cleanup preview URL when component unmounts or file changes
  React.useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const updateProfileMutation = useMutation(updateProfile, {
    onSuccess: () => {
      queryClient.invalidateQueries('user');
      setIsEditing(false);
    },
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    let profileData = { ...formData };

    // Handle file upload if there's a selected file
    if (selectedFile) {
      const base64 = await convertToBase64(selectedFile);
      profileData.avatar = base64;
    }

    updateProfileMutation.mutate(profileData);
  };

  const convertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error('File size must be less than 5MB');
        return;
      }

      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }

      setSelectedFile(file);

      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: user.name || '',
      bio: user.bio || '',
      study_interests: user.study_interests || [],
    });
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setIsEditing(false);
  };

  const addInterest = () => {
    if (newInterest.trim() && !formData.study_interests.includes(newInterest.trim())) {
      setFormData({
        ...formData,
        study_interests: [...formData.study_interests, newInterest.trim()],
      });
      setNewInterest('');
    }
  };

  const removeInterest = (interest) => {
    setFormData({
      ...formData,
      study_interests: formData.study_interests.filter(i => i !== interest),
    });
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addInterest();
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage your profile information and preferences
          </p>
        </div>
        <Button
          onClick={() => setIsEditing(!isEditing)}
          variant="outline"
          leftIcon={<Edit3 className="h-4 w-4" />}
        >
          {isEditing ? 'Cancel' : 'Edit Profile'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <div className="card">
            <div className="card-content text-center">
              <div className="top-5 relative inline-block mb-3">
                <div className="w-24 h-24 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4 overflow-hidden">
                  {previewUrl || user.avatar ? (
                    <img
                      src={previewUrl || user.avatar}
                      alt={user.name}
                      className="w-24 h-24 rounded-full object-cover"
                    />
                  ) : (
                    <User className="h-12 w-12 text-primary-600" />
                  )}
                </div>
                {isEditing && (
                  <>
                    <input
                      type="file"
                      id="avatar-upload"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <label
                      htmlFor="avatar-upload"
                      className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow-md border border-gray-200 hover:bg-gray-50 cursor-pointer"
                    >
                      <Camera className="h-4 w-4 text-gray-600" />
                    </label>
                  </>
                )}
              </div>

              <h2 className="text-xl font-semibold text-gray-900 mb-1">
                {user.name}
              </h2>
              <p className="text-sm text-gray-600 mb-4">{user.email}</p>

              {user.student_id && (
                <div className="flex items-center justify-center text-sm text-gray-500 mb-4">
                  <GraduationCap className="h-4 w-4 mr-1" />
                  {user.student_id}
                </div>
              )}

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Learning Streak:</span>
                  <span className="font-medium">{user.learning_streaks || 0} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Friends:</span>
                  <span className="font-medium">{user.friends?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Member since:</span>
                  <span className="font-medium">
                    {new Date(user.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Details */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">Profile Information</h3>
            </div>
            <div className="card-content">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Name */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Full Name
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="name"
                      id="name"
                      value={formData.name}
                      onChange={handleChange}
                      className="input mt-1"
                      required
                    />
                  ) : (
                    <p className="mt-1 text-sm text-gray-900">{user.name}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Email Address
                  </label>
                  <div className="mt-1 flex items-center">
                    <Mail className="h-4 w-4 text-gray-400 mr-2" />
                    <p className="text-sm text-gray-900">{user.email}</p>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Email cannot be changed. Contact support if needed.
                  </p>
                </div>

                {/* Bio */}
                <div>
                  <label htmlFor="bio" className="block text-sm font-medium text-gray-700">
                    Bio
                  </label>
                  {isEditing ? (
                    <textarea
                      name="bio"
                      id="bio"
                      rows="3"
                      value={formData.bio}
                      onChange={handleChange}
                      className="input mt-1"
                      placeholder="Tell us about yourself..."
                    />
                  ) : (
                    <p className="mt-1 text-sm text-gray-900">
                      {user.bio || 'No bio provided'}
                    </p>
                  )}
                </div>

                {/* Study Interests */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Study Interests
                  </label>
                  {isEditing ? (
                    <div className="mt-1">
                      <div className="flex space-x-2 mb-2">
                        <input
                          type="text"
                          value={newInterest}
                          onChange={(e) => setNewInterest(e.target.value)}
                          onKeyPress={handleKeyPress}
                          className="input flex-1"
                          placeholder="Add a study interest"
                        />
                        <Button
                          type="button"
                          onClick={addInterest}
                          size="md"
                          leftIcon={<Plus className="h-4 w-4" />}
                        >
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {formData.study_interests.map((interest, index) => (
                          <span
                            key={index}
                            className="badge-primary flex items-center space-x-1"
                          >
                            <span>{interest}</span>
                            <button
                              type="button"
                              onClick={() => removeInterest(interest)}
                              className="ml-1 hover:text-primary-600"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1">
                      {user.study_interests && user.study_interests.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {user.study_interests.map((interest, index) => (
                            <span key={index} className="badge-primary">
                              {interest}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No study interests added</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                {isEditing && (
                  <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                    <Button
                      type="button"
                      onClick={handleCancel}
                      variant="outline"
                      leftIcon={<X className="h-4 w-4" />}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={updateProfileMutation.isLoading}
                      isLoading={updateProfileMutation.isLoading}
                      leftIcon={!updateProfileMutation.isLoading && <Save className="h-4 w-4" />}
                    >
                      Save Changes
                    </Button>
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* ── Connected Accounts ── */}
          <div className="card mt-6">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">Connected Accounts</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Connect Google to enable automatic Meet links when teachers approve your session requests.
              </p>
            </div>
            <div className="card-content">
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
                {/* Google logo + label */}
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center shadow-sm flex-shrink-0">
                    <svg viewBox="0 0 24 24" className="w-5 h-5">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Google Calendar &amp; Meet</p>
                    <p className="text-xs text-gray-500">
                      {googleConnected
                        ? 'Connected — Meet links will be auto-generated on session approval'
                        : 'Not connected — connect to enable automatic Meet links'}
                    </p>
                  </div>
                </div>

                {/* Action */}
                <div className="flex items-center space-x-2 flex-shrink-0">
                  {googleConnected ? (
                    <>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 inline-block" />
                        Connected
                      </span>
                      <button
                        onClick={handleDisconnectGoogle}
                        className="px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleConnectGoogle}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
                    >
                      Connect Google
                    </button>
                  )}
                </div>
              </div>

              {!googleConnected && (
                <p className="text-xs text-gray-400 mt-3 flex items-start space-x-1">
                  <span>💡</span>
                  <span>
                    When connected, Google Meet links are automatically created and sent to you in chat
                    when a teacher approves your session request.
                  </span>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;


