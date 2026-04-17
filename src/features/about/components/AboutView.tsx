import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useAppLocale } from "@/i18n/I18nProvider";
import * as m from "@/i18n/messages";

const GITHUB_URL = "https://github.com/Dimillian/CodexMonitor";
const TWITTER_URL = "https://x.com/dimillian";

export function AboutView() {
  const locale = useAppLocale();
  const [version, setVersion] = useState<string | null>(null);

  const handleOpenGitHub = () => {
    void openUrl(GITHUB_URL);
  };

  const handleOpenTwitter = () => {
    void openUrl(TWITTER_URL);
  };

  useEffect(() => {
    let active = true;
    const fetchVersion = async () => {
      try {
        const value = await getVersion();
        if (active) {
          setVersion(value);
        }
      } catch {
        if (active) {
          setVersion(null);
        }
      }
    };

    void fetchVersion();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="about">
      <div className="about-card">
        <div className="about-header">
          <img
            className="about-icon"
            src="/app-icon.png"
            alt={m.about_icon_alt({}, { locale })}
          />
          <div className="about-title">{m.home_title({}, { locale })}</div>
        </div>
        <div className="about-version">
          {version
            ? m.about_version_prefix({ value: version }, { locale })
            : m.about_version_unknown({}, { locale })}
        </div>
        <div className="about-tagline">
          {m.about_tagline({}, { locale })}
        </div>
        <div className="about-divider" />
        <div className="about-links">
          <button
            type="button"
            className="about-link"
            onClick={handleOpenGitHub}
          >
            GitHub
          </button>
          <span className="about-link-sep">|</span>
          <button
            type="button"
            className="about-link"
            onClick={handleOpenTwitter}
          >
            Twitter
          </button>
        </div>
        <div className="about-footer">{m.about_footer({}, { locale })}</div>
      </div>
    </div>
  );
}
