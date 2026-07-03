type Node =
  | { type: "text"; value: string }
  | { type: "expr"; path: string }
  | { type: "each"; path: string; body: Node[] }
  | { type: "if"; path: string; body: Node[] }
  | { type: "unless"; path: string; body: Node[] };

export function parseTemplate(tpl: string): Node[] {
  const nodes: Node[] = [];
  const re = /{{(#each|#if|#unless|#\/each|\/each|\/if|\/unless)?\s*([\w.[\]@]*)\s*}}|{{!(.*?)}}/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(tpl)) !== null) {
    if (match.index > lastIdx) {
      nodes.push({ type: "text", value: tpl.slice(lastIdx, match.index) });
    }
    lastIdx = re.lastIndex;

    const fullTag = match[0];
    if (fullTag.startsWith("{{!")) {
      continue;
    }

    const directive = match[1] || "";
    const path = match[2] || "";

    if (directive === "#each") {
      const bodyEnd = findBlockEnd(tpl, lastIdx, "#each", "/each");
      const bodyStr = trimBlockBody(tpl, lastIdx, bodyEnd);
      lastIdx = bodyEnd + "{{/each}}".length;
      re.lastIndex = lastIdx;
      nodes.push({ type: "each", path, body: parseTemplate(bodyStr) });
    } else if (directive === "#if") {
      const bodyEnd = findBlockEnd(tpl, lastIdx, "#if", "/if");
      const bodyStr = trimBlockBody(tpl, lastIdx, bodyEnd);
      lastIdx = bodyEnd + "{{/if}}".length;
      re.lastIndex = lastIdx;
      nodes.push({ type: "if", path, body: parseTemplate(bodyStr) });
    } else if (directive === "#unless") {
      const bodyEnd = findBlockEnd(tpl, lastIdx, "#unless", "/unless");
      const bodyStr = trimBlockBody(tpl, lastIdx, bodyEnd);
      lastIdx = bodyEnd + "{{/unless}}".length;
      re.lastIndex = lastIdx;
      nodes.push({ type: "unless", path, body: parseTemplate(bodyStr) });
    } else if (!directive && path) {
      nodes.push({ type: "expr", path });
    }
  }

  if (lastIdx < tpl.length) {
    nodes.push({ type: "text", value: tpl.slice(lastIdx) });
  }

  return nodes;
}

function findBlockEnd(tpl: string, start: number, openTag: string, closeTag: string): number {
  let depth = 1;
  const openRe = new RegExp(`{{${escapeRegex(openTag)}\\s*[\\w.\\[\\]@]*\\s*}}`, "g");
  const closeRe = new RegExp(`{{${escapeRegex(closeTag)}}}`, "g");
  let idx = start;

  while (depth > 0 && idx < tpl.length) {
    openRe.lastIndex = idx;
    closeRe.lastIndex = idx;

    const nextOpen = openRe.exec(tpl);
    const nextClose = closeRe.exec(tpl);

    const openPos = nextOpen !== null ? nextOpen.index : Infinity;
    const openEnd = nextOpen !== null ? nextOpen.index + nextOpen[0].length : 0;
    const closePos = nextClose !== null ? nextClose.index : Infinity;
    const closeEnd = nextClose !== null ? nextClose.index + nextClose[0].length : 0;

    if (closePos < openPos && closePos !== Infinity) {
      depth--;
      if (depth === 0) {
        idx = closePos;
        break;
      }
      idx = closeEnd;
    } else if (openPos < closePos && openPos !== Infinity) {
      depth++;
      idx = openEnd;
    } else {
      break;
    }
  }

  return idx;
}

/**
 * Trim only the leading newline immediately after an opening block tag.
 * The trailing newline before the closing tag is preserved as it provides
 * the line separator between repeated block iterations (e.g. table rows).
 * This follows Handlebars convention.
 */
function trimBlockBody(tpl: string, bodyStart: number, bodyEnd: number): string {
  let start = bodyStart;

  // Skip leading \n or \r\n right after the opening tag
  if (start < bodyEnd && tpl[start] === "\n") {
    start++;
  } else if (start + 1 < bodyEnd && tpl[start] === "\r" && tpl[start + 1] === "\n") {
    start += 2;
  }

  return tpl.slice(start, bodyEnd);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getPath(obj: unknown, path: string): unknown {
  const parts = path.replace(/^@\.?/, "").split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function renderTemplate(nodes: Node[], ctx: unknown): string {
  let out = "";
  for (const node of nodes) {
    switch (node.type) {
      case "text":
        out += node.value;
        break;
      case "expr": {
        const val = getPath(ctx, node.path);
        out += val != null ? String(val) : "";
        break;
      }
      case "each": {
        const list = getPath(ctx, node.path);
        if (Array.isArray(list)) {
          for (let i = 0; i < list.length; i++) {
            const item = list[i];
            const itemCtx = item && typeof item === "object" ? item : { "@": item };
            out += renderTemplate(node.body, itemCtx);
          }
        }
        break;
      }
      case "if": {
        const val = getPath(ctx, node.path);
        const truthy = val && (!Array.isArray(val) || val.length > 0);
        if (truthy) {
          out += renderTemplate(node.body, ctx);
        }
        break;
      }
      case "unless": {
        const val = getPath(ctx, node.path);
        const falsy = !val || (Array.isArray(val) && val.length === 0);
        if (falsy) {
          out += renderTemplate(node.body, ctx);
        }
        break;
      }
    }
  }
  return out;
}
