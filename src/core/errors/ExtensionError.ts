export type ExtensionErrorCode =
  | 'STORAGE_READ_FAILED'
  | 'STORAGE_WRITE_FAILED'
  | 'QUOTA_SNIPPETS_EXCEEDED'
  | 'QUOTA_FOLDERS_EXCEEDED'
  | 'DUPLICATE_SHORTCUT'
  | 'INVALID_SHORTCUT'
  | 'INVALID_INPUT'
  | 'INVALID_BACKUP_FORMAT'
  | 'PERMISSION_DENIED'
  | 'UNSUPPORTED_ENVIRONMENT'
  | 'FEATURE_REQUIRES_PRO'
  | 'UNKNOWN_ERROR';

export class ExtensionError extends Error {
  public readonly code: ExtensionErrorCode;
  public readonly userMessage: string;
  public readonly recoverable: boolean;

  constructor(
    code: ExtensionErrorCode,
    userMessage: string,
    options?: { recoverable?: boolean; cause?: unknown },
  ) {
    super(userMessage);
    this.name = 'ExtensionError';
    this.code = code;
    this.userMessage = userMessage;
    this.recoverable = options?.recoverable ?? true;
    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export function toUserErrorMessage(error: unknown, fallback = 'An unexpected error occurred.'): string {
  if (error instanceof ExtensionError) {
    return error.userMessage;
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}
