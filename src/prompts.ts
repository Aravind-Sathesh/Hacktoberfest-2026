import type { Problem } from './cf';

export type Message = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type RoastEvent = {
  kind: 'left' | 'gave-up';
  minutes: number;
  problemName: string;
};

const PERSONA =
  'You are a codeforces practice buddy: a senior competitive programmer who roasts like a close friend but mentors calmly. Write in lowercase. Be terse. No emojis, no markdown, no quotes.';

const MAX_LINE_CHARS = 160;

const idOf = (p: Problem) => `${p.contestId}${p.index}`;

/** One short line, or null if the model rambled. */
export function cleanLine(text: string): string | null {
  const line = text
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .trim();
  if (!line || line.includes('\n') || line.length > MAX_LINE_CHARS) return null;
  return line;
}

export function roastPrompt(event: RoastEvent): Message[] {
  const what =
    event.kind === 'left'
      ? `he left the app ${event.minutes} minutes into "${event.problemName}", so his focus tree died.`
      : `he gave up on "${event.problemName}" after ${event.minutes} minutes.`;
  return [
    { role: 'system', content: PERSONA },
    {
      role: 'user',
      content: `${what} roast him in one line, max 20 words, talking to him directly as "you". friendly, not cruel.`,
    },
  ];
}

export const hintsSchema = {
  type: 'object',
  properties: { hints: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 4 } },
  required: ['hints'],
};

/** Turns the editorial into a ladder of hints, written in the background while he reads the problem. */
export function hintsPrompt(problem: Problem, editorial: string): Message[] {
  return [
    {
      role: 'system',
      content:
        'you turn a codeforces editorial into 4 hints for a student who is stuck. he has read the problem statement but not the editorial.\n' +
        'write in lowercase, no markdown, no code, no variable names that the editorial invented (say "the most common skill", not "m").\n' +
        'hint 1: a question pointing at where to look (a constraint, a small case, rewriting the condition).\n' +
        'hint 2: a question that points closer to the first key observation.\n' +
        'hint 3: state the first key observation plainly as a statement, not a question.\n' +
        'hint 4: state the second key step plainly as a statement. this is the last hint, so it must be concrete and useful, but still not the final formula or full algorithm.\n' +
        'each hint is one sentence, at most 25 words. never write code, never give the final formula, never copy sentences from the editorial.',
    },
    {
      role: 'user',
      content: `problem ${idOf(problem)} "${problem.name}" (rating ${problem.rating ?? 'unknown'}).\neditorial:\n${editorial}`,
    },
  ];
}

// Six words in a row lifted from the editorial is reciting it, not nudging.
const ECHO_WORDS = 6;

const words = (text: string) => text.toLowerCase().match(/[a-z0-9]+/g) ?? [];

export function echoes(reply: string, source: string): boolean {
  const said = words(reply);
  const haystack = ` ${words(source).join(' ')} `;
  for (let i = 0; i + ECHO_WORDS <= said.length; i++) {
    if (haystack.includes(` ${said.slice(i, i + ECHO_WORDS).join(' ')} `))
      return true;
  }
  return false;
}

const MAX_HINT_CHARS = 200;
// The first hints only point. The later ones are meant to state the observation, so only they may echo the editorial.
const POINTING_HINTS = 2;

/** The usable hints, vaguest first. A pointing hint that names a tag or recites the editorial is dropped. */
export function parseHints(text: string, tags: string[], editorial: string): string[] {
  try {
    const parsed = JSON.parse(text) as { hints?: unknown };
    if (!Array.isArray(parsed.hints)) return [];
    return parsed.hints
      .filter((h): h is string => typeof h === 'string')
      .map((h) => h.trim().replace(/\s+/g, ' '))
      .filter((hint, i) => {
        if (!hint || hint.length > MAX_HINT_CHARS) return false;
        if (i >= POINTING_HINTS) return true;
        const lower = hint.toLowerCase();
        return !tags.some((t) => lower.includes(t.toLowerCase())) && !echoes(hint, editorial);
      });
  } catch {
    return [];
  }
}

export const FALLBACK_ROASTS: Record<RoastEvent['kind'], string> = {
  left: 'the problem didn’t leave. you did.',
  'gave-up': 'quitting is also a verdict. it’s just not OK.',
};
