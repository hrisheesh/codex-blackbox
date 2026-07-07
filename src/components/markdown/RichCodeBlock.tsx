"use client";

import React, { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { motion, AnimatePresence } from "framer-motion";

export default function RichCodeBlock({
  language,
  code,
}: {
  language: string;
  code: string;
}) {
  const [copied, setCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="group my-6 overflow-hidden rounded-lg border border-hairline bg-white shadow-sm transition hover:border-hairline-soft"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-3 border-b border-hairline-soft bg-surface-soft px-4 py-2.5">
        <div className="flex items-center gap-2">
          {/* Mac-style window controls */}
          <div className="flex gap-1.5 opacity-75 mix-blend-multiply">
            <div className="size-2.5 rounded-full border border-black/10 bg-[#FF5F56]" />
            <div className="size-2.5 rounded-full border border-black/10 bg-[#FFBD2E]" />
            <div className="size-2.5 rounded-full border border-black/10 bg-[#27C93F]" />
          </div>
          <span className="ml-2 truncate text-[11px] font-bold uppercase text-steel">
            {language || "code"}
          </span>
        </div>

        <AnimatePresence>
          {(isHovered || copied) && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleCopy}
              className="flex shrink-0 items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-xs font-bold text-slate shadow-sm ring-1 ring-black/5 transition-colors hover:text-brand-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/35"
            >
              <AnimatePresence mode="wait">
                {copied ? (
                  <motion.div
                    key="copied"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className="flex items-center gap-1 text-brand-blue"
                  >
                    <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Copied
                  </motion.div>
                ) : (
                  <motion.div
                    key="copy"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className="flex items-center gap-1"
                  >
                    <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Code Area */}
      <div className="internal-scroll max-h-[500px] overflow-auto scroll-smooth">
        <SyntaxHighlighter
          language={language || "text"}
          style={oneLight}
          customStyle={{
            margin: 0,
            padding: "1rem",
            backgroundColor: "transparent",
            fontSize: "13px",
            lineHeight: "1.6",
            overflowX: "auto",
          }}
          wrapLines={false}
          showLineNumbers={true}
          lineNumberStyle={{
            minWidth: "2.5em",
            paddingRight: "1.5em",
            color: "#A0AAB5",
            textAlign: "right",
            fontFamily: "inherit",
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
