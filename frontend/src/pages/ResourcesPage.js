import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Library, Plus, Trash2, Send, Loader2, BookOpen,
  Sparkles, Search, Clock, FlaskConical, GraduationCap,
  Youtube, BookMarked, Zap, ChevronRight,
} from 'lucide-react';
import { resourcesAPI } from '../utils/api';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import Button from '../components/Button';

// ─── Constants ───────────────────────────────────────────────────────────────

const STARTER_PROMPTS = [
  { icon: FlaskConical,  text: 'Recommend resources for learning machine learning from scratch', color: 'text-violet-500 dark:text-violet-400' },
  { icon: Search,        text: 'Find research papers on transformer architectures',              color: 'text-blue-500 dark:text-blue-400'   },
  { icon: GraduationCap, text: 'Best free courses for data structures and algorithms',           color: 'text-emerald-500 dark:text-emerald-400' },
  { icon: BookMarked,    text: 'Textbooks for linear algebra used in AI',                        color: 'text-amber-500 dark:text-amber-400'  },
  { icon: Youtube,       text: 'YouTube playlists for web development beginners',                color: 'text-red-500 dark:text-red-400'      },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

const SessionCard = ({ session, isActive, onClick, onDelete }) => (
  <div
    onClick={onClick}
    className={`group relative p-3 rounded-xl cursor-pointer transition-all border ${
      isActive
        ? 'bg-indigo-50 dark:bg-indigo-600/20 border-indigo-300 dark:border-indigo-500/40'
        : 'border-transparent hover:bg-gray-100 dark:hover:bg-gray-800/60 hover:border-gray-200 dark:hover:border-gray-700/60'
    }`}
  >
    <p className={`text-sm font-medium truncate pr-6 ${isActive ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-800 dark:text-gray-300'}`}>
      {session.session_name}
    </p>
    <div className="flex items-center mt-1 space-x-1 text-xs text-gray-400 dark:text-gray-500">
      <Clock className="h-3 w-3" />
      <span>{new Date(session.updated_at).toLocaleDateString()}</span>
    </div>
    <button
      onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-all"
      title="Delete session"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  </div>
);

const TypingIndicator = () => (
  <div className="flex justify-start mb-4">
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm flex items-center space-x-1.5">
      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  </div>
);

// ─── Main Component ──────────────────────────────────────────────────────────

const ResourcesPage = () => {
  const queryClient = useQueryClient();
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showNewTopicInput, setShowNewTopicInput] = useState(false);
  const [newTopic, setNewTopic] = useState('');

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTyping]);

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery(
    ['resourceSessions'],
    () => resourcesAPI.getSessions().then(r => r.data),
    { onError: () => toast.error('Failed to load sessions') }
  );

  useEffect(() => {
    if (activeSession) setMessages(activeSession.messages || []);
  }, [activeSession?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const createSessionMutation = useMutation(
    (data) => resourcesAPI.createSession(data),
    {
      onSuccess: (res) => {
        queryClient.invalidateQueries(['resourceSessions']);
        setActiveSession(res.data); setMessages([]);
        setShowNewTopicInput(false); setNewTopic('');
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
        if (activeSession?.id === deletedId) { setActiveSession(null); setMessages([]); }
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
      onError: () => { toast.error('Failed to get recommendations'); setIsTyping(false); },
    }
  );

  const handleCreateSession = (e) => {
    e.preventDefault();
    const topic = newTopic.trim();
    if (!topic) return;
    createSessionMutation.mutate({ topic, session_name: topic.slice(0, 50) });
  };

  const handleSend = useCallback((query) => {
    const text = (query || inputValue).trim();
    if (!text || !activeSession) return;
    setMessages(prev => [...prev, { role: 'user', content: text, timestamp: new Date().toISOString() }]);
    setInputValue('');
    setIsTyping(true);
    recommendMutation.mutate({ sessionId: activeSession.id, query: text });
  }, [inputValue, activeSession, recommendMutation]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-gray-50 dark:bg-gray-950">

      {/* ── Left Sidebar ─────────────────────────────────────────────────── */}
      <div className="w-64 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800/60">
          <div className="flex items-center space-x-2.5 mb-4">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/30 rounded-xl">
              <Library className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Resources</h2>
          </div>
          <button
            onClick={() => setShowNewTopicInput(v => !v)}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-indigo-900/20"
          >
            <Plus className="h-4 w-4" />
            <span>New Search</span>
          </button>
        </div>

        {/* New Topic Input */}
        <AnimatePresence>
          {showNewTopicInput && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-b border-gray-200 dark:border-gray-800/60"
            >
              <form onSubmit={handleCreateSession} className="p-3">
                <input
                  autoFocus type="text" value={newTopic} onChange={e => setNewTopic(e.target.value)}
                  placeholder="What topic to explore?"
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
                  onKeyDown={e => e.key === 'Escape' && setShowNewTopicInput(false)}
                />
                <div className="flex space-x-2">
                  <button type="submit" disabled={!newTopic.trim() || createSessionMutation.isLoading}
                    className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm rounded-lg transition-colors flex items-center justify-center">
                    {createSessionMutation.isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Create'}
                  </button>
                  <button type="button" onClick={() => setShowNewTopicInput(false)}
                    className="px-3 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Cancel</button>
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
            <div className="text-center py-10 px-4">
              <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
                <BookOpen className="h-5 w-5 text-gray-400 dark:text-gray-600" />
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500">No sessions yet.<br />Start a new search!</p>
            </div>
          ) : (
            sessions.map(s => (
              <SessionCard
                key={s.id} session={s} isActive={activeSession?.id === s.id}
                onClick={() => setActiveSession(s)}
                onDelete={(id) => deleteSessionMutation.mutate(id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Right Chat Area ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col h-full min-h-0 bg-gray-50 dark:bg-gray-950">

        {!activeSession ? (
          /* ── Welcome / Landing ─────────────────────────────────────────── */
          <div className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden">
            {/* Light mode subtle gradient / Dark mode ambient glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/60 via-transparent to-violet-50/40 dark:from-indigo-950/40 dark:via-gray-950 dark:to-violet-950/30 pointer-events-none" />
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-500/5 dark:bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />

            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="relative max-w-2xl w-full text-center z-10"
            >
              {/* Icon */}
              <div className="relative inline-flex mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-300/30 dark:shadow-indigo-900/50">
                  <Library className="h-10 w-10 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                  <Sparkles className="h-3 w-3 text-white" />
                </div>
              </div>

              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
                Literature &{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400">
                  Resource Finder
                </span>
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm leading-relaxed max-w-md mx-auto">
                Ask me about any topic and I'll find{' '}
                <span className="text-indigo-600 dark:text-indigo-400">research papers</span>,{' '}
                <span className="text-violet-600 dark:text-violet-400">free textbooks</span>,{' '}
                <span className="text-blue-600 dark:text-blue-400">video courses</span>, and lecture notes tailored to your needs.
              </p>

              {/* Stats row */}
              <div className="flex items-center justify-center gap-8 mb-8">
                {[['Research Papers','arXiv & Scholar'],['Video Courses','YouTube & MOOCs'],['Textbooks','Free & Legal']].map(([title, sub]) => (
                  <div key={title} className="text-center">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{title}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{sub}</p>
                  </div>
                ))}
              </div>

              {/* Starter prompts */}
              <div className="space-y-2 text-left">
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 text-center">Try asking…</p>
                <div className="grid grid-cols-1 gap-2">
                  {STARTER_PROMPTS.map(({ icon: Icon, text, color }) => (
                    <button
                      key={text}
                      onClick={() => {
                        const topic = text.slice(0, 50);
                        createSessionMutation.mutate(
                          { topic, session_name: topic },
                          { onSuccess: (res) => { setActiveSession(res.data); setInputValue(text); } }
                        );
                      }}
                      className="w-full text-left px-4 py-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-indigo-400 dark:hover:border-indigo-600/50 hover:bg-indigo-50/50 dark:hover:bg-gray-800/80 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-all flex items-center space-x-3 group shadow-sm"
                    >
                      <Icon className={`h-4 w-4 ${color} flex-shrink-0 transition-transform group-hover:scale-110`} />
                      <span className="flex-1">{text}</span>
                      <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 transition-colors flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        ) : (
          /* ── Active Chat ───────────────────────────────────────────────── */
          <>
            {/* Session header */}
            <div className="px-6 py-3.5 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/80 backdrop-blur-sm flex items-center space-x-3 flex-shrink-0">
              <div className="p-1.5 bg-indigo-100 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/30 rounded-lg">
                <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{activeSession.session_name}</h2>
                <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{activeSession.topic}</p>
              </div>
              <div className="flex items-center space-x-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-gray-400 dark:text-gray-500">AI Ready</span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 min-h-0">
              {messages.length === 0 && (
                <div className="text-center py-16">
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center mx-auto mb-4">
                    <Zap className="h-7 w-7 text-indigo-500 dark:text-indigo-400" />
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">Ask anything about <span className="text-indigo-600 dark:text-indigo-400 font-medium">{activeSession.topic}</span></p>
                  <p className="text-gray-400 dark:text-gray-600 text-xs mt-1">I'll find papers, books, and courses for you</p>
                </div>
              )}

              <AnimatePresence initial={false}>
                {messages.map((msg, idx) => (
                  <motion.div
                    key={idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'user' ? (
                      <div className="max-w-md px-4 py-3 rounded-2xl rounded-br-none bg-gradient-to-br from-indigo-600 to-indigo-700 text-white text-sm shadow-lg shadow-indigo-200/50 dark:shadow-indigo-900/30 leading-relaxed">
                        {msg.content}
                      </div>
                    ) : (
                      <div className="max-w-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl rounded-bl-none p-5 shadow-sm">
                        {/* AI badge */}
                        <div className="flex items-center space-x-2 mb-3 pb-3 border-b border-gray-100 dark:border-gray-800">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                            <Sparkles className="h-3 w-3 text-white" />
                          </div>
                          <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">AI Resource Finder</span>
                        </div>
                        <div
                          className="text-sm text-gray-800 dark:text-gray-300 resources-html-content leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: msg.content }}
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
            <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/80 backdrop-blur-sm p-4 flex-shrink-0">
              <div className="flex items-end space-x-3">
                <div className="flex-1 relative">
                  <textarea
                    ref={inputRef}
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask a follow-up or new question…"
                    rows={1}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 focus:border-indigo-500 dark:focus:border-indigo-500 rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none transition-colors"
                    style={{ minHeight: '46px', maxHeight: '120px' }}
                  />
                </div>
                <button
                  onClick={() => handleSend()}
                  disabled={!inputValue.trim() || isTyping}
                  className="p-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-lg shadow-indigo-200/50 dark:shadow-indigo-900/30 flex-shrink-0"
                >
                  {isTyping
                    ? <Loader2 className="h-5 w-5 animate-spin" />
                    : <Send className="h-5 w-5" />
                  }
                </button>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-2">Press Enter to send · Shift+Enter for new line</p>
            </div>
          </>
        )}
      </div>

      {/* ── AI HTML content styles (light + dark) ─── */}
      <style>{`
        .resources-html-content h2 { font-size: 1rem; font-weight: 700; color: #1e293b; margin: 0 0 0.75rem; }
        .resources-html-content h3 { font-size: 0.875rem; font-weight: 600; color: #4f46e5; margin: 1rem 0 0.4rem; border-bottom: 1px solid #e0e7ff; padding-bottom: 0.3rem; }
        .resources-html-content ul, .resources-html-content ol { padding-left: 1.25rem; margin: 0.3rem 0 0.75rem; }
        .resources-html-content li { margin-bottom: 0.45rem; }
        .resources-html-content a { color: #4f46e5; text-decoration: underline; text-underline-offset: 2px; }
        .resources-html-content a:hover { color: #3730a3; }
        .resources-html-content strong { font-weight: 600; color: #1e293b; }
        .resources-html-content p { margin: 0.3rem 0; }

        .dark .resources-html-content h2 { color: #e2e8f0; }
        .dark .resources-html-content h3 { color: #818cf8; border-bottom-color: rgba(99,102,241,0.2); }
        .dark .resources-html-content li { color: #cbd5e1; }
        .dark .resources-html-content a { color: #818cf8; }
        .dark .resources-html-content a:hover { color: #a5b4fc; }
        .dark .resources-html-content strong { color: #e2e8f0; }
        .dark .resources-html-content p { color: #cbd5e1; }
      `}</style>
    </div>
  );
};

export default ResourcesPage;
