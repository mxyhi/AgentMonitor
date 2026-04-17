import * as m from "@/i18n/messages";
import { useAppLocale } from "@/i18n/I18nProvider";

type ThreadLoadingProps = {
  nested?: boolean;
};

export function ThreadLoading({ nested }: ThreadLoadingProps) {
  const locale = useAppLocale();
  return (
    <div
      className={`thread-loading${nested ? " thread-loading-nested" : ""}`}
      aria-label={m.sidebar_loading_agents({}, { locale })}
    >
      <span className="thread-skeleton thread-skeleton-wide" />
      <span className="thread-skeleton" />
      <span className="thread-skeleton thread-skeleton-short" />
    </div>
  );
}
