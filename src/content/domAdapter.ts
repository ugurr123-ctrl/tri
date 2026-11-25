import { MAX_SHORTCUT_LENGTH } from '../core/sanitize/sanitize';

export interface CaretSnapshot {
  element: HTMLElement;
  kind: 'input' | 'contenteditable';
  /** Native input selectionStart at capture time */
  selectionStart?: number;
  /** Cloned DOM range for contenteditable restoration */
  range?: Range;
}

export interface ExpansionUndoEntry {
  element: HTMLInputElement | HTMLTextAreaElement;
  startOffset: number;
  insertedLength: number;
  originalShortcut: string;
  postExpansionValue: string;
}

let lastNativeUndo: ExpansionUndoEntry | null = null;

/**
 * Resolves the actual focused editable element, piercing open Shadow DOM boundaries.
 */
export function resolveActiveEditableTarget(event: KeyboardEvent): HTMLElement | null {
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
  for (const node of path) {
    if (node instanceof HTMLElement) {
      if (
        node instanceof HTMLInputElement ||
        node instanceof HTMLTextAreaElement ||
        node.isContentEditable
      ) {
        return node;
      }
    }
  }

  let active: Element | null = document.activeElement;
  while (active && active.shadowRoot && active.shadowRoot.activeElement) {
    active = active.shadowRoot.activeElement;
  }

  return active instanceof HTMLElement ? active : null;
}

/**
 * Finds the root contenteditable host for a focused node.
 */
function findContentEditableRoot(el: HTMLElement): HTMLElement {
  let root = el;
  while (root.parentElement && root.parentElement.isContentEditable) {
    root = root.parentElement;
  }
  return root;
}

/**
 * Captures a snapshot of the current caret before opening a placeholder prompt modal.
 */
export function captureCaretSnapshot(element: HTMLElement): CaretSnapshot | null {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    if (element.selectionStart === null || element.selectionStart !== element.selectionEnd) {
      return null;
    }
    return {
      element,
      kind: 'input',
      selectionStart: element.selectionStart,
    };
  }

  if (element.isContentEditable) {
    const sel = element.ownerDocument?.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) {
      return null;
    }
    return {
      element,
      kind: 'contenteditable',
      range: sel.getRangeAt(0).cloneRange(),
    };
  }

  return null;
}

/**
 * Extracts ONLY the minimal text immediately preceding the caret (capped at MAX_SHORTCUT_LENGTH + 2 chars).
 */
export function getMinimalTextBeforeCaret(element: HTMLElement): string | null {
  const maxWindow = MAX_SHORTCUT_LENGTH + 2;

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    const start = element.selectionStart;
    const end = element.selectionEnd;
    if (start === null || end === null || start !== end || start === 0) {
      return null;
    }
    const sliceStart = Math.max(0, start - maxWindow);
    return element.value.slice(sliceStart, start);
  }

  if (element.isContentEditable) {
    const sel = element.ownerDocument?.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) {
      return null;
    }

    const range = sel.getRangeAt(0);
    const root = findContentEditableRoot(element);
    if (!root.contains(range.startContainer)) {
      return null;
    }

    // Fast path: caret inside a Text node with enough text
    if (range.startContainer.nodeType === Node.TEXT_NODE) {
      const textContent = range.startContainer.textContent ?? '';
      if (range.startOffset >= maxWindow) {
        return textContent.slice(range.startOffset - maxWindow, range.startOffset);
      }
    }

    // Multi-node walk backward within the current block (supports ProseMirror/Gmail/Lexical split spans)
    return collectBackwardText(root, range.startContainer, range.startOffset, maxWindow);
  }

  return null;
}

function isBlockBoundaryElement(node: Node): boolean {
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  const tag = (node as HTMLElement).tagName;
  return (
    tag === 'BR' ||
    tag === 'P' ||
    tag === 'DIV' ||
    tag === 'LI' ||
    tag === 'TR' ||
    tag === 'H1' ||
    tag === 'H2' ||
    tag === 'H3' ||
    tag === 'H4' ||
    tag === 'BLOCKQUOTE'
  );
}

