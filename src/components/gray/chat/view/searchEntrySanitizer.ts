const SANITIZED_SEARCH_ENTRY_CACHE_LIMIT = 50;
const SANITIZED_SEARCH_ENTRY_CACHE = new Map<string, string>();
const SANITIZED_SEARCH_ENTRY_ALLOWED_TAGS = new Set([
  "a",
  "b",
  "br",
  "code",
  "div",
  "em",
  "i",
  "li",
  "ol",
  "p",
  "span",
  "strong",
  "ul",
]);
const SANITIZED_SEARCH_ENTRY_ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);
const SANITIZED_SEARCH_ENTRY_DROP_TAGS = new Set([
  "embed",
  "iframe",
  "math",
  "noscript",
  "object",
  "script",
  "style",
  "svg",
  "template",
]);

function sanitizeSearchEntryHtml(rawHtml: string): string | null {
  if (typeof window === "undefined" || typeof document === "undefined" || typeof DOMParser === "undefined") {
    return null;
  }
  try {
    const parsed = new DOMParser().parseFromString(rawHtml, "text/html");
    const out = document.createElement("div");
    const appendSanitized = (node: Node, parent: HTMLElement) => {
      if (node.nodeType === 3) {
        const text = node.textContent ?? "";
        if (text) {
          parent.appendChild(document.createTextNode(text));
        }
        return;
      }
      if (node.nodeType !== 1) {
        return;
      }
      const element = node as HTMLElement;
      const tagName = element.tagName.toLowerCase();

      if (SANITIZED_SEARCH_ENTRY_DROP_TAGS.has(tagName)) {
        return;
      }

      if (!SANITIZED_SEARCH_ENTRY_ALLOWED_TAGS.has(tagName)) {
        for (const child of Array.from(element.childNodes)) {
          appendSanitized(child, parent);
        }
        return;
      }

      if (tagName === "br") {
        parent.appendChild(document.createElement("br"));
        return;
      }

      if (tagName === "a") {
        const href = element.getAttribute("href");
        if (!href) {
          for (const child of Array.from(element.childNodes)) {
            appendSanitized(child, parent);
          }
          return;
        }

        let url: URL | null = null;
        try {
          url = new URL(href);
        } catch {
          url = null;
        }
        if (!url || !SANITIZED_SEARCH_ENTRY_ALLOWED_PROTOCOLS.has(url.protocol)) {
          for (const child of Array.from(element.childNodes)) {
            appendSanitized(child, parent);
          }
          return;
        }

        const anchor = document.createElement("a");
        anchor.setAttribute("href", url.toString());
        anchor.setAttribute("target", "_blank");
        anchor.setAttribute("rel", "noreferrer noopener");
        for (const child of Array.from(element.childNodes)) {
          appendSanitized(child, anchor);
        }
        parent.appendChild(anchor);
        return;
      }

      const safeElement = document.createElement(tagName);
      for (const child of Array.from(element.childNodes)) {
        appendSanitized(child, safeElement);
      }
      parent.appendChild(safeElement);
    };

    for (const child of Array.from(parsed.body.childNodes)) {
      appendSanitized(child, out);
    }

    const sanitized = out.innerHTML.trim();
    return sanitized ? sanitized : null;
  } catch {
    return null;
  }
}

export function getSanitizedSearchEntryHtml(rawHtml: string): string | null {
  const cached = SANITIZED_SEARCH_ENTRY_CACHE.get(rawHtml);
  if (cached !== undefined) {
    return cached || null;
  }
  const sanitized = sanitizeSearchEntryHtml(rawHtml);
  SANITIZED_SEARCH_ENTRY_CACHE.set(rawHtml, sanitized ?? "");
  if (SANITIZED_SEARCH_ENTRY_CACHE.size > SANITIZED_SEARCH_ENTRY_CACHE_LIMIT) {
    const firstKey = SANITIZED_SEARCH_ENTRY_CACHE.keys().next().value as string | undefined;
    if (firstKey) {
      SANITIZED_SEARCH_ENTRY_CACHE.delete(firstKey);
    }
  }
  return sanitized;
}

