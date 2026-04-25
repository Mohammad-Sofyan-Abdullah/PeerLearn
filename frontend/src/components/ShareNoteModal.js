import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'react-query';
import { X, Share2, BookOpen, ChevronRight, Loader, Check } from 'lucide-react';
import { classroomsAPI, notesAPI } from '../utils/api';
import toast from 'react-hot-toast';

/**
 * ShareNoteModal
 * Allows sharing the current document into a classroom room.
 * Step 1: Pick a classroom
 * Step 2: Pick a room within that classroom
 * Step 3: Confirm → POST /classrooms/rooms/{roomId}/resources
 */
const ShareNoteModal = ({ documentId, documentTitle, onClose }) => {
  const [step, setStep] = useState(1); // 1 = pick classroom, 2 = pick room, 3 = done
  const [selectedClassroom, setSelectedClassroom] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);

  // Fetch classrooms
  const { data: classroomsRaw, isLoading: classroomsLoading } = useQuery(
    ['classrooms'],
    () => classroomsAPI.getClassrooms().then(res => res.data)
  );
  const classrooms = Array.isArray(classroomsRaw)
    ? classroomsRaw
    : classroomsRaw?.data || [];

  // Fetch rooms for selected classroom
  const { data: roomsRaw, isLoading: roomsLoading } = useQuery(
    ['rooms', selectedClassroom?.id || selectedClassroom?._id],
    () => classroomsAPI.getRooms(
      selectedClassroom?.id || selectedClassroom?._id
    ).then(res => res.data),
    { enabled: !!selectedClassroom }
  );
  const rooms = Array.isArray(roomsRaw)
    ? roomsRaw
    : roomsRaw?.data || [];

  // Share mutation
  const shareMutation = useMutation(
    () => classroomsAPI.shareResourceToRoom(
      selectedRoom?.id || selectedRoom?._id,
      documentId
    ),
    {
      onSuccess: () => {
        setStep(3);
        toast.success(`"${documentTitle}" shared to #${selectedRoom?.name}!`);
      },
      onError: (err) => {
        toast.error(err?.response?.data?.detail || 'Failed to share document');
      }
    }
  );

  const handleSelectClassroom = (classroom) => {
    setSelectedClassroom(classroom);
    setSelectedRoom(null);
    setStep(2);
  };

  const handleSelectRoom = (room) => {
    setSelectedRoom(room);
  };

  const handleConfirm = () => {
    if (!selectedRoom) return;
    shareMutation.mutate();
  };

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center space-x-2">
            <Share2 className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-semibold text-gray-900">Share to Classroom Room</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        {/* Document being shared */}
        <div className="px-6 py-3 bg-indigo-50 border-b border-indigo-100">
          <div className="flex items-center space-x-2 text-sm text-indigo-700">
            <BookOpen className="h-4 w-4 flex-shrink-0" />
            <span className="truncate font-medium">{documentTitle}</span>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 min-h-[220px]">
          {step === 3 ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-gray-700 font-medium text-center">
                Document shared to <span className="text-indigo-600">#{selectedRoom?.name}</span>
                {' '}in <span className="text-indigo-600">{selectedClassroom?.name}</span>!
              </p>
              <p className="text-sm text-gray-500 text-center">
                Classroom members can now open it for collaborative editing.
              </p>
              <button
                onClick={onClose}
                className="mt-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors"
              >
                Done
              </button>
            </div>
          ) : step === 1 ? (
            <div>
              <p className="text-sm text-gray-600 mb-3">Select a classroom:</p>
              {classroomsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader className="h-6 w-6 animate-spin text-indigo-500" />
                </div>
              ) : classrooms.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">
                  You are not a member of any classrooms.
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {classrooms.map((cls) => {
                    const id = cls.id || cls._id;
                    return (
                      <button
                        key={id}
                        onClick={() => handleSelectClassroom(cls)}
                        className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-300 rounded-xl transition-colors text-left group"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">{cls.name}</p>
                          {cls.description && (
                            <p className="text-xs text-gray-500 truncate max-w-xs">{cls.description}</p>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-indigo-500" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div>
              {/* Breadcrumb */}
              <div className="flex items-center space-x-1 text-xs text-gray-500 mb-3">
                <button
                  onClick={() => { setStep(1); setSelectedRoom(null); }}
                  className="hover:text-indigo-600 transition-colors"
                >
                  {selectedClassroom?.name}
                </button>
                <ChevronRight className="h-3 w-3" />
                <span className="text-gray-700">Pick a room</span>
              </div>

              {roomsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader className="h-6 w-6 animate-spin text-indigo-500" />
                </div>
              ) : rooms.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">
                  No rooms found in this classroom.
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {rooms.map((room) => {
                    const rid = room.id || room._id;
                    const isSelected = (selectedRoom?.id || selectedRoom?._id) === rid;
                    return (
                      <button
                        key={rid}
                        onClick={() => handleSelectRoom(room)}
                        className={`w-full flex items-center justify-between p-3 border rounded-xl transition-colors text-left ${
                          isSelected
                            ? 'bg-indigo-50 border-indigo-400 ring-1 ring-indigo-300'
                            : 'bg-gray-50 border-gray-200 hover:bg-indigo-50 hover:border-indigo-300'
                        }`}
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">#{room.name}</p>
                          {room.description && (
                            <p className="text-xs text-gray-500 truncate">{room.description}</p>
                          )}
                        </div>
                        {isSelected && <Check className="h-4 w-4 text-indigo-600" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions (only for steps 1 and 2) */}
        {step !== 3 && (
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            {step === 2 && (
              <button
                onClick={handleConfirm}
                disabled={!selectedRoom || shareMutation.isLoading}
                className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center space-x-1.5"
              >
                {shareMutation.isLoading ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <Share2 className="h-4 w-4" />
                )}
                <span>Share</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ShareNoteModal;