function collectBackwardText(
  root: HTMLElement,
  container: Node,
  offset: number,
  maxChars: number,
): string {
  const chunks: string[] = [];
  let remaining = maxChars;

  // If caret is inside a text node, start with its prefix
  if (container.nodeType === Node.TEXT_NODE) {
    const prefix = (container.textContent ?? '').slice(0, offset);
    if (prefix.length >= remaining) {
      return prefix.slice(-remaining);
    }
    chunks.unshift(prefix);
    remaining -= prefix.length;
  }

  // Build a backward TreeWalker over text nodes and <br> elements inside root
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
  );

  // Position walker at the node preceding the caret
  if (container.nodeType === Node.TEXT_NODE) {
    walker.currentNode = container;
  } else if (container.nodeType === Node.ELEMENT_NODE) {
    if (offset > 0 && container.childNodes[offset - 1]) {
      let target: Node = container.childNodes[offset - 1];
      while (target.lastChild) {
        target = target.lastChild;
      }
      walker.currentNode = target;
      if (target.nodeType === Node.TEXT_NODE) {
        const text = target.textContent ?? '';
        const slice = text.slice(-remaining);
        chunks.unshift(slice);
        remaining -= slice.length;
      } else if (isBlockBoundaryElement(target)) {
        return chunks.join('');
      }
    } else {
      walker.currentNode = container;
    }
  }

  const startBlock = findNearestBlockAncestor(container, root);

  while (remaining > 0) {
    const prev = walker.previousNode();
    if (!prev || prev === root) break;

    if (prev.nodeType === Node.ELEMENT_NODE && (prev as HTMLElement).tagName === 'BR') {
      break;
    }

    if (prev.nodeType === Node.TEXT_NODE) {
      const prevBlock = findNearestBlockAncestor(prev, root);
      if (prevBlock !== startBlock) {
        break;
      }
      const text = prev.textContent ?? '';
      if (!text) continue;
      if (text.length >= remaining) {
        chunks.unshift(text.slice(-remaining));
        remaining = 0;
        break;
      }
      chunks.unshift(text);
      remaining -= text.length;
    }
  }

  return chunks.join('');
}

function findNearestBlockAncestor(node: Node, root: HTMLElement): Node {
  let curr: Node | null = node.nodeType === Node.ELEMENT_NODE ? node : node.parentNode;
  while (curr && curr !== root) {
    if (isBlockBoundaryElement(curr)) {
      return curr;
    }
    curr = curr.parentNode;
  }
  return root;
}

/**
 * Builds a DOM Range spanning exactly `tokenLength` characters backward from the current caret.
 */
function buildBackwardRange(
  root: HTMLElement,
  endContainer: Node,
  endOffset: number,
  tokenLength: number,
): Range | null {
  const range = document.createRange();
  range.setEnd(endContainer, endOffset);

  let remaining = tokenLength;

  if (endContainer.nodeType === Node.TEXT_NODE) {
    if (endOffset >= remaining) {
      range.setStart(endContainer, endOffset - remaining);
      return range;
    }
    remaining -= endOffset;
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  if (endContainer.nodeType === Node.TEXT_NODE) {
    walker.currentNode = endContainer;
  } else if (endContainer.nodeType === Node.ELEMENT_NODE) {
    if (endOffset > 0 && endContainer.childNodes[endOffset - 1]) {
      let target: Node = endContainer.childNodes[endOffset - 1];
      while (target.lastChild) {
        target = target.lastChild;
      }
      if (target.nodeType === Node.TEXT_NODE) {
        const len = (target.textContent ?? '').length;
        if (len >= remaining) {
          range.setStart(target, len - remaining);
          return range;
        }
        remaining -= len;
        walker.currentNode = target;
      } else {
        walker.currentNode = target;
      }
    } else {
      walker.currentNode = endContainer;
    }
  }

  while (remaining > 0) {
    const prev = walker.previousNode();
    if (!prev) {
      return null;
    }
    const len = (prev.textContent ?? '').length;
    if (len >= remaining) {
      range.setStart(prev, len - remaining);
      return range;
    }
    remaining -= len;
  }

  return null;
}

/**
 * Moves the collapsed caret backward by `charsBack` characters inside a contenteditable root.
 * Used to accurately position {{cursor}} after multiline or single-line insertion.
 */
function moveCaretBackward(root: HTMLElement, charsBack: number): void {
  if (charsBack <= 0) return;

  const sel = root.ownerDocument?.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  const caret = sel.getRangeAt(0);
  let remaining = charsBack;

  const setCollapsedAt = (node: Node, offset: number) => {
    const nextRange = document.createRange();
    nextRange.setStart(node, offset);
    nextRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(nextRange);
  };

  if (caret.startContainer.nodeType === Node.TEXT_NODE) {
    if (caret.startOffset >= remaining) {
      setCollapsedAt(caret.startContainer, caret.startOffset - remaining);
      return;
    }
    remaining -= caret.startOffset;
  }

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
  );

  let currentBlock = findNearestBlockAncestor(caret.startContainer, root);

  if (caret.startContainer.nodeType === Node.TEXT_NODE) {
    walker.currentNode = caret.startContainer;
  } else if (caret.startContainer.nodeType === Node.ELEMENT_NODE) {
    if (caret.startOffset > 0 && caret.startContainer.childNodes[caret.startOffset - 1]) {
      let target: Node = caret.startContainer.childNodes[caret.startOffset - 1];
      while (target.lastChild) {
        target = target.lastChild;
      }
      walker.currentNode = target;
      currentBlock = findNearestBlockAncestor(target, root);

      if (target.nodeType === Node.TEXT_NODE) {
        const len = (target.textContent ?? '').length;
        if (len >= remaining) {
          setCollapsedAt(target, len - remaining);
          return;
        }
        remaining -= len;
      } else if (
        target.nodeType === Node.ELEMENT_NODE &&
        (target as HTMLElement).tagName === 'BR'
      ) {
        remaining -= 1;
        if (remaining === 0 && target.parentNode) {
          const idx = Array.prototype.indexOf.call(target.parentNode.childNodes, target);
          setCollapsedAt(target.parentNode, Math.max(0, idx));
          return;
        }
      }
    } else {
      walker.currentNode = caret.startContainer;
    }
  }

  while (remaining > 0) {
    const prev = walker.previousNode();
    if (!prev || prev === root) break;

    if (prev.nodeType === Node.ELEMENT_NODE && (prev as HTMLElement).tagName === 'BR') {
      const brBlock = findNearestBlockAncestor(prev, root);
      // Skip trailing placeholder <br> inside an otherwise empty block already counted on block transition
      const isEmptyBlockPlaceholder =
        brBlock !== root &&
        (brBlock.textContent ?? '').length === 0 &&
        brBlock.childNodes.length === 1;

      if (!isEmptyBlockPlaceholder) {
        remaining -= 1;
        if (remaining === 0 && prev.parentNode) {
          const idx = Array.prototype.indexOf.call(prev.parentNode.childNodes, prev);
          setCollapsedAt(prev.parentNode, Math.max(0, idx));
          return;
        }
      }
      continue;
    }

    if (prev.nodeType === Node.TEXT_NODE) {
      const prevBlock = findNearestBlockAncestor(prev, root);
      if (prevBlock !== currentBlock) {
        remaining -= 1; // Block transition (<p> / <div>) corresponds to a newline
        currentBlock = prevBlock;
        if (remaining === 0) {
          setCollapsedAt(prev, (prev.textContent ?? '').length);
          return;
        }
      }

      const len = (prev.textContent ?? '').length;
      if (len >= remaining) {
        setCollapsedAt(prev, len - remaining);
        return;
      }
      remaining -= len;
    }
  }
}

