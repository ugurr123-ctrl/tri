/**
 * Privacy & security field guard for Tavriqelo content script.
 * Ensures text expansion NEVER activates in passwords, OTP codes, payment fields,
 * authentication inputs, or payment processor iframes.
 */

const BLOCKED_INPUT_TYPES = new Set([
  'password',
  'hidden',
  'number',
  'date',
  'datetime-local',
  'month',
  'week',
  'time',
  'color',
  'range',
  'file',
  'checkbox',
  'radio',
  'submit',
  'reset',
  'button',
  'image',
]);

const SENSITIVE_AUTOCOMPLETE_TOKENS = new Set([
  'current-password',
  'new-password',
  'one-time-code',
  'cc-name',
  'cc-given-name',
  'cc-additional-name',
  'cc-family-name',
  'cc-number',
  'cc-exp',
  'cc-exp-month',
  'cc-exp-year',
  'cc-csc',
  'cc-type',
  'transaction-currency',
  'transaction-amount',
  'webauthn',
]);

const SENSITIVE_FIELD_PATTERN =
  /(password|passwd|passcode|passphrase|pin[-_ ]?code|card[-_ ]?num|cardnumber|cardholder|card[-_ ]?code|credit[-_ ]?card|debit[-_ ]?card|cc[-_ ]?num|cc[-_ ]?exp|expir(y|ation)|swift[-_ ]?bic|routing[-_ ]?num|bank[-_ ]?account|social[-_ ]?security|tax[-_ ]?id|one[-_ ]?time|auth[-_ ]?code|verification[-_ ]?code|security[-_ ]?code|secret[-_ ]?key|api[-_ ]?key|private[-_ ]?key|seed[-_ ]?phrase|recovery[-_ ]?phrase|(?<![a-z0-9])(pwd|pin|cvv|cvc|csc|iban|ssn|otp|2fa|mfa|totp)(?![a-z0-9]))/i;

const HARD_BLOCKED_PAYMENT_HOSTS = [
  'stripe.com',
  'js.stripe.com',
  'checkout.stripe.com',
  'braintreegateway.com',
  'adyen.com',
  'checkout.com',
  'paypal.com',
  'squareup.com',
  'squareupsandbox.com',
  'klarna.com',
  'authorize.net',
  '2checkout.com',
  'worldpay.com',
  'paddle.com',
  'lemonsqueezy.com',
];

export function isHardBlockedOrigin(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return HARD_BLOCKED_PAYMENT_HOSTS.some(
    (blocked) => host === blocked || host.endsWith(`.${blocked}`),
  );
}

export function isDomainExcluded(hostname: string, excludedDomains: string[]): boolean {
  const host = hostname.toLowerCase();
  if (!host) {
    return true;
  }
  if (isHardBlockedOrigin(host)) {
    return true;
  }

  for (const pattern of excludedDomains) {
    const clean = pattern.trim().toLowerCase();
    if (!clean) continue;

    if (clean.startsWith('*.')) {
      const base = clean.slice(2);
      if (host === base || host.endsWith(`.${base}`)) {
        return true;
      }
    } else if (host === clean || host.endsWith(`.${clean}`)) {
      return true;
    }
  }

  return false;
}

function getAssociatedLabelText(element: HTMLElement): string {
  const parts: string[] = [];

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    if (element.labels) {
      for (const label of Array.from(element.labels)) {
        if (label.textContent) {
          parts.push(label.textContent);
        }
      }
    }
  }

  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    for (const id of labelledBy.split(/\s+/)) {
      const labelEl = element.ownerDocument?.getElementById(id);
      if (labelEl?.textContent) {
        parts.push(labelEl.textContent);
      }
    }
  }

  return parts.join(' ').slice(0, 200);
}

/**
 * Checks whether an element is sensitive (password, OTP, credit card, payment, secret key).
 */
