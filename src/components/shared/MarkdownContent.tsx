import ReactMarkdown from "react-markdown"

/**
 * Styled by hand via react-markdown's `components` prop, using the app's
 * existing design tokens (DESIGN_SYSTEM.md) — not @tailwindcss/typography,
 * to avoid a second new dependency for a job the tokens already cover.
 */
export function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="flex flex-col gap-3 text-sm text-foreground">
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="mt-4 font-display text-2xl font-semibold first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-4 font-display text-xl font-semibold first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-3 font-display text-base font-semibold first:mt-0">{children}</h3>
          ),
          p: ({ children }) => <p className="leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-brand-azure hover:underline"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-border pl-3 text-muted-foreground">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-[var(--radius-card)] bg-muted p-3 font-mono text-xs">
              {children}
            </pre>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