/**
 * Replaces a matched shortcut inside a native <input> or <textarea>.
 * Uses execCommand('insertText') first so native browser Undo (Ctrl+Z / Cmd+Z) works seamlessly.
 */
function replaceInNativeInput(
  element: HTMLInputElement | HTMLTextAreaElement,
  shortcutLength: number,
  originalShortcut: string,
  expandedText: string,
  cursorOffset: number | null,
  forcedSelectionStart?: number,
): boolean {
  const caretPos = forcedSelectionStart ?? element.selectionStart;
  if (caretPos === null || caretPos < shortcutLength) {
    return false;
  }

  const startOffset = caretPos - shortcutLength;
  const previousValue = element.value;

  // Verify the shortcut still sits right before the caret
  const currentToken = previousValue.slice(startOffset, caretPos);
  if (currentToken.length !== shortcutLength) {
    return false;
  }

  element.focus();
  element.setSelectionRange(startOffset, caretPos);

  let replacedViaExecCommand = false;
  try {
    replacedViaExecCommand = document.execCommand('insertText', false, expandedText);
  } catch {
    replacedViaExecCommand = false;
  }

  const expectedValue =
    previousValue.slice(0, startOffset) + expandedText + previousValue.slice(caretPos);

  // Fallback for controlled inputs where execCommand did not mutate the DOM value
  if (!replacedViaExecCommand || element.value !== expectedValue) {
    const prototype =
      element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

    if (nativeSetter) {
      nativeSetter.call(element, expectedValue);
    } else {
      element.setRangeText(expandedText, startOffset, caretPos, 'end');
    }

    element.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        cancelable: false,
        inputType: 'insertReplacementText',
        data: expandedText,
      }),
    );
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  const targetCaret =
    cursorOffset !== null
      ? startOffset + Math.min(cursorOffset, expandedText.length)
      : startOffset + expandedText.length;

  element.setSelectionRange(targetCaret, targetCaret);

  lastNativeUndo = {
    element,
    startOffset,
    insertedLength: expandedText.length,
    originalShortcut,
    postExpansionValue: element.value,
  };

  return true;
}

