import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import { useEffect, useState } from "react";
import { useAppLocale } from "@/i18n/I18nProvider";
import * as m from "@/i18n/messages";
import type {
  AccountSnapshot,
  LocalUsageSnapshot,
  RateLimitSnapshot,
} from "../../../types";
import {
  formatCount,
  formatDayLabel,
  formatDuration,
  formatWeekRange,
} from "../homeFormatters";
import type { HomeStatCard, UsageMetric, UsageWorkspaceOption } from "../homeTypes";
import { buildHomeUsageViewModel } from "../homeUsageViewModel";

type HomeUsageSectionProps = {
  accountInfo: AccountSnapshot | null;
  accountRateLimits: RateLimitSnapshot | null;
  isLoadingLocalUsage: boolean;
  localUsageError: string | null;
  localUsageSnapshot: LocalUsageSnapshot | null;
  onRefreshLocalUsage: () => void;
  onUsageMetricChange: (metric: UsageMetric) => void;
  onUsageWorkspaceChange: (workspaceId: string | null) => void;
  usageMetric: UsageMetric;
  usageShowRemaining: boolean;
  usageWorkspaceId: string | null;
  usageWorkspaceOptions: UsageWorkspaceOption[];
};

function HomeUsageCard({ card }: { card: HomeStatCard }) {
  return (
    <div className={card.compact ? "home-usage-card is-compact" : "home-usage-card"}>
      <div className="home-usage-label">{card.label}</div>
      <div className="home-usage-value">
        <span className="home-usage-number">{card.value}</span>
        {card.suffix && <span className="home-usage-suffix">{card.suffix}</span>}
      </div>
      <div className="home-usage-caption">{card.caption}</div>
    </div>
  );
}

