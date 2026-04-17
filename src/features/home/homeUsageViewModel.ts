import type {
  AccountSnapshot,
  AppLanguage,
  LocalUsageDay,
  LocalUsageSnapshot,
  RateLimitSnapshot,
} from "../../types";
import { formatRelativeTime } from "../../utils/time";
import { getUsageLabels } from "../app/utils/usageLabels";
import {
  formatCompactNumber,
  formatCount,
  formatCreditsBalance,
  formatDayCount,
  formatDayLabel,
  formatDuration,
  formatDurationCompact,
  formatPlanType,
  formatWindowDuration,
  isUsageDayActive,
} from "./homeFormatters";
import * as m from "@/i18n/messages";
import type { HomeStatCard, UsageMetric } from "./homeTypes";

type HomeUsageViewModel = {
  accountCards: HomeStatCard[];
  accountMeta: string | null;
  updatedLabel: string | null;
  usageCards: HomeStatCard[];
  usageDays: LocalUsageDay[];
  usageInsights: HomeStatCard[];
};

function buildWindowCaption({
  resetLabel,
  windowDurationMins,
  fallback,
  locale,
}: {
  resetLabel: string | null;
  windowDurationMins: number | null | undefined;
  fallback: string;
  locale: AppLanguage;
}) {
  const parts = [
    resetLabel,
    formatWindowDuration(windowDurationMins, locale),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : fallback;
}

function formatAccountLabel(
  value: AccountSnapshot["type"] | null | undefined,
  locale: AppLanguage,
) {
  if (value === "chatgpt") {
    return m.home_account_type_chatgpt({}, { locale });
  }
  if (value === "apikey") {
    return m.home_account_type_apikey({}, { locale });
  }
  return m.home_account_type_connected({}, { locale });
}

export function buildHomeUsageViewModel({
  accountInfo,
  accountRateLimits,
  localUsageSnapshot,
  usageMetric,
  usageShowRemaining,
  locale,
}: {
  accountInfo: AccountSnapshot | null;
  accountRateLimits: RateLimitSnapshot | null;
  localUsageSnapshot: LocalUsageSnapshot | null;
  usageMetric: UsageMetric;
  usageShowRemaining: boolean;
  locale: AppLanguage;
}): HomeUsageViewModel {
  const usageTotals = localUsageSnapshot?.totals ?? null;
  const usageDays = localUsageSnapshot?.days ?? [];
  const latestUsageDay = usageDays[usageDays.length - 1] ?? null;
  const last7Days = usageDays.slice(-7);
  const last7Tokens = last7Days.reduce((total, day) => total + day.totalTokens, 0);
  const last7Input = last7Days.reduce((total, day) => total + day.inputTokens, 0);
  const last7Cached = last7Days.reduce(
    (total, day) => total + day.cachedInputTokens,
    0,
  );
  const last7AgentMs = last7Days.reduce(
    (total, day) => total + (day.agentTimeMs ?? 0),
    0,
  );
  const last30AgentMs = usageDays.reduce(
    (total, day) => total + (day.agentTimeMs ?? 0),
    0,
  );
  const averageDailyAgentMs =
    last7Days.length > 0 ? Math.round(last7AgentMs / last7Days.length) : 0;
  const last7AgentRuns = last7Days.reduce(
    (total, day) => total + (day.agentRuns ?? 0),
    0,
  );
  const last30AgentRuns = usageDays.reduce(
    (total, day) => total + (day.agentRuns ?? 0),
    0,
  );
  const averageTokensPerRun =
    last7AgentRuns > 0 ? Math.round(last7Tokens / last7AgentRuns) : null;
  const averageRunDurationMs =
    last7AgentRuns > 0 ? Math.round(last7AgentMs / last7AgentRuns) : null;
  const last7ActiveDays = last7Days.filter(isUsageDayActive).length;
  const last30ActiveDays = usageDays.filter(isUsageDayActive).length;
  const averageActiveDayAgentMs =
    last7ActiveDays > 0 ? Math.round(last7AgentMs / last7ActiveDays) : null;
  const peakAgentDay = usageDays.reduce<
    | { day: string; agentTimeMs: number }
    | null
  >((best, day) => {
    const value = day.agentTimeMs ?? 0;
    if (value <= 0) {
      return best;
    }
    if (!best || value > best.agentTimeMs) {
      return { day: day.day, agentTimeMs: value };
    }
    return best;
  }, null);

  let longestStreak = 0;
  let runningStreak = 0;
  for (const day of usageDays) {
    if (isUsageDayActive(day)) {
      runningStreak += 1;
      longestStreak = Math.max(longestStreak, runningStreak);
    } else {
      runningStreak = 0;
    }
  }

  const usageCards: HomeStatCard[] =
    usageMetric === "tokens"
      ? [
          {
            label: m.home_card_today({}, { locale }),
            value: formatCompactNumber(latestUsageDay?.totalTokens ?? 0),
            suffix: m.home_suffix_tokens({}, { locale }),
            caption: latestUsageDay
              ? m.home_caption_day_breakdown(
                  {
                    day: formatDayLabel(latestUsageDay.day, locale),
                    input: formatCount(latestUsageDay.inputTokens, locale),
                    output: formatCount(latestUsageDay.outputTokens, locale),
                  },
                  { locale },
                )
              : m.home_caption_latest_available_day({}, { locale }),
          },
          {
            label: m.home_card_last_7_days({}, { locale }),
            value: formatCompactNumber(usageTotals?.last7DaysTokens ?? last7Tokens),
            suffix: m.home_suffix_tokens({}, { locale }),
            caption: m.home_caption_avg_per_day(
              { value: formatCompactNumber(usageTotals?.averageDailyTokens) },
              { locale },
            ),
          },
          {
            label: m.home_card_last_30_days({}, { locale }),
            value: formatCompactNumber(usageTotals?.last30DaysTokens ?? last7Tokens),
            suffix: m.home_suffix_tokens({}, { locale }),
            caption: m.home_caption_total(
              {
                value: formatCount(
                  usageTotals?.last30DaysTokens ?? last7Tokens,
                  locale,
                ),
              },
              { locale },
            ),
          },
          {
            label: m.home_card_cache_hit_rate({}, { locale }),
            value: usageTotals
              ? `${usageTotals.cacheHitRatePercent.toFixed(1)}%`
              : "--",
            caption: m.home_caption_last_7_days({}, { locale }),
          },
          {
            label: m.home_card_cached_tokens({}, { locale }),
            value: formatCompactNumber(last7Cached),
            suffix: m.home_suffix_saved({}, { locale }),
            caption:
              last7Input > 0
                ? m.home_caption_prompt_share(
                    { value: ((last7Cached / last7Input) * 100).toFixed(1) },
                    { locale },
                  )
                : m.home_caption_last_7_days({}, { locale }),
          },
          {
            label: m.home_card_avg_per_run({}, { locale }),
            value:
              averageTokensPerRun === null
                ? "--"
                : formatCompactNumber(averageTokensPerRun),
            suffix: m.home_suffix_tokens({}, { locale }),
            caption:
              last7AgentRuns > 0
                ? m.home_caption_runs_last_7_days(
                    { value: formatCount(last7AgentRuns, locale) },
                    { locale },
                  )
                : m.home_caption_no_runs_yet({}, { locale }),
          },
          {
            label: m.home_card_peak_day({}, { locale }),
            value: formatDayLabel(usageTotals?.peakDay, locale),
            caption: m.home_caption_total(
              { value: formatCount(usageTotals?.peakDayTokens, locale) },
              { locale },
            ),
          },
        ]
      : [
          {
            label: m.home_card_last_7_days({}, { locale }),
            value: formatDurationCompact(last7AgentMs),
            suffix: m.home_suffix_agent_time({}, { locale }),
            caption: m.home_caption_avg_per_day(
              { value: formatDurationCompact(averageDailyAgentMs) },
              { locale },
            ),
          },
          {
            label: m.home_card_last_30_days({}, { locale }),
            value: formatDurationCompact(last30AgentMs),
            suffix: m.home_suffix_agent_time({}, { locale }),
            caption: m.home_caption_total(
              { value: formatDuration(last30AgentMs) },
              { locale },
            ),
          },
          {
            label: m.home_card_runs({}, { locale }),
            value: formatCount(last7AgentRuns, locale),
            suffix: m.home_suffix_runs({}, { locale }),
            caption: m.home_caption_total(
              { value: formatCount(last30AgentRuns, locale) },
              { locale },
            ),
          },
          {
            label: m.home_card_avg_per_run({}, { locale }),
            value: formatDurationCompact(averageRunDurationMs),
            caption:
              last7AgentRuns > 0
                ? m.home_caption_across_runs(
                    { value: formatCount(last7AgentRuns, locale) },
                    { locale },
                  )
                : m.home_caption_no_runs_yet({}, { locale }),
          },
          {
            label: m.home_card_avg_per_active_day({}, { locale }),
            value: formatDurationCompact(averageActiveDayAgentMs),
            caption:
              last7ActiveDays > 0
                ? m.home_caption_active_days_last_7(
                    { value: formatCount(last7ActiveDays, locale) },
                    { locale },
                  )
                : m.home_caption_no_active_days_yet({}, { locale }),
          },
          {
            label: m.home_card_peak_day({}, { locale }),
            value: formatDayLabel(peakAgentDay?.day ?? null, locale),
            caption: m.home_caption_agent_time(
              { value: formatDurationCompact(peakAgentDay?.agentTimeMs ?? 0) },
              { locale },
            ),
          },
        ];

  const usageInsights = [
    {
      label: m.home_card_longest_streak({}, { locale }),
      value: longestStreak > 0 ? formatDayCount(longestStreak, locale) : "--",
      caption:
        longestStreak > 0
          ? m.home_caption_usage_range({}, { locale })
          : m.home_caption_no_active_streak({}, { locale }),
      compact: true,
    },
    {
      label: m.home_card_active_days({}, { locale }),
      value:
        last7Days.length > 0
          ? `${formatCount(last7ActiveDays, locale)} / ${formatCount(last7Days.length, locale)}`
          : "--",
      caption:
        usageDays.length > 0
          ? m.home_caption_active_days_range(
              {
                active: formatCount(last30ActiveDays, locale),
                total: formatCount(usageDays.length, locale),
              },
              { locale },
            )
          : m.home_caption_no_activity_yet({}, { locale }),
      compact: true,
    },
  ] satisfies HomeStatCard[];

  const usagePercentLabels = getUsageLabels(
    accountRateLimits,
    usageShowRemaining,
    locale,
  );
  const planLabel = formatPlanType(accountRateLimits?.planType ?? accountInfo?.planType);
  const creditsBalance = formatCreditsBalance(
    accountRateLimits?.credits?.balance,
    locale,
  );
  const accountCards: HomeStatCard[] = [];

  if (usagePercentLabels.sessionPercent !== null) {
    accountCards.push({
      label: usageShowRemaining
        ? m.home_card_session_left({}, { locale })
        : m.home_card_session_usage({}, { locale }),
      value: `${usagePercentLabels.sessionPercent}%`,
      caption: buildWindowCaption({
        resetLabel: usagePercentLabels.sessionResetLabel,
        windowDurationMins: accountRateLimits?.primary?.windowDurationMins,
        fallback: m.home_caption_current_window({}, { locale }),
        locale,
      }),
    });
  }

  if (usagePercentLabels.showWeekly && usagePercentLabels.weeklyPercent !== null) {
    accountCards.push({
      label: usageShowRemaining
        ? m.home_card_weekly_left({}, { locale })
        : m.home_card_weekly_usage({}, { locale }),
      value: `${usagePercentLabels.weeklyPercent}%`,
      caption: buildWindowCaption({
        resetLabel: usagePercentLabels.weeklyResetLabel,
        windowDurationMins: accountRateLimits?.secondary?.windowDurationMins,
        fallback: m.home_caption_longer_window({}, { locale }),
        locale,
      }),
    });
  }

  if (accountRateLimits?.credits?.hasCredits) {
    accountCards.push(
      accountRateLimits.credits.unlimited
        ? {
            label: m.home_card_credits({}, { locale }),
            value: m.home_value_unlimited({}, { locale }),
            caption: m.home_caption_available_balance({}, { locale }),
          }
        : {
            label: m.home_card_credits({}, { locale }),
            value: creditsBalance ?? "--",
            suffix: creditsBalance ? m.home_suffix_credits({}, { locale }) : null,
            caption: m.home_caption_available_balance({}, { locale }),
          },
    );
  }

  if (planLabel) {
    accountCards.push({
      label: m.home_card_plan({}, { locale }),
      value: planLabel,
      caption: formatAccountLabel(accountInfo?.type, locale),
    });
  }

  return {
    accountCards,
    accountMeta: accountInfo?.email ?? null,
    updatedLabel: localUsageSnapshot
      ? m.home_updated(
          { value: formatRelativeTime(localUsageSnapshot.updatedAt, locale) },
          { locale },
        )
      : null,
    usageCards,
    usageDays,
    usageInsights,
  };
}
