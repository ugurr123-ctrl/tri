# Tavriqelo – Smart Text Expander

Tavriqelo is a privacy-first **Google Chrome Extension (Manifest V3)** that automatically expands short keyboard shortcuts (such as `/thanks`) into reusable single-line or multiline text snippets with dynamic variables across Gmail, Outlook, LinkedIn, ChatGPT, and other compatible websites.

All snippets, folders, settings, and usage statistics are stored **100% locally** in `chrome.storage.local`. Zero typed text is ever transmitted to external servers.

---

## Features

- **Snippet Management**: Create, edit, duplicate, search, filter, toggle, and organize snippets into folders with automatic duplicate shortcut detection.
- **Real Text Expansion**: Expands shortcuts on `Space` or `Tab` across `<input>`, `<textarea>`, and `contenteditable` editors (Gmail, Outlook, LinkedIn, ChatGPT, Slack, Notion, GitHub, X, and optional user-granted sites), preserving cursor position (`{{cursor}}`) and native browser Undo (`Ctrl+Z` / `Cmd+Z`).
- **Dynamic Template Variables**:
  - Free: `{{date}}`, `{{date:YYYY-MM-DD}}`, `{{date:MM/DD/YYYY}}`, `{{date:DD/MM/YYYY}}`, `{{date:long}}`, `{{time}}`, `{{time:24h}}`, `{{cursor}}`.
  - Pro: Custom user-defined variables (`{{var:company}}`) and interactive Shadow DOM prompt placeholders (`{{input:Client Name}}`, `{{input:Plan|default=Team}}`).
- **7-Category English Template Library**: 28 ready-to-use templates covering Customer Support, Sales, E-commerce, Freelancers, Business Emails, Recruitment, and Social Media.
- **Local Usage Dashboard**: Total snippets, total expansions, estimated keystrokes saved, estimated time saved (40 WPM baseline), most-used snippets table, and Pro 14-day/folder analytics.
- **Settings & Backups**: Light/Dark/System themes, trigger key (`Space` / `Tab`), global toggle, website exclusion list, optional website permissions manager, validated JSON import/export, and confirmed local data reset.
- **Strict Privacy & Field Protection**: Automatically skips password inputs, OTP/2FA fields, credit card/payment inputs (`autocomplete="cc-*"`), and payment processor origins (Stripe, PayPal, Adyen, Braintree, Square, Klarna, etc.).

---

## Installation & Build Instructions

### Prerequisites
- Node.js 20.19+ or 22.12+ and npm
- Google Chrome (v114+) or Chromium-based browser

### 1. Install dependencies
```bash
npm install
```

### 2. Build the production Chrome extension
```bash
npm run build
```

This command runs Vite + esbuild to generate a self-contained, Manifest V3-compliant `dist/` directory containing:
- `dist/manifest.json`
- `dist/popup.html` (380px popup interface)
- `dist/options.html` (full-page options dashboard)
- `dist/content.js` (self-contained IIFE content script)
- `dist/background.js` (self-contained ES module service worker)
- `dist/icons/icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`
- Locally bundled JS/CSS assets (zero external CDN requests)

The build step automatically validates that `dist/manifest.json` exists and that every referenced file is present inside `dist/`.

To regenerate the PNG icon assets from `scripts/generate-icons.mjs`:
```bash
npm run build:icons
```

---

## Loading in Google Chrome (Developer Mode)

1. Run `npm run build`.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** using the toggle in the top-right corner.
4. Click **Load unpacked**.
5. Select the `dist/` directory inside this repository.
6. Pin **Tavriqelo – Smart Text Expander** from the Chrome Extensions toolbar menu.
7. Click the Tavriqelo icon to open the 380px popup, or click **Manage Dashboard** (or right-click the icon → **Options**) to open the full-page dashboard.

---

## Development Instructions

- **Type-check**: `npm run lint`
- **Dev server (UI inspection)**: `npm run dev` (serves the Options UI locally on port 3000 with an automatic `localStorage` fallback when `chrome.storage` is unavailable)
- **Extension rebuild**: `npm run build` followed by clicking the **Reload** button on the Tavriqelo card in `chrome://extensions` (and refreshing open target tabs so the updated `content.js` attaches).

