export type InlineNode =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "italic"; text: string }
  | { type: "code"; text: string }
  | { type: "link"; href: string; text: string };

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type BlockNode =
  | { type: "heading"; level: HeadingLevel; inlines: InlineNode[] }
  | { type: "paragraph"; inlines: InlineNode[] }
  | { type: "bulletList"; items: InlineNode[][] }
  | { type: "numberedList"; items: InlineNode[][] };

const HEADING_PATTERN = /^(#{1,6}) (.*)$/;
const BULLET_PATTERN = /^[-*] (.*)$/;
const NUMBERED_PATTERN = /^\d+\. (.*)$/;

function findBalancedParenClose(line: string, start: number): number {
  let depth = 0;
  for (let i = start; i < line.length; i++) {
    if (line[i] === "(") {
      depth++;
    } else if (line[i] === ")") {
      if (depth === 0) {
        return i;
      }
      depth--;
    }
  }
  return -1;
}

function parseInline(line: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let i = 0;
  let textStart = 0;

  function flushText(end: number): void {
    if (end > textStart) {
      nodes.push({ type: "text", text: line.slice(textStart, end) });
    }
  }

  while (i < line.length) {
    const char = line[i];

    if (char === "`") {
      const close = line.indexOf("`", i + 1);
      if (close !== -1) {
        flushText(i);
        nodes.push({ type: "code", text: line.slice(i + 1, close) });
        i = close + 1;
        textStart = i;
        continue;
      }
    } else if (line.startsWith("**", i)) {
      const close = line.indexOf("**", i + 2);
      if (close !== -1) {
        flushText(i);
        nodes.push({ type: "bold", text: line.slice(i + 2, close) });
        i = close + 2;
        textStart = i;
        continue;
      }
    } else if (char === "[") {
      const textClose = line.indexOf("]", i + 1);
      if (textClose !== -1 && line[textClose + 1] === "(") {
        const hrefClose = findBalancedParenClose(line, textClose + 2);
        if (hrefClose !== -1) {
          flushText(i);
          nodes.push({
            type: "link",
            href: line.slice(textClose + 2, hrefClose),
            text: line.slice(i + 1, textClose),
          });
          i = hrefClose + 1;
          textStart = i;
          continue;
        }
      }
    } else if (char === "*" || char === "_") {
      const close = line.indexOf(char, i + 1);
      if (close !== -1) {
        flushText(i);
        nodes.push({ type: "italic", text: line.slice(i + 1, close) });
        i = close + 1;
        textStart = i;
        continue;
      }
    }

    i++;
  }

  flushText(line.length);
  return nodes;
}

export function parseMarkdown(source: string): BlockNode[] {
  const blocks: BlockNode[] = [];
  let currentList: { type: "bulletList" | "numberedList"; items: InlineNode[][] } | null = null;

  function endList(): void {
    if (currentList) {
      blocks.push(currentList);
      currentList = null;
    }
  }

  for (const line of source.split(/\r\n|\r|\n/)) {
    if (line.trim() === "") {
      endList();
      continue;
    }

    const heading = HEADING_PATTERN.exec(line);
    if (heading) {
      endList();
      blocks.push({
        type: "heading",
        level: heading[1].length as HeadingLevel,
        inlines: parseInline(heading[2]),
      });
      continue;
    }

    const bullet = BULLET_PATTERN.exec(line);
    if (bullet) {
      if (currentList?.type !== "bulletList") {
        endList();
        currentList = { type: "bulletList", items: [] };
      }
      currentList.items.push(parseInline(bullet[1]));
      continue;
    }

    const numbered = NUMBERED_PATTERN.exec(line);
    if (numbered) {
      if (currentList?.type !== "numberedList") {
        endList();
        currentList = { type: "numberedList", items: [] };
      }
      currentList.items.push(parseInline(numbered[1]));
      continue;
    }

    endList();
    blocks.push({ type: "paragraph", inlines: parseInline(line) });
  }

  endList();
  return blocks;
}