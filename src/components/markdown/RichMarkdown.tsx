"use client";

import React, { ReactNode } from "react";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import RichChart from "./RichChart";
import RichCodeBlock from "./RichCodeBlock";

const RichMermaid = dynamic(() => import("./RichMermaid"), { ssr: false });

export interface Citation {
  id: string;
  chunk_id: string;
  document_id: string;
  filename: string;
  contextual_header?: string;
  text_preview: string;
}

function CitationBadge({ citation }: { citation: Citation }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <span ref={ref} className="relative inline-block align-baseline">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="mx-1 inline-flex size-5 translate-y-[-2px] items-center justify-center rounded-full bg-ink text-[10px] font-bold text-white transition hover:-translate-y-1 hover:bg-brand-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 focus-visible:ring-offset-2"
        title={`Source: ${citation.filename}`}
      >
        {citation.id.replace(/[\[\]]/g, "")}
      </button>

      {open && (
        <div className="absolute bottom-full left-1/2 z-50 mb-3 w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-hairline bg-white p-3 text-left text-xs leading-5 text-charcoal shadow-xl">
          <div className="mb-1 font-bold text-ink">{citation.filename}</div>
          {citation.contextual_header && (
            <div className="mb-2 font-semibold text-steel">{citation.contextual_header}</div>
          )}
          <p className="line-clamp-5">{citation.text_preview}</p>
        </div>
      )}
    </span>
  );
}

function getCitationMap(citations?: Citation[]) {
  const map = new Map<string, Citation>();

  citations?.forEach((citation) => {
    map.set(citation.id, citation);
    map.set(citation.id.replace(/[\[\]]/g, ""), citation);
  });

  return map;
}

function InlineWithCitations({
  children,
  citations,
}: {
  children: ReactNode;
  citations?: Citation[];
}) {
  const citationMap = React.useMemo(() => getCitationMap(citations), [citations]);

  const renderNode = (node: ReactNode, keyPrefix: string): ReactNode => {
    if (typeof node === "string") {
      return node
        .split(/(\[\d+\]|\b\d+\b)/g)
        .filter(Boolean)
        .map((part, index) => {
          const citation = citationMap.get(part) ?? citationMap.get(part.replace(/[\[\]]/g, ""));

          if (citation) {
            return <CitationBadge key={`${keyPrefix}-citation-${part}-${index}`} citation={citation} />;
          }

          return <React.Fragment key={`${keyPrefix}-text-${index}`}>{part}</React.Fragment>;
        });
    }

    if (Array.isArray(node)) {
      return node.map((child, index) => renderNode(child, `${keyPrefix}-${index}`));
    }

    if (React.isValidElement<{ children?: ReactNode }>(node)) {
      return React.cloneElement(node, {
        children: renderNode(node.props.children, `${keyPrefix}-child`),
      });
    }

    return node;
  };

  return <>{renderNode(children, "inline")}</>;
}

