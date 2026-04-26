import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Library,
  Plus,
  Trash2,
  Send,
  Loader2,
  BookOpen,
  Sparkles,
  Search,
  Clock,
} from 'lucide-react';
import { resourcesAPI } from '../utils/api';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import Button from '../components/Button';

// ─── Constants ──────────────────────────────────────────────────────────────

const STARTER_PROMPTS = [
  'Recommend resources for learning machine learning from scratch',
  'Find research papers on transformer architectures',
  'Best free courses for data structures and algorithms',
  'Textbooks for linear algebra used in AI',
  'YouTube playlists for web development beginners',
];

// ─── Sub-components ──────────────────────────────────────────────────────────

const SessionCard = ({ session, isActive, onClick, onDelete }) => (
  <div
    onClick={onClick}
    className={`group relative p-3 rounded-lg cursor-pointer transition-all border ${
      isActive
        ? 'bg-indigo-50 border-indigo-200'
        : 'bg-white border-gray-100 hover:bg-gray-50 hover:border-gray-200'
    }`}
  >
    <p className={`text-sm font-medium truncate pr-6 ${isActive ? 'text-indigo-800' : 'text-gray-800'}`}>
      {session.session_name}
    </p>
    <div className="flex items-center mt-1 space-x-1 text-xs text-gray-400">
      <Clock className="h-3 w-3" />
      <span>{new Date(session.updated_at).toLocaleDateString()}</span>
    </div>
    <button
      onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all"
      title="Delete session"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  </div>
);

const TypingIndicator = () => (
  <div className="flex justify-start mb-4">
    <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm flex items-center space-x-1.5">
      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  </div>
);

// ─── Main Component ──────────────────────────────────────────────────────────

