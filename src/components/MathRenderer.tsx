import React, { useEffect, useRef } from "react";
import renderMathInElement from "katex/contrib/auto-render";

interface MathRendererProps {
  text: string;
  className?: string;
  isHtml?: boolean;
  inline?: boolean;
}

function escapeHtml(unsafe: string) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default function MathRenderer({
  text,
  className = "",
  isHtml = true,
  inline = false,
}: MathRendererProps) {
  const containerRef = useRef<any>(null);

  useEffect(() => {
    if (containerRef.current) {
      try {
        renderMathInElement(containerRef.current, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false },
            { left: "\\(", right: "\\)", display: false },
            { left: "\\[", right: "\\]", display: true },
          ],
          throwOnError: false,
        });
      } catch (err) {
        console.error("KaTeX rendering error:", err);
      }
    }
  }, [text, isHtml]);

  const formatted = isHtml ? text.replace(/\n/g, "<br/>") : escapeHtml(text);

  if (inline) {
    return (
      <span
        ref={containerRef}
        className={className}
        dangerouslySetInnerHTML={{ __html: formatted }}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      dangerouslySetInnerHTML={{ __html: formatted }}
    />
  );
}