export function HomeUsageSection({
  accountInfo,
  accountRateLimits,
  isLoadingLocalUsage,
  localUsageError,
  localUsageSnapshot,
  onRefreshLocalUsage,
  onUsageMetricChange,
  onUsageWorkspaceChange,
  usageMetric,
  usageShowRemaining,
  usageWorkspaceId,
  usageWorkspaceOptions,
}: HomeUsageSectionProps) {
  const locale = useAppLocale();
  const [chartWeekOffset, setChartWeekOffset] = useState(0);
  const {
    accountCards,
    accountMeta,
    updatedLabel,
    usageCards,
    usageDays,
    usageInsights,
  } = buildHomeUsageViewModel({
    accountInfo,
    accountRateLimits,
    localUsageSnapshot,
    usageMetric,
    usageShowRemaining,
    locale,
  });

  const maxHistoricalWeekOffset = Math.max(0, Math.ceil(usageDays.length / 7) - 1);
  useEffect(() => {
    setChartWeekOffset((previous) => Math.min(previous, maxHistoricalWeekOffset));
  }, [maxHistoricalWeekOffset]);

  const chartWeekEnd = Math.max(0, usageDays.length - chartWeekOffset * 7);
  const chartWeekStart = Math.max(0, chartWeekEnd - 7);
  const chartDays = usageDays.slice(chartWeekStart, chartWeekEnd);
  const maxUsageValue = Math.max(
    1,
    ...chartDays.map((day) =>
      usageMetric === "tokens" ? day.totalTokens : day.agentTimeMs ?? 0,
    ),
  );
  const canShowOlderWeek = chartWeekOffset < maxHistoricalWeekOffset;
  const canShowNewerWeek = chartWeekOffset > 0;
  const chartRangeLabel =
    chartDays.length > 0
      ? formatWeekRange(chartDays, locale)
      : m.home_usage_no_chart_data({}, { locale });
  const chartRangeAriaLabel =
    chartDays.length > 0
      ? m.home_usage_week_range(
          {
            start: chartDays[0]?.day ?? "",
            end: chartDays[chartDays.length - 1]?.day ?? "",
          },
          { locale },
        )
      : m.home_usage_week({}, { locale });
  const showUsageSkeleton = isLoadingLocalUsage && !localUsageSnapshot;
  const showUsageEmpty = !isLoadingLocalUsage && !localUsageSnapshot;

  return (
    <div className="home-usage">
      <div className="home-section-header">
        <div className="home-section-title">
          {m.home_usage_snapshot({}, { locale })}
        </div>
        <div className="home-section-meta-row">
          {updatedLabel && <div className="home-section-meta">{updatedLabel}</div>}
          <button
            type="button"
            className={
              isLoadingLocalUsage
                ? "home-usage-refresh is-loading"
                : "home-usage-refresh"
            }
            onClick={onRefreshLocalUsage}
            disabled={isLoadingLocalUsage}
            aria-label={m.home_usage_refresh({}, { locale })}
            title={m.home_usage_refresh({}, { locale })}
          >
            <RefreshCw
              className={
                isLoadingLocalUsage
                  ? "home-usage-refresh-icon spinning"
                  : "home-usage-refresh-icon"
              }
              aria-hidden
            />
          </button>
        </div>
      </div>
      <div className="home-usage-controls">
        <div className="home-usage-control-group">
          <span className="home-usage-control-label">
            {m.home_usage_workspace({}, { locale })}
          </span>
          <div className="home-usage-select-wrap">
            <select
              className="home-usage-select"
              value={usageWorkspaceId ?? ""}
              onChange={(event) => onUsageWorkspaceChange(event.target.value || null)}
              disabled={usageWorkspaceOptions.length === 0}
            >
              <option value="">
                {m.home_usage_all_workspaces({}, { locale })}
              </option>
              {usageWorkspaceOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="home-usage-control-group">
          <span className="home-usage-control-label">
            {m.home_usage_view({}, { locale })}
          </span>
          <div
            className="home-usage-toggle"
            role="group"
            aria-label={m.home_usage_view_group({}, { locale })}
          >
            <button
              type="button"
              className={
                usageMetric === "tokens"
                  ? "home-usage-toggle-button is-active"
                  : "home-usage-toggle-button"
              }
              onClick={() => onUsageMetricChange("tokens")}
              aria-pressed={usageMetric === "tokens"}
            >
              {m.home_usage_tokens({}, { locale })}
            </button>
            <button
              type="button"
              className={
                usageMetric === "time"
                  ? "home-usage-toggle-button is-active"
                  : "home-usage-toggle-button"
              }
              onClick={() => onUsageMetricChange("time")}
              aria-pressed={usageMetric === "time"}
            >
              {m.home_usage_time({}, { locale })}
            </button>
          </div>
        </div>
      </div>
      {showUsageSkeleton ? (
        <div className="home-usage-skeleton">
          <div className="home-usage-grid">
            {Array.from({ length: 4 }).map((_, index) => (
              <div className="home-usage-card" key={index}>
                <span className="home-latest-skeleton home-usage-skeleton-label" />
                <span className="home-latest-skeleton home-usage-skeleton-value" />
              </div>
            ))}
          </div>
          <div className="home-usage-chart-card">
            <span className="home-latest-skeleton home-usage-skeleton-chart" />
          </div>
        </div>
      ) : showUsageEmpty ? (
        <div className="home-usage-empty">
          <div className="home-usage-empty-title">
            {m.home_usage_empty_title({}, { locale })}
          </div>
          <div className="home-usage-empty-subtitle">
            {m.home_usage_empty_subtitle({}, { locale })}
          </div>
          {localUsageError && (
            <div className="home-usage-error">{localUsageError}</div>
          )}
        </div>
      ) : (
        <>
          <div className="home-usage-grid">
            {usageCards.map((card) => (
              <HomeUsageCard card={card} key={card.label} />
            ))}
          </div>
          <div className="home-usage-chart-card">
            <div className="home-usage-chart-nav">
              <div
                className="home-usage-chart-range"
                aria-label={chartRangeAriaLabel}
                aria-live="polite"
              >
                {chartRangeLabel}
              </div>
              <div className="home-usage-chart-actions">
                {canShowOlderWeek && (
                  <button
                    type="button"
                    className="home-usage-chart-button"
                    onClick={() => setChartWeekOffset((current) => current + 1)}
                    aria-label={m.home_usage_previous_week({}, { locale })}
                    title={m.home_usage_previous_week({}, { locale })}
                  >
                    <ChevronLeft aria-hidden />
                  </button>
                )}
                <button
                  type="button"
                  className="home-usage-chart-button"
                  onClick={() => setChartWeekOffset((current) => Math.max(0, current - 1))}
                  aria-label={m.home_usage_next_week({}, { locale })}
                  title={m.home_usage_next_week({}, { locale })}
                  disabled={!canShowNewerWeek}
                >
                  <ChevronRight aria-hidden />
                </button>
              </div>
            </div>
            <div className="home-usage-chart">
              {chartDays.map((day) => {
                const value =
                  usageMetric === "tokens" ? day.totalTokens : day.agentTimeMs ?? 0;
                const height = Math.max(6, Math.round((value / maxUsageValue) * 100));
                const tooltip =
                  usageMetric === "tokens"
                    ? m.home_usage_chart_tokens_tooltip(
                        {
                          day: formatDayLabel(day.day, locale),
                          tokens: formatCount(day.totalTokens, locale),
                        },
                        { locale },
                      )
                    : m.home_usage_chart_time_tooltip(
                        {
                          day: formatDayLabel(day.day, locale),
                          value: formatDuration(day.agentTimeMs ?? 0),
                        },
                        { locale },
                      );
                return (
                  <div className="home-usage-bar" key={day.day} data-value={tooltip}>
                    <span
                      className="home-usage-bar-fill"
                      style={{ height: `${height}%` }}
                    />
                    <span className="home-usage-bar-label">
                      {formatDayLabel(day.day, locale)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="home-usage-insights">
            {usageInsights.map((card) => (
              <HomeUsageCard card={card} key={card.label} />
            ))}
          </div>
          <div className="home-usage-models">
            <div className="home-usage-models-label">
              {m.home_usage_top_models({}, { locale })}
              {usageMetric === "time" && (
                <span className="home-usage-models-hint">
                  {m.home_usage_top_models_hint({}, { locale })}
                </span>
              )}
            </div>
            <div className="home-usage-models-list">
              {localUsageSnapshot?.topModels?.length ? (
                localUsageSnapshot.topModels.map((model) => (
                  <span
                    className="home-usage-model-chip"
                    key={model.model}
                    title={m.home_usage_model_tooltip(
                      {
                        model: model.model,
                        tokens: formatCount(model.tokens, locale),
                      },
                      { locale },
                    )}
                  >
                    {model.model}
                    <span className="home-usage-model-share">
                      {model.sharePercent.toFixed(1)}%
                    </span>
                  </span>
                ))
              ) : (
                <span className="home-usage-model-empty">
                  {m.home_models_empty({}, { locale })}
                </span>
              )}
            </div>
            {localUsageError && <div className="home-usage-error">{localUsageError}</div>}
          </div>
        </>
      )}
      {accountCards.length > 0 && (
        <div className="home-account">
          <div className="home-section-header">
            <div className="home-section-title">
              {m.home_usage_account_limits({}, { locale })}
            </div>
            {accountMeta && (
              <div className="home-section-meta-row">
                <div className="home-section-meta">{accountMeta}</div>
              </div>
            )}
          </div>
          <div className="home-usage-grid home-account-grid">
            {accountCards.map((card) => (
              <HomeUsageCard card={card} key={card.label} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
