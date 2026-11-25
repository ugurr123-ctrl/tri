import type { Snippet } from '../../types/extension';
import { MAX_SHORTCUT_LENGTH, MIN_SHORTCUT_LENGTH } from '../sanitize/sanitize';

export interface ShortcutMatch {
  snippet: Snippet;
  matchedText: string;
  tokenLength: number;
}

const TOKEN_BOUNDARY_REGEX = /[\s([{'"`<>]/;

/**
 * Extracts ONLY the immediate trailing non-whitespace token preceding the caret.
 * Processes at most MAX_SHORTCUT_LENGTH + 2 characters — zero keystroke logging or history.
 */
export function extractTrailingToken(textBeforeCaret: string): string | null {
  if (!textBeforeCaret) {
    return null;
  }

  const windowSlice = textBeforeCaret.slice(-(MAX_SHORTCUT_LENGTH + 2));
  let end = windowSlice.length;
  if (end < MIN_SHORTCUT_LENGTH) {
    return null;
  }

  // Must not end with whitespace (trigger key hasn't been inserted yet on keydown)
  const lastChar = windowSlice[end - 1];
  if (/\s/.test(lastChar)) {
    return null;
  }

  let start = end - 1;
  while (start > 0 && !TOKEN_BOUNDARY_REGEX.test(windowSlice[start - 1])) {
    start--;
  }

  const token = windowSlice.slice(start, end);
  if (token.length < MIN_SHORTCUT_LENGTH || token.length > MAX_SHORTCUT_LENGTH) {
    return null;
  }

  return token;
}

/**
 * Matches the extracted trailing token against enabled snippets.
 */
export function findMatchingSnippet(
  textBeforeCaret: string,
  snippets: Snippet[],
  caseSensitive: boolean,
): ShortcutMatch | null {
  const token = extractTrailingToken(textBeforeCaret);
  if (!token) {
    return null;
  }

  const normalizedToken = caseSensitive ? token : token.toLowerCase();

  for (const snippet of snippets) {
    if (!snippet.enabled) continue;
    const candidate = caseSensitive ? snippet.shortcut : snippet.shortcut.toLowerCase();
    if (candidate === normalizedToken) {
      return {
        snippet,
        matchedText: token,
        tokenLength: token.length,
      };
    }
  }

  return null;
}
