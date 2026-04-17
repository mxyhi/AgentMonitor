import X from "lucide-react/dist/esm/icons/x";
import * as m from "@/i18n/messages";
import { useAppLocale } from "@/i18n/I18nProvider";

type SidebarSearchBarProps = {
  isSearchOpen: boolean;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onClearSearch: () => void;
};

export function SidebarSearchBar({
  isSearchOpen,
  searchQuery,
  onSearchQueryChange,
  onClearSearch,
}: SidebarSearchBarProps) {
  const locale = useAppLocale();
  return (
    <div className={`sidebar-search${isSearchOpen ? " is-open" : ""}`}>
      {isSearchOpen && (
        <input
          className="sidebar-search-input"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder={m.sidebar_search_placeholder({}, { locale })}
          aria-label={m.sidebar_search_placeholder({}, { locale })}
          data-tauri-drag-region="false"
          autoFocus
        />
      )}
      {isSearchOpen && searchQuery.length > 0 && (
        <button
          type="button"
          className="sidebar-search-clear"
          onClick={onClearSearch}
          aria-label={m.sidebar_search_clear({}, { locale })}
          data-tauri-drag-region="false"
        >
          <X size={12} aria-hidden />
        </button>
      )}
    </div>
  );
}