export function isSensitiveElement(element: HTMLElement): boolean {
  if (element instanceof HTMLInputElement) {
    const inputType = (element.type || 'text').toLowerCase();
    if (BLOCKED_INPUT_TYPES.has(inputType)) {
      return true;
    }
    if (element.readOnly || element.disabled) {
      return true;
    }
  }

  if (element instanceof HTMLTextAreaElement) {
    if (element.readOnly || element.disabled) {
      return true;
    }
  }

  // Check autocomplete tokens (space-separated in HTML spec)
  const autocomplete = (element.getAttribute('autocomplete') || '').toLowerCase();
  if (autocomplete) {
    const tokens = autocomplete.split(/\s+/);
    for (const token of tokens) {
      if (SENSITIVE_AUTOCOMPLETE_TOKENS.has(token)) {
        return true;
      }
    }
  }

  // Check CSS password masking (e.g. -webkit-text-security: disc)
  if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
    const computed = window.getComputedStyle(element) as CSSStyleDeclaration & {
      webkitTextSecurity?: string;
    };
    const textSecurity = computed.webkitTextSecurity;
    if (textSecurity && textSecurity !== 'none') {
      return true;
    }
  }

  // Check element attributes & label text
  const inspectedMetadata = [
    element.getAttribute('name') || '',
    element.getAttribute('id') || '',
    element.getAttribute('placeholder') || '',
    element.getAttribute('aria-label') || '',
    element.getAttribute('data-testid') || '',
    element.getAttribute('data-qa') || '',
    element.getAttribute('inputmode') === 'numeric' &&
    element.getAttribute('maxlength') &&
    Number(element.getAttribute('maxlength')) <= 8
      ? 'otp'
      : '',
    getAssociatedLabelText(element),
  ].join(' ');

  if (SENSITIVE_FIELD_PATTERN.test(inspectedMetadata)) {
    return true;
  }

  // Check if inside a payment/auth container explicitly marked with sensitive attributes
  const parentForm = element.closest('form');
  if (parentForm) {
    const formMeta = `${parentForm.getAttribute('id') || ''} ${parentForm.getAttribute('name') || ''} ${parentForm.getAttribute('action') || ''}`;
    if (/(checkout|payment|billing|card|credit|2fa|mfa|totp|login|signin)/i.test(formMeta)) {
      // Allow regular email/message fields on login pages only if clearly not password/OTP;
      // block all fields inside payment/checkout/2fa forms.
      if (/(checkout|payment|billing|card|credit|2fa|mfa|totp)/i.test(formMeta)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Checks whether an element is a supported editable target.
 */
export function isSupportedEditableElement(node: EventTarget | null): node is HTMLElement {
  if (!(node instanceof HTMLElement)) {
    return false;
  }

  // Never activate inside Tavriqelo's own Shadow DOM placeholder modal
  if (node.closest('[data-tavriqelo-ui="true"]')) {
    return false;
  }
  const rootNode = node.getRootNode();
  if (
    rootNode instanceof ShadowRoot &&
    rootNode.host?.getAttribute('data-tavriqelo-ui') === 'true'
  ) {
    return false;
  }

  if (node instanceof HTMLTextAreaElement) {
    return !node.disabled && !node.readOnly;
  }

  if (node instanceof HTMLInputElement) {
    const type = (node.type || 'text').toLowerCase();
    const allowedTypes = new Set(['text', 'search', 'email', 'url', 'tel']);
    return allowedTypes.has(type) && !node.disabled && !node.readOnly;
  }

  if (node.isContentEditable) {
    if (
      node.getAttribute('aria-readonly') === 'true' ||
      node.getAttribute('aria-disabled') === 'true'
    ) {
      return false;
    }
    // Gracefully skip canvas-backed / custom non-standard virtual editors where DOM mutation breaks state
    if (
      node.classList.contains('monaco-mouse-cursor-text') ||
      node.closest('.kix-appview-editor') // Google Docs canvas editor
    ) {
      return false;
    }
    return true;
  }

  return false;
}
