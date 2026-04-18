import * as m from "@/i18n/messages";
import type { AppLanguage } from "@/types";

export const OPENAI_AUTH_REQUIRED_BEFORE_SENDING_ERROR =
  "OpenAI authentication required before sending. Sign in or configure a provider first.";

const KNOWN_THREAD_ERROR_LOCALIZERS: Record<
  string,
  (locale: AppLanguage) => string
> = {
  [OPENAI_AUTH_REQUIRED_BEFORE_SENDING_ERROR]: (locale) =>
    m.thread_error_openai_auth_required_before_sending({}, { locale }),
};

export function localizeKnownThreadErrorMessage(
  message: string,
  locale: AppLanguage,
): string {
  const localize = KNOWN_THREAD_ERROR_LOCALIZERS[message.trim()];
  return localize ? localize(locale) : message;
}
