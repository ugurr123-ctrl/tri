import type { CustomVariable } from '../../types/extension';
import { sanitizePlainText } from '../sanitize/sanitize';

export interface InputPlaceholderSpec {
  rawToken: string;
  key: string;
  label: string;
  defaultValue: string;
}

export interface TemplateResolveOptions {
  now?: Date;
  customVariables?: CustomVariable[];
  inputValues?: Record<string, string>;
  allowAdvancedVariables?: boolean;
}

export interface ResolvedTemplate {
  text: string;
  cursorOffset: number | null;
  usedAdvancedVariables: boolean;
}

const INPUT_TOKEN_REGEX = /\{\{input:([^{}|]+?)(?:\|default=([^{}]*?))?\}\}/g;
const CUSTOM_VAR_REGEX = /\{\{var:([a-zA-Z0-9_-]+)\}\}/g;
const DATE_TOKEN_REGEX = /\{\{date(?::([a-zA-Z0-9/-]+))?\}\}/g;
const TIME_TOKEN_REGEX = /\{\{time(?::(12h|24h))?\}\}/g;
const CURSOR_TOKEN = '{{cursor}}';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatDateToken(date: Date, format?: string): string {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());

  switch (format) {
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`;
    case 'long':
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    default:
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
  }
}

export function formatTimeToken(date: Date, format?: string): string {
  if (format === '24h') {
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Inspects a snippet template for user-provided placeholder prompts like {{input:Client Name}}.
 */
export function extractInputPlaceholders(template: string): InputPlaceholderSpec[] {
  const found: InputPlaceholderSpec[] = [];
  const seenKeys = new Set<string>();

  INPUT_TOKEN_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INPUT_TOKEN_REGEX.exec(template)) !== null) {
    const label = match[1].trim();
    const defaultValue = (match[2] ?? '').trim();
    const key = label.toLowerCase();
    if (!label || seenKeys.has(key)) continue;
    seenKeys.add(key);
    found.push({
      rawToken: match[0],
      key,
      label,
      defaultValue,
    });
  }

  return found;
}

export function containsAdvancedVariables(template: string): boolean {
  CUSTOM_VAR_REGEX.lastIndex = 0;
  INPUT_TOKEN_REGEX.lastIndex = 0;
  return CUSTOM_VAR_REGEX.test(template) || INPUT_TOKEN_REGEX.test(template);
}

/**
 * Resolves all supported template variables and calculates exact {{cursor}} offset.
 */
export function resolveTemplate(
  template: string,
  options: TemplateResolveOptions = {},
): ResolvedTemplate {
  const now = options.now ?? new Date();
  const customVariables = options.customVariables ?? [];
  const inputValues = options.inputValues ?? {};
  const allowAdvanced = options.allowAdvancedVariables ?? true;

  let usedAdvancedVariables = false;
  let output = sanitizePlainText(template);

  // 1. Date placeholders (available on Free & Pro)
  output = output.replace(DATE_TOKEN_REGEX, (_full, fmt: string | undefined) =>
    formatDateToken(now, fmt),
  );

  // 2. Time placeholders (available on Free & Pro)
  output = output.replace(TIME_TOKEN_REGEX, (_full, fmt: string | undefined) =>
    formatTimeToken(now, fmt),
  );

  // 3. Custom user-defined variables {{var:key}}
  const varMap = new Map<string, string>();
  for (const v of customVariables) {
    varMap.set(v.key.toLowerCase(), sanitizePlainText(v.value));
  }

  output = output.replace(CUSTOM_VAR_REGEX, (full, rawKey: string) => {
    usedAdvancedVariables = true;
    if (!allowAdvanced) {
      return full;
    }
    const resolved = varMap.get(rawKey.toLowerCase());
    return resolved !== undefined ? resolved : full;
  });

  // 4. User-provided interactive placeholder values {{input:Label|default=...}}
  output = output.replace(
    INPUT_TOKEN_REGEX,
    (full, rawLabel: string, rawDefault: string | undefined) => {
      usedAdvancedVariables = true;
      if (!allowAdvanced) {
        return rawDefault !== undefined ? sanitizePlainText(rawDefault) : full;
      }
      const key = rawLabel.trim().toLowerCase();
      if (Object.prototype.hasOwnProperty.call(inputValues, key)) {
        return sanitizePlainText(inputValues[key]);
      }
      return rawDefault !== undefined ? sanitizePlainText(rawDefault) : '';
    },
  );

  // 5. Cursor marker {{cursor}} — resolve only the first occurrence, remove any extras
  let cursorOffset: number | null = null;
  const cursorIndex = output.indexOf(CURSOR_TOKEN);
  if (cursorIndex !== -1) {
    cursorOffset = cursorIndex;
    output = output.split(CURSOR_TOKEN).join('');
  }

  return {
    text: output,
    cursorOffset,
    usedAdvancedVariables,
  };
}