export default function RichMarkdown({
  content,
  citations,
}: {
  content: string;
  citations?: Citation[];
}) {
  return (
    <div className="chat-markdown text-[15px] font-medium leading-7 text-charcoal sm:text-base">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          [
            rehypeSanitize,
            {
              ...defaultSchema,
              attributes: {
                ...defaultSchema.attributes,
                code: [...(defaultSchema.attributes?.code || []), "className"],
                div: [...(defaultSchema.attributes?.div || []), "className"],
                span: [...(defaultSchema.attributes?.span || []), "className"],
              },
            },
          ],
          rehypeKatex,
        ]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-5 mt-10 text-3xl font-black leading-tight text-ink first:mt-0 sm:text-4xl">
              <InlineWithCitations citations={citations}>{children}</InlineWithCitations>
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-4 mt-9 border-b border-hairline-soft pb-2 text-2xl font-extrabold leading-snug text-ink first:mt-0">
              <InlineWithCitations citations={citations}>{children}</InlineWithCitations>
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-3 mt-7 text-xl font-bold leading-snug text-ink first:mt-0">
              <InlineWithCitations citations={citations}>{children}</InlineWithCitations>
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="mb-2 mt-6 text-lg font-bold leading-snug text-ink first:mt-0">
              <InlineWithCitations citations={citations}>{children}</InlineWithCitations>
            </h4>
          ),
          h5: ({ children }) => (
            <h5 className="mb-2 mt-5 text-base font-bold leading-snug text-ink first:mt-0">
              <InlineWithCitations citations={citations}>{children}</InlineWithCitations>
            </h5>
          ),
          h6: ({ children }) => (
            <h6 className="mb-2 mt-5 text-sm font-bold uppercase leading-snug text-steel first:mt-0">
              <InlineWithCitations citations={citations}>{children}</InlineWithCitations>
            </h6>
          ),
          p: ({ children }) => (
            <p className="my-4 leading-8 text-charcoal first:mt-0 last:mb-0">
              <InlineWithCitations citations={citations}>{children}</InlineWithCitations>
            </p>
          ),
          strong: ({ children }) => <strong className="font-extrabold text-ink">{children}</strong>,
          em: ({ children }) => <em className="italic text-charcoal">{children}</em>,
          del: ({ children }) => <del className="text-steel decoration-steel/70">{children}</del>,
          blockquote: ({ children }) => (
            <blockquote className="my-6 rounded-r-lg border-l-4 border-brand-blue bg-brand-blue/5 px-5 py-4 text-[0.96em] leading-8 text-slate">
              {children}
            </blockquote>
          ),
          ul: ({ children }) => (
            <ul className="my-4 list-disc space-y-2 pl-6 marker:text-brand-blue">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-4 list-decimal space-y-2 pl-6 marker:font-bold marker:text-brand-blue">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="pl-1 leading-8">
              <InlineWithCitations citations={citations}>{children}</InlineWithCitations>
            </li>
          ),
          input: ({ checked, type }) => (
            <input
              checked={checked}
              readOnly
              type={type}
              className="mr-2 size-4 translate-y-0.5 rounded border-hairline accent-brand-blue"
            />
          ),
          pre: ({ children }) => <>{children}</>,
          code: ({ children, className }) => {
            const language = /language-([\w-]+)/.exec(className || "")?.[1];
            const code = String(children).replace(/\n$/, "");

            if (language === "mermaid") {
              return <RichMermaid chart={code} />;
            }

            if (language === "chart") {
              return <RichChart configStr={code} />;
            }

            if (language) {
              return <RichCodeBlock language={language} code={code} />;
            }

            return (
              <code className="mx-0.5 break-words rounded bg-surface-soft px-1.5 py-0.5 font-mono text-[0.9em] font-semibold text-ink ring-1 ring-hairline-soft">
                {children}
              </code>
            );
          },
          table: ({ children }) => (
            <div className="internal-scroll my-6 max-w-full overflow-x-auto rounded-lg border border-hairline bg-white shadow-sm">
              <table className="w-full min-w-[40rem] border-collapse text-left text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="border-b border-hairline bg-surface-soft text-xs font-bold uppercase text-ink">
              {children}
            </thead>
          ),
          tbody: ({ children }) => <tbody className="divide-y divide-hairline-soft bg-white">{children}</tbody>,
          tr: ({ children }) => <tr className="transition-colors hover:bg-surface/60">{children}</tr>,
          th: ({ children }) => (
            <th className="whitespace-nowrap px-4 py-3 align-bottom font-bold">
              <InlineWithCitations citations={citations}>{children}</InlineWithCitations>
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-3 align-top text-charcoal">
              <InlineWithCitations citations={citations}>{children}</InlineWithCitations>
            </td>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-brand-blue underline decoration-brand-blue/30 underline-offset-4 transition hover:text-brand-blue-deep hover:decoration-brand-blue/80 focus:outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-brand-blue/35"
            >
              <InlineWithCitations citations={citations}>{children}</InlineWithCitations>
            </a>
          ),
          hr: () => <hr className="my-8 border-t border-hairline-soft" />,
          img: ({ src, alt, title }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src || ""}
              alt={alt || ""}
              title={title}
              className="my-6 h-auto max-h-[40rem] w-full rounded-lg border border-hairline-soft object-contain shadow-sm"
              loading="lazy"
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
