import { useCallback, useEffect, useState } from "react";
import {
  getDefaultCodexSection,
  normalizeCodexSection,
  type CodexSection,
} from "@settings/components/settingsTypes";
import { SETTINGS_MOBILE_BREAKPOINT_PX } from "@settings/components/settingsViewConstants";
import { isNarrowSettingsViewport } from "@settings/components/settingsViewHelpers";

type UseSettingsViewNavigationParams = {
  initialSection?: CodexSection;
  serverSectionVisible: boolean;
};

export const useSettingsViewNavigation = ({
  initialSection,
  serverSectionVisible,
}: UseSettingsViewNavigationParams) => {
  const normalizedInitialSection = normalizeCodexSection(
    initialSection,
    serverSectionVisible,
  );
  const [activeSection, setActiveSection] = useState<CodexSection>(
    () =>
      normalizedInitialSection ??
      getDefaultCodexSection(serverSectionVisible),
  );
  const [isNarrowViewport, setIsNarrowViewport] = useState(() =>
    isNarrowSettingsViewport(),
  );
  const [showMobileDetail, setShowMobileDetail] = useState(Boolean(normalizedInitialSection));

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const query = window.matchMedia(`(max-width: ${SETTINGS_MOBILE_BREAKPOINT_PX}px)`);
    const applyViewportState = () => {
      setIsNarrowViewport(query.matches);
    };
    applyViewportState();
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", applyViewportState);
      return () => {
        query.removeEventListener("change", applyViewportState);
      };
    }
    query.addListener(applyViewportState);
    return () => {
      query.removeListener(applyViewportState);
    };
  }, []);

  const useMobileMasterDetail = isNarrowViewport;

  useEffect(() => {
    if (useMobileMasterDetail) {
      return;
    }
    setShowMobileDetail(false);
  }, [useMobileMasterDetail]);

  useEffect(() => {
    if (normalizedInitialSection) {
      setActiveSection(normalizedInitialSection);
      if (useMobileMasterDetail) {
        setShowMobileDetail(true);
      }
    }
  }, [normalizedInitialSection, useMobileMasterDetail]);

  const handleSelectSection = useCallback(
    (section: CodexSection) => {
      setActiveSection(section);
      if (useMobileMasterDetail) {
        setShowMobileDetail(true);
      }
    },
    [useMobileMasterDetail],
  );

  return {
    activeSection,
    showMobileDetail,
    setShowMobileDetail,
    useMobileMasterDetail,
    handleSelectSection,
  };
};