const ResourcesPage = () => {
  const queryClient = useQueryClient();

  // State
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showNewTopicInput, setShowNewTopicInput] = useState(false);
  const [newTopic, setNewTopic] = useState('');

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery(
    ['resourceSessions'],
    () => resourcesAPI.getSessions().then(r => r.data),
    {
      onError: () => toast.error('Failed to load sessions'),
    }
  );

  // When switching sessions, load their messages
  useEffect(() => {
    if (activeSession) {
      setMessages(activeSession.messages || []);
    }
  }, [activeSession?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mutations ────────────────────────────────────────────────────────────

  const createSessionMutation = useMutation(
    (data) => resourcesAPI.createSession(data),
    {
      onSuccess: (res) => {
        queryClient.invalidateQueries(['resourceSessions']);
        setActiveSession(res.data);
        setMessages([]);
        setShowNewTopicInput(false);
        setNewTopic('');
        toast.success('New session created');
      },
      onError: () => toast.error('Failed to create session'),
    }
  );

  const deleteSessionMutation = useMutation(
    (id) => resourcesAPI.deleteSession(id),
    {
      onSuccess: (_, deletedId) => {
        queryClient.invalidateQueries(['resourceSessions']);
        if (activeSession?.id === deletedId) {
          setActiveSession(null);
          setMessages([]);
        }
        toast.success('Session deleted');
      },
      onError: () => toast.error('Failed to delete session'),
    }
  );

  const recommendMutation = useMutation(
    ({ sessionId, query }) => resourcesAPI.getRecommendations(sessionId, query),
    {
      onSuccess: (res) => {
        const { ai_response } = res.data;
        setMessages(prev => [...prev, { role: 'assistant', content: ai_response, timestamp: new Date().toISOString() }]);
        setIsTyping(false);
        queryClient.invalidateQueries(['resourceSessions']);
      },
      onError: () => {
        toast.error('Failed to get recommendations');
        setIsTyping(false);
      },
    }
  );

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleCreateSession = (e) => {
    e.preventDefault();
    const topic = newTopic.trim();
    if (!topic) return;
    createSessionMutation.mutate({ topic, session_name: topic.slice(0, 50) });
  };

  const handleSend = useCallback((query) => {
    const text = (query || inputValue).trim();
    if (!text || !activeSession) return;

    // Optimistic user message
    setMessages(prev => [...prev, { role: 'user', content: text, timestamp: new Date().toISOString() }]);
    setInputValue('');
    setIsTyping(true);

    recommendMutation.mutate({ sessionId: activeSession.id, query: text });
  }, [inputValue, activeSession, recommendMutation]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full min-h-0 overflow-hidden" style={{ height: 'calc(100vh - 4rem)' }}>

      {/* ── Left Sidebar ─────────────────────────────────────────────────── */}
      <div className="w-64 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center space-x-2 mb-3">
            <div className="p-1.5 bg-indigo-100 rounded-lg">
              <Library className="h-5 w-5 text-indigo-600" />
            </div>
            <h2 className="text-sm font-semibold text-gray-900">Resources</h2>
          </div>
          <Button
            onClick={() => setShowNewTopicInput(true)}
            size="sm"
            className="w-full justify-center"
            leftIcon={<Plus className="h-4 w-4" />}
          >
            New Search
          </Button>
        </div>

        {/* New Topic Input */}
        <AnimatePresence>
          {showNewTopicInput && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-b border-gray-100"
            >
              <form onSubmit={handleCreateSession} className="p-3">
                <input
                  autoFocus
                  type="text"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  placeholder="What topic to explore?"
                  className="input text-sm w-full mb-2"
                  onKeyDown={(e) => e.key === 'Escape' && setShowNewTopicInput(false)}
                />
                <div className="flex space-x-2">
                  <Button
                    type="submit"
                    size="sm"
                    className="flex-1 justify-center"
                    disabled={!newTopic.trim() || createSessionMutation.isLoading}
                    isLoading={createSessionMutation.isLoading}
                  >
                    Create
                  </Button>
                  <button
                    type="button"
                    onClick={() => setShowNewTopicInput(false)}
                    className="px-3 text-sm text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessionsLoading ? (
            <div className="flex justify-center pt-8"><LoadingSpinner size="sm" /></div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 px-4">
              <BookOpen className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-400">No sessions yet. Start a new search!</p>
            </div>
          ) : (
            sessions.map(s => (
              <SessionCard
                key={s.id}
                session={s}
                isActive={activeSession?.id === s.id}
                onClick={() => setActiveSession(s)}
                onDelete={(id) => deleteSessionMutation.mutate(id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Right Chat Area ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col h-full min-h-0 bg-gray-50">

        {!activeSession ? (
          /* ── Welcome / Landing ─────────────────────────────────────────── */
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-xl w-full text-center"
            >
              <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Library className="h-8 w-8 text-indigo-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Literature & Resource Finder</h1>
              <p className="text-gray-500 mb-8 text-sm leading-relaxed">
                Ask me about any topic and I'll find research papers, free textbooks, video courses,
                and lecture notes tailored to your needs.
              </p>

              <div className="space-y-2 text-left">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Try asking…</p>
                {STARTER_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      const topic = p.slice(0, 50);
                      createSessionMutation.mutate(
                        { topic, session_name: topic },
                        { onSuccess: (res) => { setActiveSession(res.data); setInputValue(p); } }
                      );
                    }}
                    className="w-full text-left px-4 py-3 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-800 transition-all flex items-center space-x-3 group"
                  >
                    <Search className="h-4 w-4 text-gray-400 group-hover:text-indigo-500 flex-shrink-0" />
                    <span>{p}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        ) : (
          /* ── Active Chat ───────────────────────────────────────────────── */
          <>
            {/* Session header */}
            <div className="px-6 py-3 border-b border-gray-200 bg-white flex items-center space-x-3 flex-shrink-0">
              <div className="p-1.5 bg-indigo-100 rounded-lg">
                <Sparkles className="h-4 w-4 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">{activeSession.session_name}</h2>
                <p className="text-xs text-gray-400">{activeSession.topic}</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0">
              {messages.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <BookOpen className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">Ask anything about <strong className="text-gray-600">{activeSession.topic}</strong></p>
                </div>
              )}

              <AnimatePresence initial={false}>
                {messages.map((msg, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'user' ? (
                      <div className="max-w-md px-4 py-2.5 rounded-2xl rounded-br-none bg-indigo-600 text-white text-sm shadow-sm">
                        {msg.content}
                      </div>
                    ) : (
                      <div className="max-w-2xl bg-white border border-gray-200 rounded-2xl rounded-bl-none p-5 shadow-sm">
                        <div
                          className="text-sm text-gray-800 resources-html-content leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: msg.content }}
                          style={{
                            lineHeight: '1.65',
                          }}
                        />
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {isTyping && <TypingIndicator />}
              <div ref={chatEndRef} />
            </div>

            {/* Input bar */}
            <div className="border-t border-gray-200 bg-white p-4 flex-shrink-0">
              <div className="flex items-end space-x-3">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a follow-up or new question…"
                  rows={1}
                  className="input flex-1 resize-none text-sm py-2.5"
                  style={{ minHeight: '42px', maxHeight: '120px' }}
                />
                <Button
                  onClick={() => handleSend()}
                  disabled={!inputValue.trim() || isTyping}
                  isLoading={isTyping}
                  size="md"
                  className="flex-shrink-0"
                >
                  {!isTyping && <Send className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">Press Enter to send · Shift+Enter for new line</p>
            </div>
          </>
        )}
      </div>

      {/* ── Inline styles for AI-returned HTML ─── */}
      <style>{`
        .resources-html-content h2 { font-size: 1.1rem; font-weight: 700; color: #1e293b; margin: 0 0 0.75rem; }
        .resources-html-content h3 { font-size: 0.9rem; font-weight: 600; color: #4338ca; margin: 1rem 0 0.4rem; border-bottom: 1px solid #e0e7ff; padding-bottom: 0.25rem; }
        .resources-html-content ul, .resources-html-content ol { padding-left: 1.25rem; margin: 0.3rem 0 0.75rem; }
        .resources-html-content li { margin-bottom: 0.4rem; }
        .resources-html-content a { color: #4f46e5; text-decoration: underline; text-underline-offset: 2px; }
        .resources-html-content a:hover { color: #3730a3; }
        .resources-html-content strong { font-weight: 600; color: #1e293b; }
        .resources-html-content p { margin: 0.3rem 0; }
      `}</style>
    </div>
  );
};

export default ResourcesPage;
