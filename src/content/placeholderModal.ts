import type { InputPlaceholderSpec } from '../core/expander/variableEngine';

const HOST_ID = 'tavriqelo-placeholder-host';

/**
 * Renders an isolated Shadow DOM dialog to collect user-provided placeholder values
 * (e.g. {{input:Client Name}}) without leaking any CSS or polluting the host website.
 * Strictly builds DOM nodes via createElement + textContent (no raw HTML injection).
 */
export function promptForPlaceholderValues(
  snippetName: string,
  placeholders: InputPlaceholderSpec[],
): Promise<Record<string, string> | null> {
  return new Promise((resolve) => {
    const existing = document.getElementById(HOST_ID);
    if (existing) {
      existing.remove();
    }

    const host = document.createElement('div');
    host.id = HOST_ID;
    host.setAttribute('data-tavriqelo-ui', 'true');
    host.style.position = 'fixed';
    host.style.inset = '0';
    host.style.zIndex = '2147483647';
    host.style.pointerEvents = 'auto';

    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      :host {
        all: initial;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      }
      .backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
      }
      .dialog {
        width: 100%;
        max-width: 400px;
        background: #ffffff;
        color: #111827;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        box-shadow: 0 20px 45px rgba(15, 23, 42, 0.22);
        overflow: hidden;
      }
      @media (prefers-color-scheme: dark) {
        .dialog {
          background: #131722;
          color: #f3f4f6;
          border-color: #23293a;
        }
        .subtitle { color: #9ca3af; }
        .label { color: #e5e7eb; }
        .input {
          background: #0b0e14;
          color: #f3f4f6;
          border-color: #2d3548;
        }
        .btn-cancel {
          background: #1e2433;
          color: #e5e7eb;
          border-color: #2d3548;
        }
      }
      .header {
        padding: 16px 20px 12px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.2);
      }
      .title {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
        line-height: 1.3;
      }
      .subtitle {
        margin: 4px 0 0;
        font-size: 12px;
        color: #4b5563;
      }
      .body {
        padding: 16px 20px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .label {
        font-size: 12px;
        font-weight: 500;
        color: #374151;
      }
      .input {
        width: 100%;
        box-sizing: border-box;
        padding: 9px 12px;
        font-size: 13px;
        border-radius: 8px;
        border: 1px solid #d1d5db;
        background: #ffffff;
        color: #111827;
        outline: none;
      }
      .input:focus {
        border-color: #6255e7;
        box-shadow: 0 0 0 2px rgba(98, 85, 231, 0.2);
      }
      .footer {
        padding: 12px 20px 16px;
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
      .btn {
        padding: 8px 16px;
        font-size: 13px;
        font-weight: 500;
        border-radius: 8px;
        cursor: pointer;
        border: 1px solid transparent;
      }
      .btn-cancel {
        background: #f3f4f6;
        color: #374151;
        border-color: #e5e7eb;
      }
      .btn-primary {
        background: #6255e7;
        color: #ffffff;
      }
      .btn-primary:hover {
        background: #5144d6;
      }
    `;

    const backdrop = document.createElement('div');
    backdrop.className = 'backdrop';

    const dialog = document.createElement('form');
    dialog.className = 'dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    const header = document.createElement('div');
    header.className = 'header';

    const title = document.createElement('h2');
    title.className = 'title';
    title.textContent = snippetName;

    const subtitle = document.createElement('p');
    subtitle.className = 'subtitle';
    subtitle.textContent = 'Fill in the placeholder values for this snippet.';

    header.append(title, subtitle);

    const body = document.createElement('div');
    body.className = 'body';

    const inputs = new Map<string, HTMLInputElement>();
    let firstInput: HTMLInputElement | null = null;

    for (const spec of placeholders) {
      const field = document.createElement('div');
      field.className = 'field';

      const label = document.createElement('label');
      label.className = 'label';
      label.textContent = spec.label;

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'input';
      input.value = spec.defaultValue;
      input.placeholder = spec.defaultValue || `Enter ${spec.label.toLowerCase()}...`;

      inputs.set(spec.key, input);
      if (!firstInput) {
        firstInput = input;
      }

      field.append(label, input);
      body.append(field);
    }

    const footer = document.createElement('div');
    footer.className = 'footer';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-cancel';
    cancelBtn.textContent = 'Cancel';

    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn btn-primary';
    submitBtn.textContent = 'Insert Snippet';

    footer.append(cancelBtn, submitBtn);
    dialog.append(header, body, footer);
    backdrop.append(dialog);
    shadow.append(style, backdrop);

    const cleanup = () => {
      document.removeEventListener('keydown', onEscape, true);
      host.remove();
    };

    const onEscape = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        ev.stopPropagation();
        cleanup();
        resolve(null);
      }
    };

    cancelBtn.addEventListener('click', () => {
      cleanup();
      resolve(null);
    });

    backdrop.addEventListener('click', (ev) => {
      if (ev.target === backdrop) {
        cleanup();
        resolve(null);
      }
    });

    dialog.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const values: Record<string, string> = {};
      inputs.forEach((inputEl, key) => {
        values[key] = inputEl.value;
      });
      cleanup();
      resolve(values);
    });

    document.addEventListener('keydown', onEscape, true);
    document.documentElement.appendChild(host);

    if (firstInput) {
      firstInput.focus();
      firstInput.select();
    }
  });
}

/**
 * Brief, unobtrusive Shadow DOM toast confirming expansion when enabled in settings.
 */
export function showExpansionToast(shortcut: string): void {
  const toastId = 'tavriqelo-expansion-toast';
  const prev = document.getElementById(toastId);
  if (prev) prev.remove();

  const host = document.createElement('div');
  host.id = toastId;
  host.setAttribute('data-tavriqelo-ui', 'true');
  host.style.position = 'fixed';
  host.style.bottom = '16px';
  host.style.right = '16px';
  host.style.zIndex = '2147483646';
  host.style.pointerEvents = 'none';

  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `
    .toast {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      font-size: 12px;
      font-weight: 500;
      padding: 8px 12px;
      border-radius: 8px;
      background: #111827;
      color: #f9fafb;
      border: 1px solid rgba(255,255,255,0.12);
      box-shadow: 0 8px 20px rgba(0,0,0,0.18);
    }
    .code {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      color: #a5b4fc;
    }
  `;

  const box = document.createElement('div');
  box.className = 'toast';
  box.append('Expanded ');
  const code = document.createElement('span');
  code.className = 'code';
  code.textContent = shortcut;
  box.append(code);

  shadow.append(style, box);
  document.documentElement.appendChild(host);

  window.setTimeout(() => {
    host.remove();
  }, 1500);
}
