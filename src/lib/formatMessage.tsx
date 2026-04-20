import React from "react";

/**
 * Lightweight inline markdown for chat:
 *   *bold*    →  <strong>
 *   _italic_  →  <em>
 *   ~strike~  →  <s>
 *   `code`    →  <code>
 *   http(s):// → clickable link
 *
 * Safe by design: we never use dangerouslySetInnerHTML — only React nodes.
 */

type Token =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "strike"; value: string }
  | { type: "code"; value: string }
  | { type: "link"; value: string };

const PATTERN =
  /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|`[^`\n]+`|https?:\/\/[^\s<>"']+)/g;

const tokenize = (text: string): Token[] => {
  const tokens: Token[] = [];
  let last = 0;
  for (const m of text.matchAll(PATTERN)) {
    const idx = m.index ?? 0;
    if (idx > last) tokens.push({ type: "text", value: text.slice(last, idx) });
    const raw = m[0];
    if (raw.startsWith("*") && raw.endsWith("*"))
      tokens.push({ type: "bold", value: raw.slice(1, -1) });
    else if (raw.startsWith("_") && raw.endsWith("_"))
      tokens.push({ type: "italic", value: raw.slice(1, -1) });
    else if (raw.startsWith("~") && raw.endsWith("~"))
      tokens.push({ type: "strike", value: raw.slice(1, -1) });
    else if (raw.startsWith("`") && raw.endsWith("`"))
      tokens.push({ type: "code", value: raw.slice(1, -1) });
    else tokens.push({ type: "link", value: raw });
    last = idx + raw.length;
  }
  if (last < text.length) tokens.push({ type: "text", value: text.slice(last) });
  return tokens;
};

export const FormattedText = ({ text }: { text: string }) => {
  const tokens = React.useMemo(() => tokenize(text), [text]);
  return (
    <>
      {tokens.map((t, i) => {
        switch (t.type) {
          case "bold":
            return <strong key={i}>{t.value}</strong>;
          case "italic":
            return <em key={i}>{t.value}</em>;
          case "strike":
            return <s key={i}>{t.value}</s>;
          case "code":
            return (
              <code
                key={i}
                className="rounded bg-foreground/10 px-1 py-0.5 font-mono text-[0.85em]"
              >
                {t.value}
              </code>
            );
          case "link":
            return (
              <a
                key={i}
                href={t.value}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:opacity-80"
                onClick={(e) => e.stopPropagation()}
              >
                {t.value}
              </a>
            );
          default:
            return <React.Fragment key={i}>{t.value}</React.Fragment>;
        }
      })}
    </>
  );
};
