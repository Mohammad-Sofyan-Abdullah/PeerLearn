import React from 'react';
import { useQuery } from 'react-query';
import { BookOpen, Loader2 } from 'lucide-react';
import { resourcesAPI } from '../utils/api';

/**
 * FurtherReadingSection
 * ─────────────────────
 * Asynchronously fetches and renders AI resource recommendations
 * for a given topic. Designed to be appended below a document summary
 * without blocking the summary from rendering.
 *
 * Uses the stateless GET /resources/quick?topic= endpoint so no session
 * is created and no auth is required for caching purposes.
 *
 * Props:
 *   topic  {string}  – The document title or topic to search for.
 */
const FurtherReadingSection = ({ topic }) => {
  const { data, isLoading, isError } = useQuery(
    ['furtherReading', topic],
    () => resourcesAPI.quickRecommendation(topic).then(r => r.data),
    {
      enabled: !!topic && topic.trim().length > 0,
      staleTime: 1000 * 60 * 10, // 10 minutes — aggressive caching
      retry: 1,
    }
  );

  if (!topic) return null;

  return (
    <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-5">
      <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center">
        <BookOpen className="h-4 w-4 mr-2 text-indigo-500" />
        Further Reading
      </h3>

      {isLoading && (
        <div className="flex items-center space-x-2 text-sm text-gray-400 py-3">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Finding related resources…</span>
        </div>
      )}

      {isError && (
        <p className="text-sm text-gray-400 italic">
          Could not load resource recommendations at this time.
        </p>
      )}

      {data?.content && (
        <div
          className="text-sm text-gray-700 dark:text-gray-300 further-reading-html leading-relaxed"
          dangerouslySetInnerHTML={{ __html: data.content }}
        />
      )}

      {/* Scoped styles for AI-returned HTML */}
      <style>{`
        .further-reading-html h2 { font-size: 1rem; font-weight: 700; color: #1e293b; margin: 0.5rem 0 0.5rem; }
        .dark .further-reading-html h2 { color: #f8fafc; }
        .further-reading-html h3 { font-size: 0.85rem; font-weight: 600; color: #4338ca; margin: 0.8rem 0 0.3rem; padding-bottom: 0.2rem; border-bottom: 1px solid #e0e7ff; }
        .dark .further-reading-html h3 { color: #a5b4fc; border-bottom-color: #374151; }
        .further-reading-html ul, .further-reading-html ol { padding-left: 1.2rem; margin: 0.25rem 0 0.6rem; }
        .further-reading-html li { margin-bottom: 0.3rem; }
        .further-reading-html a { color: #4f46e5; text-decoration: underline; text-underline-offset: 2px; }
        .dark .further-reading-html a { color: #818cf8; }
        .further-reading-html a:hover { color: #3730a3; }
        .dark .further-reading-html a:hover { color: #c7d2fe; }
        .further-reading-html strong { font-weight: 600; color: #1e293b; }
        .dark .further-reading-html strong { color: #f8fafc; }
        .further-reading-html p { margin: 0.2rem 0; }
      `}</style>
    </div>
  );
};

export default FurtherReadingSection;
