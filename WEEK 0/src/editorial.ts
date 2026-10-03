// Enough for the key observations; the whole editorial would crowd the chat out of Gemma's context.
const MAX_EDITORIAL_CHARS = 2500;
const MIN_EDITORIAL_CHARS = 80;
// A header is the problem's name plus a little decoration ("2000B - Name", "Problem B. Name").
const HEADER_SLACK_CHARS = 40;

const isHeader = (line: string, name: string) =>
  line.length <= name.length + HEADER_SLACK_CHARS && line.toLowerCase().includes(name.toLowerCase());

/**
 * The part of a contest editorial about one problem: from a line naming it to the next line naming a
 * sibling. Editorials often open with a table of contents, so the longest such section wins.
 */
export function editorialSection(text: string, name: string, siblingNames: string[]): string | null {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  let best = '';
  lines.forEach((line, start) => {
    if (!isHeader(line, name)) return;
    let end = start + 1;
    while (end < lines.length && !siblingNames.some((n) => isHeader(lines[end], n))) end++;
    const body = lines.slice(start + 1, end).join('\n');
    if (body.length > best.length) best = body;
  });
  return best.length >= MIN_EDITORIAL_CHARS ? best.slice(0, MAX_EDITORIAL_CHARS) : null;
}