/**
 * Replaces a matched shortcut inside a contenteditable editor (Gmail, Outlook, LinkedIn, ChatGPT, etc.).
 */
function replaceInContentEditable(
  element: HTMLElement,
  shortcutLength: number,
  expandedText: string,
  cursorOffset: number | null,
  savedRange?: Range,
): boolean {
  const root = findContentEditableRoot(element);
  const sel = root.ownerDocument?.getSelection();
  if (!sel) {
    return false;
  }

  if (savedRange) {
    root.focus();
    sel.removeAllRanges();
    sel.addRange(savedRange);
  }

  if (sel.rangeCount === 0) {
    return false;
  }

  const caretRange = sel.getRangeAt(0);
  if (!root.contains(caretRange.startContainer)) {
    return false;
  }

  const tokenRange = buildBackwardRange(
    root,
    caretRange.startContainer,
    caretRange.startOffset,
    shortcutLength,
  );
  if (!tokenRange) {
    return false;
  }

  sel.removeAllRanges();
  sel.addRange(tokenRange);

  const textContentBefore = root.textContent ?? '';
  const lines = expandedText.split('\n');
  let inserted = false;

  try {
    if (lines.length === 1) {
      inserted = document.execCommand('insertText', false, expandedText);
    } else {
      // Line-by-line insertion using insertLineBreak prevents accidental form submission
      // in ChatGPT/Slack while creating proper visual newlines in Gmail/Outlook/LinkedIn.
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].length > 0) {
          const ok = document.execCommand('insertText', false, lines[i]);
          if (ok) inserted = true;
        } else if (i === 0) {
          // Clear selected shortcut even if first line is empty
          document.execCommand('delete', false);
          inserted = true;
        }
        if (i < lines.length - 1) {
          const brOk = document.execCommand('insertLineBreak', false);
          if (!brOk) {
            document.execCommand('insertText', false, '\n');
          }
          inserted = true;
        }
      }
    }
  } catch {
    inserted = false;
  }

  // Rich editors (Slate, Lexical, Draft.js) may intercept beforeinput and mutate the DOM
  // even when execCommand returns false. Detect actual content mutation cleanly.
  if (!inserted && (root.textContent ?? '') !== textContentBefore) {
    inserted = true;
  }

  if (!inserted) {
    // Graceful abort for unsupported editors so we never corrupt user state
    sel.collapseToEnd();
    return false;
  }

  if (cursorOffset !== null && cursorOffset < expandedText.length) {
    const suffixLength = expandedText.length - cursorOffset;
    moveCaretBackward(root, suffixLength);
  }

  return true;
}

/**
 * Executes a full shortcut replacement in either native inputs or contenteditable editors.
 */
export function performExpansion(params: {
  snapshot: CaretSnapshot;
  shortcutLength: number;
  originalShortcut: string;
  expandedText: string;
  cursorOffset: number | null;
}): boolean {
  const { snapshot, shortcutLength, originalShortcut, expandedText, cursorOffset } = params;

  if (
    snapshot.kind === 'input' &&
    (snapshot.element instanceof HTMLInputElement ||
      snapshot.element instanceof HTMLTextAreaElement)
  ) {
    return replaceInNativeInput(
      snapshot.element,
      shortcutLength,
      originalShortcut,
      expandedText,
      cursorOffset,
      snapshot.selectionStart,
    );
  }

  if (snapshot.kind === 'contenteditable') {
    return replaceInContentEditable(
      snapshot.element,
      shortcutLength,
      expandedText,
      cursorOffset,
      snapshot.range,
    );
  }

  return false;
}

/**
 * Lightweight single-step fallback undo for native inputs if browser native Ctrl+Z wasn't populated.
 */
export function tryFallbackNativeUndo(target: HTMLElement): boolean {
  if (!lastNativeUndo || lastNativeUndo.element !== target) {
    return false;
  }

  const entry = lastNativeUndo;
  if (entry.element.value !== entry.postExpansionValue) {
    lastNativeUndo = null;
    return false;
  }

  const restored =
    entry.postExpansionValue.slice(0, entry.startOffset) +
    entry.originalShortcut +
    entry.postExpansionValue.slice(entry.startOffset + entry.insertedLength);

  const prototype =
    entry.element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const nativeSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

  if (nativeSetter) {
    nativeSetter.call(entry.element, restored);
  } else {
    entry.element.value = restored;
  }

  const caret = entry.startOffset + entry.originalShortcut.length;
  entry.element.setSelectionRange(caret, caret);
  entry.element.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      inputType: 'historyUndo',
      data: entry.originalShortcut,
    }),
  );

  lastNativeUndo = null;
  return true;
}

export function clearNativeUndoState(): void {
  lastNativeUndo = null;
}
