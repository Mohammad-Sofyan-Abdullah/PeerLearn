import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const MarkdownRenderer = ({ content, className = '' }) => {
  if (!content) return null;
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, ...props }) => (
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3 mt-4" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2 mt-3" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-2 mt-3" {...props} />
          ),
          p: ({ node, ...props }) => (
            <p className="text-gray-700 dark:text-gray-300 mb-3 leading-relaxed" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="list-disc list-inside space-y-1 mb-3 text-gray-700 dark:text-gray-300 pl-2" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal list-inside space-y-1 mb-3 text-gray-700 dark:text-gray-300 pl-2" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="leading-relaxed" {...props} />
          ),
          strong: ({ node, ...props }) => (
            <strong className="font-semibold text-gray-900 dark:text-gray-100" {...props} />
          ),
          em: ({ node, ...props }) => (
            <em className="italic text-gray-700 dark:text-gray-300" {...props} />
          ),
          code: ({ node, inline, ...props }) =>
            inline ? (
              <code
                className="bg-gray-100 dark:bg-gray-700 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded text-sm font-mono"
                {...props}
              />
            ) : (
              <pre className="bg-gray-900 dark:bg-black/60 text-green-400 p-4 rounded-lg overflow-x-auto mb-3 text-sm font-mono">
                <code {...props} />
              </pre>
            ),
          blockquote: ({ node, ...props }) => (
            <blockquote
              className="border-l-4 border-blue-300 dark:border-blue-700 pl-4 italic text-gray-600 dark:text-gray-400 mb-3"
              {...props}
            />
          ),
          hr: () => <hr className="border-gray-200 dark:border-gray-700 my-4" />,
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto mb-3">
              <table className="min-w-full border border-gray-200 dark:border-gray-700 rounded-lg text-sm" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead className="bg-gray-50 dark:bg-gray-700/60" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="px-3 py-2 text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700/60" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

// Variant with white text for dark backgrounds (flashcard back, etc.)
export const MarkdownRendererLight = ({ content, className = '' }) => {
  if (!content) return null;
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, ...props }) => (
            <h1 className="text-xl font-bold text-white mb-3 mt-4" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-lg font-semibold text-indigo-100 mb-2 mt-3" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-base font-semibold text-indigo-100 mb-2 mt-3" {...props} />
          ),
          p: ({ node, ...props }) => (
            <p className="text-white mb-2 leading-relaxed" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="list-disc list-inside space-y-1 mb-2 text-white pl-2" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal list-inside space-y-1 mb-2 text-white pl-2" {...props} />
          ),
          li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
          strong: ({ node, ...props }) => (
            <strong className="font-semibold text-white" {...props} />
          ),
          em: ({ node, ...props }) => <em className="italic text-indigo-100" {...props} />,
          code: ({ node, inline, ...props }) =>
            inline ? (
              <code className="bg-white/20 text-white px-1 rounded text-sm font-mono" {...props} />
            ) : (
              <pre className="bg-black/30 text-green-300 p-3 rounded-lg overflow-x-auto mb-2 text-sm font-mono">
                <code {...props} />
              </pre>
            ),
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-4 border-white/40 pl-4 italic text-indigo-100 mb-2" {...props} />
          ),
          hr: () => <hr className="border-white/20 my-3" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