---

## Architecture Overview

Tavriqelo is structured as a modular Manifest V3 foundation reusable across future independent Chrome extensions:

```text
public/
  manifest.json                  # Manifest V3 configuration, CSP, minimal & optional permissions
  icons/                         # Generated 16, 32, 48, 128px PNG icons
scripts/
  generate-icons.mjs             # Deterministic pure-Node PNG icon generator
popup.html                       # 380px extension action popup HTML
options.html                     # Full-page dashboard HTML
src/
  types/extension.ts             # Shared domain interfaces & storage keys
  core/
    errors/ExtensionError.ts     # Structured typed error codes & user-safe messages
    sanitize/sanitize.ts         # Plain-text, shortcut, domain, variable & JSON backup validation
    expander/
      fieldGuard.ts              # Password, OTP, payment field & payment-origin protection
      shortcutMatcher.ts         # Minimal trailing-token matcher (no keystroke logging)
      variableEngine.ts          # Date, time, cursor, custom variable & input prompt engine
    entitlement/
      types.ts                   # Free vs Pro limits & EntitlementProvider contract
      entitlementService.ts      # Local Free default + clearly labeled dev-only preview adapter
  services/
    storage/
      storageAdapter.ts          # chrome.storage.local wrapper + chrome.storage.onChanged bus
      snippetRepository.ts       # Snippet/folder CRUD, duplicate detection, quota enforcement
      settingsService.ts         # Theme, trigger, exclusions & custom variables
      statsService.ts            # Local usage statistics & keystrokes/time saved calculation
      backupService.ts           # JSON backup export, validated import & confirmed reset
    chrome/
      permissionsService.ts      # chrome.permissions & activeTab origin permission helpers
  data/
    defaultData.ts               # Starter folders & snippets (including /thanks)
    templateLibrary.ts           # 28 English templates across 7 categories
  content/
    domAdapter.ts                # Native input/textarea & contenteditable expansion + undo + cursor
    placeholderModal.ts          # Isolated Shadow DOM prompt dialog & expansion toast
    index.ts                     # MV3 content script entry point
  background/
    index.ts                     # MV3 service worker (defaults, dynamic optional scripts, stats)
  components/                    # Reusable accessible UI components & SnippetModal
  hooks/                         # useTheme & useExtensionState
  popup/                         # 380px popup React application
  options/                       # Full-page dashboard & 6 management views
```

---

## Permission Explanations

Tavriqelo requests the minimum Chrome permissions necessary:

| Permission | Why It Is Needed |
| --- | --- |
| `storage` | Persists your snippets, folders, settings, and local usage statistics inside `chrome.storage.local`. |
| `scripting` | Dynamically registers `content.js` on additional websites only after you explicitly grant optional site access, and injects into the current tab when you click "Enable on this site". |
| `activeTab` | Allows the 380px popup to inspect the current tab's hostname when you click the extension icon so you can enable or exclude that specific site without requesting the broad `tabs` permission. |
| Core `content_scripts` matches | Enables immediate out-of-the-box expansion on Gmail, Outlook, LinkedIn, ChatGPT, Slack, Notion, GitHub, and X. |
| `optional_host_permissions` (`https://*/*`, `http://*/*`) | Never requested at install time. Only requested interactively when you choose "Enable on this site", "Grant Site", or "Allow All Websites" in Settings. |

---

## Testing Checklist

Use this checklist after loading `dist/` via `chrome://extensions` → **Load unpacked**:

