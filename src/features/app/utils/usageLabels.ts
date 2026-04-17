import type { AppLanguage, RateLimitSnapshot } from "../../../types";
import * as m from "@/i18n/messages";
import { formatRelativeTime } from "../../../utils/time";

type UsageLabels = {
  sessionPercent: number | null;
  weeklyPercent: number | null;
  sessionResetLabel: string | null;
  weeklyResetLabel: string | null;
  creditsLabel: string | null;
  showWeekly: boolean;
};

const clampPercent = (value: number) => Math.min(Math.max(Math.round(value), 0), 100);

function formatResetLabel(resetsAt?: number | null, locale?: AppLanguage) {
  if (typeof resetsAt !== "number" || !Number.isFinite(resetsAt)) {
    return null;
  }
  const resetMs = resetsAt > 1_000_000_000_000 ? resetsAt : resetsAt * 1000;
  const relative = formatRelativeTime(resetMs, locale);
  const normalizedRelative =
    locale === undefined || locale === "en"
      ? relative.replace(/^in\s+/i, "")
      : relative;
  return m.usage_resets({ value: normalizedRelative }, { locale });
}

function formatCreditsLabel(
  accountRateLimits: RateLimitSnapshot | null,
  locale?: AppLanguage,
) {
  const credits = accountRateLimits?.credits ?? null;
  if (!credits?.hasCredits) {
    return null;
  }
  if (credits.unlimited) {
    return m.usage_available_credits_unlimited({}, { locale });
  }
  const balance = credits.balance?.trim() ?? "";
  if (!balance) {
    return null;
  }
  const intValue = Number.parseInt(balance, 10);
  if (Number.isFinite(intValue) && intValue > 0) {
    return m.usage_available_credits({ value: String(intValue) }, { locale });
  }
  const floatValue = Number.parseFloat(balance);
  if (Number.isFinite(floatValue) && floatValue > 0) {
    const rounded = Math.round(floatValue);
    return rounded > 0
      ? m.usage_available_credits({ value: String(rounded) }, { locale })
      : null;
  }
  return null;
}

export function getUsageLabels(
  accountRateLimits: RateLimitSnapshot | null,
  showRemaining: boolean,
  locale?: AppLanguage,
): UsageLabels {
  const usagePercent = accountRateLimits?.primary?.usedPercent;
  const globalUsagePercent = accountRateLimits?.secondary?.usedPercent;
  const sessionPercent =
    typeof usagePercent === "number"
      ? showRemaining
        ? 100 - clampPercent(usagePercent)
        : clampPercent(usagePercent)
      : null;
  const weeklyPercent =
    typeof globalUsagePercent === "number"
      ? showRemaining
        ? 100 - clampPercent(globalUsagePercent)
        : clampPercent(globalUsagePercent)
      : null;

  return {
    sessionPercent,
    weeklyPercent,
    sessionResetLabel: formatResetLabel(accountRateLimits?.primary?.resetsAt, locale),
    weeklyResetLabel: formatResetLabel(accountRateLimits?.secondary?.resetsAt, locale),
    creditsLabel: formatCreditsLabel(accountRateLimits, locale),
    showWeekly: Boolean(accountRateLimits?.secondary),
  };
}
