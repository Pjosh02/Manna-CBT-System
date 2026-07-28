import React, { useEffect, useRef } from "react";
import renderMathInElement from "katex/contrib/auto-render";

interface MathRendererProps {
  text: string;
  className?: string;
  isHtml?: boolean;
  inline?: boolean;
}

export default function MathRenderer({
  text,
  className = "",
  isHtml = false,
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

  if (isHtml) {
    // Replace newlines with break tags for visual structure
    const formatted = text.replace(/\n/g, "<br/>");
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

  if (inline) {
    return (
      <span ref={containerRef} className={className}>
        {text}
      </span>
    );
  }

  return (
    <div ref={containerRef} className={className}>
      {text}
    </div>
  );
}