1. **Snippet Creation**: Create a new snippet from both the 380px Popup ("New") and the full-page Options Dashboard ("New Snippet"). Verify it appears immediately in both views.
2. **Editing & Deletion**: Edit a snippet's shortcut, name, folder, and body; duplicate a snippet; delete a snippet after confirming in the modal. Verify updates sync immediately without reloading.
3. **Shortcut Expansion**: Open Gmail, LinkedIn, or ChatGPT, type `/thanks`, and press `Space` (or `Tab` when configured). Verify `/thanks` is replaced by the full thank-you message.
4. **Multiline Expansion**: Expand `/thanks` or `/ticket` inside a `<textarea>` and inside Gmail/ChatGPT `contenteditable` composers. Verify line breaks render cleanly and ChatGPT does not accidentally submit the prompt on newline insertion.
5. **Dynamic `contenteditable` Fields**: Open a new Gmail compose popup, LinkedIn message overlay, or start a new ChatGPT conversation without refreshing the page. Verify shortcuts expand inside dynamically mounted editors.
6. **Cursor Positioning**: Expand `/meet` (contains `{{cursor}}` after `Hi `). Verify the text caret lands directly after `Hi ` in both `<textarea>` and `contenteditable` fields.
7. **Password & Payment Field Exclusion**: Attempt to expand `/thanks` inside `<input type="password">`, an OTP/2FA input (`autocomplete="one-time-code"`), a credit card input (`autocomplete="cc-number"`), or any Stripe/PayPal checkout page. Verify Tavriqelo never activates.
8. **Website Exclusion**: Add a domain (e.g. `mail.google.com`) in Settings → Website Exclusion List (or click "Exclude site" in Popup). Verify shortcuts do not expand on that domain until removed.
9. **Duplicate Shortcut Handling**: Attempt to create or edit a snippet using an existing shortcut (e.g. `/thanks`). Verify inline duplicate warning prevents saving conflicting shortcuts and respects the Case-Sensitive Shortcuts setting.
10. **Data Persistence**: Create a snippet, toggle settings, trigger an expansion, close and reopen Chrome, and verify all snippets, folders, settings, and local usage statistics persist in `chrome.storage.local`.
11. **Import & Export**: Export a JSON backup in Settings, delete a snippet, then import the JSON file in Merge mode and Replace mode. Verify snippets/folders restore accurately and malformed JSON files show a clear validation error.
12. **Dark Mode**: Switch between Light, Dark, and System themes in Settings. Verify both the Options Dashboard and Popup update cleanly with legible contrast and no flash or broken surfaces.
13. **Extension Permissions**: Open a website outside the default core list (e.g. `https://example.com` or `https://zendesk.com`), open the Popup, click **Enable on this site**, accept Chrome's permission prompt, and verify expansion activates immediately. Then revoke the permission in Settings → Website Permissions and verify it is removed.

---

## Known Limitations

- **Canvas-based editors**: Google Docs uses a custom `<canvas>` rendering surface rather than standard DOM text inputs or `contenteditable` nodes, so Tavriqelo intentionally skips `.kix-appview-editor` to avoid corrupting document state.
- **Code editors with custom virtualized buffers**: Editors like Monaco (VS Code Web) manage synthetic cursors outside standard DOM selection APIs and are skipped gracefully.
- **Cross-origin sandboxed iframes**: Chrome blocks content script injection into `chrome://`, Chrome Web Store pages (`chrome.google.com/webstore`), and strict sandboxed third-party iframes.
- **Undo in custom frameworks**: Native browser Undo (`Ctrl+Z` / `Cmd+Z`) is supported via `document.execCommand('insertText')` and a native-input fallback snapshot, though some heavily customized rich-text editors maintain independent undo stacks.

---

## Future Payment & License Integration Plan ($14.99 One-Time Pro)

Tavriqelo separates feature gating from billing via the `EntitlementProvider` interface (`src/core/entitlement/types.ts`). No fake payments or insecure client-only license keys are present in this codebase.

Planned production rollout:
1. **Checkout**: Redirect users from the Plan page to a hosted Stripe Checkout or Lemon Squeezy checkout session for the **$14.99 one-time Pro purchase**.
2. **Server-Side License Verification**: Deploy a lightweight backend endpoint (e.g. Cloudflare Workers / Cloud Run) that verifies webhook payment completion and issues short-lived cryptographically signed JWT/Ed25519 entitlement tokens bound to a license ID.
3. **Extension Adapter**: Implement `ServerVerifiedEntitlementProvider` conforming to `EntitlementProvider`, verifying token signatures locally using Web Crypto (`crypto.subtle.verify`) with the embedded public key and refreshing periodically in `background.js`.
4. **Production Enforcement**: `ALLOW_DEV_ENTITLEMENT_PREVIEW` is bound strictly to `import.meta.env.DEV`, so production builds (`npm run build`) automatically strip development-only Pro toggling and enforce Free quotas until a server-verified provider is configured.
