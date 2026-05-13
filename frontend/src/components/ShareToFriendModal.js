import React, { useState } from 'react';
import { useQuery, useMutation } from 'react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Share2, Send, Search, Check, Youtube, FileText, BookOpen, MessageSquare, Layers, Users } from 'lucide-react';
import { friendsAPI, messagesAPI, classroomsAPI, chatAPI } from '../utils/api';
import toast from 'react-hot-toast';

/**
 * ShareToFriendModal - Share content to friends OR classrooms
 */
const ShareToFriendModal = ({ isOpen, onClose, contentType, contentData }) => {
    const [tab, setTab] = useState('friends');
    const [selectedFriends, setSelectedFriends] = useState([]);
    const [selectedClassrooms, setSelectedClassrooms] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [customMessage, setCustomMessage] = useState('');
    const [isSharing, setIsSharing] = useState(false);

    // ── Friends ──────────────────────────────────────────────────────────────
    const { data: friends = [], isLoading: friendsLoading } = useQuery(
        'friends-for-sharing',
        () => friendsAPI.getFriends().then(res => res.data),
        { enabled: isOpen }
    );

    const filteredFriends = friends.filter(f => {
        const name = (f.name || f.full_name || '').toLowerCase();
        const email = (f.email || '').toLowerCase();
        const q = searchQuery.toLowerCase();
        return name.includes(q) || email.includes(q);
    });

    const shareMutation = useMutation(
        ({ friendId, content }) => messagesAPI.shareContent(friendId, content),
        {
            onError: () => toast.error('Failed to share to some friends'),
        }
    );

    const handleShareToFriends = async () => {
        if (selectedFriends.length === 0) return toast.error('Select at least one friend');
        setIsSharing(true);
        try {
            for (const friendId of selectedFriends) {
                await shareMutation.mutateAsync({
                    friendId,
                    content: { content_type: contentType, message: customMessage, ...contentData }
                });
            }
            toast.success(`Shared to ${selectedFriends.length} friend${selectedFriends.length > 1 ? 's' : ''}!`);
            setSelectedFriends([]);
            setCustomMessage('');
            onClose();
        } finally {
            setIsSharing(false);
        }
    };

    const [expandedClassroom, setExpandedClassroom] = useState(null); // ID of classroom whose rooms are shown
    const [classroomRooms, setClassroomRooms] = useState({}); // classroomId -> rooms array
    const [selectedRoomId, setSelectedRoomId] = useState(''); // Selected room to share to

    // ── Classrooms ────────────────────────────────────────────────────────────
    const { data: classrooms = [], isLoading: classroomsLoading } = useQuery(
        'classrooms-for-sharing',
        () => classroomsAPI.getClassrooms().then(res => {
            // Handle both array and object-with-array responses
            const data = res.data;
            if (Array.isArray(data)) return data;
            if (data && Array.isArray(data.classrooms)) return data.classrooms;
            if (data && Array.isArray(data.results)) return data.results;
            return [];
        }),
        { enabled: isOpen && tab === 'classrooms' }
    );

    const filteredClassrooms = classrooms.filter(c =>
        (c.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const loadRoomsForClassroom = async (classroomId) => {
        if (expandedClassroom === classroomId) {
            setExpandedClassroom(null); // toggle off
            return;
        }
        setExpandedClassroom(classroomId);
        if (!classroomRooms[classroomId]) {
            try {
                const res = await classroomsAPI.getRooms(classroomId);
                const rooms = Array.isArray(res.data) ? res.data : (res.data?.rooms || []);
                setClassroomRooms(prev => ({ ...prev, [classroomId]: rooms }));
            } catch (err) {
                toast.error("Failed to load rooms");
            }
        }
    };

    const handleShareToClassrooms = async () => {
        if (!selectedRoomId) return toast.error('Please select a room to share in');
        setIsSharing(true);
        try {
            const shareText = `📎 *Shared: ${contentData?.title || 'Content'}*\n${customMessage || ''}\n${contentData?.source_url || ''}`.trim();
            await chatAPI.sendMessage(selectedRoomId, { 
                content: shareText, 
                message_type: 'shared_content',
                shared_content: { content_type: contentType, ...contentData }
            });
            toast.success(`Shared to classroom room!`);
            setSelectedRoomId('');
            setExpandedClassroom(null);
            setCustomMessage('');
            onClose();
        } catch (err) {
            console.error('Classroom share error:', err);
            toast.error('Failed to share to classroom');
        } finally {
            setIsSharing(false);
        }
    };

    // ── Helpers ───────────────────────────────────────────────────────────────
    const getIcon = () => {
        switch (contentType) {
            case 'youtube_summary': case 'youtube_video': return <Youtube className="w-5 h-5 text-red-500" />;
            case 'flashcards': return <BookOpen className="w-5 h-5 text-purple-500" />;
            case 'slides': return <Layers className="w-5 h-5 text-blue-500" />;
            case 'notes': return <FileText className="w-5 h-5 text-green-500" />;
            case 'ai_chat': return <MessageSquare className="w-5 h-5 text-indigo-500" />;
            default: return <Share2 className="w-5 h-5 text-gray-500" />;
        }
    };

    const getLabel = () => {
        switch (contentType) {
            case 'youtube_summary': return 'YouTube Summary';
            case 'youtube_video': return 'YouTube Video';
            case 'flashcards': return 'Flashcards';
            case 'slides': return 'Slides';
            case 'notes': return 'Notes';
            case 'ai_chat': return 'AI Chat';
            default: return 'Content';
        }
    };

    const reset = () => {
        setTab('friends');
        setSelectedFriends([]);
        setSelectedClassrooms([]);
        setSearchQuery('');
        setCustomMessage('');
        setExpandedClassroom(null);
        setSelectedRoomId('');
    };

    if (!isOpen) return null;

    const selectedCount = tab === 'friends' ? selectedFriends.length : (selectedRoomId ? 1 : 0);

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                onClick={(e) => { if (e.target === e.currentTarget) { reset(); onClose(); } }}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-700"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-2">
                            <Share2 className="w-5 h-5 text-blue-500" />
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Share Content</h2>
                        </div>
                        <button onClick={() => { reset(); onClose(); }}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                        </button>
                    </div>

                    {/* Content Preview */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-start gap-3">
                            {contentData?.preview_image_url ? (
                                <img src={contentData.preview_image_url} alt={contentData.title}
                                    className="w-20 h-14 object-cover rounded-lg flex-shrink-0" />
                            ) : (
                                <div className="w-20 h-14 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/40 dark:to-purple-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
                                    {getIcon()}
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    {getIcon()}
                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{getLabel()}</span>
                                </div>
                                <h3 className="font-medium text-gray-900 dark:text-white text-sm truncate">{contentData?.title}</h3>
                                {contentData?.description && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">{contentData.description}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Tab Toggle */}
                    <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                        <button
                            onClick={() => { setTab('friends'); setSearchQuery(''); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                                tab === 'friends'
                                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500 bg-white dark:bg-gray-800'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                            }`}
                        >
                            <Share2 className="w-4 h-4" />
                            Friends
                            {selectedFriends.length > 0 && (
                                <span className="ml-1 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                    {selectedFriends.length}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => { setTab('classrooms'); setSearchQuery(''); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                                tab === 'classrooms'
                                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500 bg-white dark:bg-gray-800'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                            }`}
                        >
                            <Users className="w-4 h-4" />
                            Classrooms
                            {selectedClassrooms.length > 0 && (
                                <span className="ml-1 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                    {selectedClassrooms.length}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Search */}
                    <div className="p-4 pb-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder={tab === 'friends' ? 'Search friends...' : 'Search classrooms...'}
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                        </div>
                    </div>

                    {/* List */}
                    <div className="max-h-52 overflow-y-auto px-4 pb-2">
                        {tab === 'friends' ? (
                            friendsLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
                                </div>
                            ) : filteredFriends.length === 0 ? (
                                <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                                    {searchQuery ? 'No friends found' : 'No friends yet'}
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    {filteredFriends.map(friend => {
                                        const id = friend.id || friend._id;
                                        const name = friend.name || friend.full_name || 'Friend';
                                        const selected = selectedFriends.includes(id);
                                        return (
                                            <button key={id}
                                                onClick={() => setSelectedFriends(prev =>
                                                    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
                                                )}
                                                className={`w-full flex items-center gap-3 p-2.5 rounded-lg border-2 transition-all ${
                                                    selected ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500' : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                                }`}
                                            >
                                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 ${
                                                    selected ? 'bg-gradient-to-br from-blue-500 to-blue-600' : 'bg-gradient-to-br from-gray-400 to-gray-500'
                                                }`}>
                                                    {name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex-1 text-left">
                                                    <h4 className="font-medium text-gray-900 dark:text-white text-sm">{name}</h4>
                                                    {friend.email && <p className="text-xs text-gray-500 dark:text-gray-400">{friend.email}</p>}
                                                </div>
                                                {selected && (
                                                    <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                                                        <Check className="w-3 h-3 text-white" />
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )
                        ) : (
                            classroomsLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
                                </div>
                            ) : filteredClassrooms.length === 0 ? (
                                <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                                    {searchQuery ? 'No classrooms found' : classrooms.length === 0 ? 'No classrooms joined yet' : 'No classrooms match your search'}
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    {filteredClassrooms.map(classroom => {
                                        const id = classroom.id || classroom._id;
                                        const isExpanded = expandedClassroom === id;
                                        const rooms = classroomRooms[id] || [];
                                        const memberCount = classroom.member_count || classroom.members?.length || 0;
                                        return (
                                            <div key={id} className="w-full">
                                                <button
                                                    onClick={() => loadRoomsForClassroom(id)}
                                                    className={`w-full flex items-center justify-between p-2.5 rounded-lg border-2 transition-all ${
                                                        isExpanded ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500' : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                                            isExpanded ? 'bg-blue-500' : 'bg-gradient-to-br from-indigo-400 to-purple-500'
                                                        }`}>
                                                            <Users className="w-4 h-4 text-white" />
                                                        </div>
                                                        <div className="flex-1 text-left">
                                                            <h4 className="font-medium text-gray-900 dark:text-white text-sm">{classroom.name}</h4>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                {memberCount > 0 ? `${memberCount} member${memberCount !== 1 ? 's' : ''}` : 'Classroom'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {isExpanded ? (
                                                        <span className="text-xs text-blue-600 dark:text-blue-400 font-medium mr-2">Rooms ▼</span>
                                                    ) : (
                                                        <span className="text-xs text-gray-400 dark:text-gray-500 mr-2">Rooms ▶</span>
                                                    )}
                                                </button>
                                                {isExpanded && (
                                                    <div className="mt-2 ml-4 pl-4 border-l-2 border-gray-100 dark:border-gray-700 space-y-1.5">
                                                        {rooms.length === 0 ? (
                                                            <div className="text-xs text-gray-500 py-1">No rooms found</div>
                                                        ) : (
                                                            rooms.map(room => {
                                                                const rId = room.id || room._id;
                                                                const isSelected = selectedRoomId === rId;
                                                                return (
                                                                    <button
                                                                        key={rId}
                                                                        onClick={() => setSelectedRoomId(rId)}
                                                                        className={`w-full flex items-center justify-between p-2 rounded-md transition-colors ${
                                                                            isSelected ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                                                        }`}
                                                                    >
                                                                        <span className="text-sm"># {room.name}</span>
                                                                        {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                                                                    </button>
                                                                );
                                                            })
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )
                        )}
                    </div>

                    {/* Custom Message */}
                    <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                        <input
                            type="text"
                            value={customMessage}
                            onChange={e => setCustomMessage(e.target.value)}
                            placeholder="Add a message (optional)..."
                            className="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                {selectedCount} {tab === 'friends'
                                    ? `friend${selectedCount !== 1 ? 's' : ''}`
                                    : `classroom${selectedCount !== 1 ? 's' : ''}`} selected
                            </span>
                            <button
                                onClick={tab === 'friends' ? handleShareToFriends : handleShareToClassrooms}
                                disabled={selectedCount === 0 || isSharing}
                                className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                            >
                                {isSharing ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                ) : (
                                    <Send className="w-4 h-4" />
                                )}
                                Share
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default ShareToFriendModal;
