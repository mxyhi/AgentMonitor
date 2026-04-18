// @vitest-environment jsdom
import { openUrl } from "@tauri-apps/plugin-opener";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/I18nProvider";
import { setLocale } from "@/i18n/runtime";
import { StartupAiSetupWizard } from "./StartupAiSetupWizard";

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(),
}));

afterEach(async () => {
  cleanup();
  vi.clearAllMocks();
  await setLocale("en", { reload: false });
});

const FIXED_PROVIDERS = [
  {
    id: "airouter",
    name: "Airouter",
    baseUrl: "https://airouter.mxyhi.com/v1",
    apiKey: "sk-airouter",
    builtIn: true,
  },
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    apiKey: null,
    builtIn: true,
  },
  {
    id: "local",
    name: "Local",
    baseUrl: "http://127.0.0.1:9208/v1",
    apiKey: null,
    builtIn: true,
  },
] as const;

function renderWizard(selectedProviderId = "airouter") {
  const onSaveSettings = vi.fn().mockResolvedValue(undefined);

  render(
    <I18nProvider locale="en">
      <StartupAiSetupWizard
        providers={[...FIXED_PROVIDERS]}
        appLanguage="en"
        selectedProviderId={selectedProviderId}
        selectedProviderName="Airouter"
        configuredBaseUrl={null}
        apiKeyConfigured={false}
        loginRequired
        loginBusy={false}
        loginAvailable
        settingsBusy={false}
        settingsError={null}
        onSignIn={vi.fn()}
        onSaveSettings={onSaveSettings}
        onUpdateAppLanguage={vi.fn().mockResolvedValue(undefined)}
        onDismiss={vi.fn()}
      />
    </I18nProvider>,
  );

  return {
    onSaveSettings,
  };
}

describe("StartupAiSetupWizard", () => {
  it("keeps the OpenAI sign-in button visible even when login is not required", () => {
    render(
      <I18nProvider locale="en">
        <StartupAiSetupWizard
          providers={[...FIXED_PROVIDERS]}
          appLanguage="en"
          selectedProviderId="airouter"
          selectedProviderName="Airouter"
          configuredBaseUrl="https://airouter.mxyhi.com/v1"
          apiKeyConfigured
          loginRequired={false}
          loginBusy={false}
          loginAvailable
          settingsBusy={false}
          settingsError={null}
          onSignIn={vi.fn()}
          onSaveSettings={vi.fn().mockResolvedValue(undefined)}
          onUpdateAppLanguage={vi.fn().mockResolvedValue(undefined)}
          onDismiss={vi.fn()}
        />
      </I18nProvider>,
    );

    expect(
      screen.getByRole("button", { name: "Sign in to OpenAI" }),
    ).toBeTruthy();
  });

  it("removes provider status card and opens Airouter purchase page from summary link", () => {
    renderWizard();

    expect(screen.queryByText("Current default provider")).toBeNull();
    expect(screen.queryByText("API Key missing")).toBeNull();

    fireEvent.click(screen.getByRole("link", { name: "No API key yet? Buy one" }));

    expect(openUrl).toHaveBeenCalledWith("https://airouter.mxyhi.com");
  });

  it("switches to inline API key form and saves airouter settings", async () => {
    const { onSaveSettings } = renderWizard();

    fireEvent.click(screen.getByRole("button", { name: "Configure API Key" }));

    fireEvent.change(screen.getByLabelText("Provider"), {
      target: { value: "local" },
    });
    fireEvent.change(screen.getByLabelText("Base URL"), {
      target: { value: "http://localhost:9000/v1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save configuration" }));

    await waitFor(() => {
      expect(onSaveSettings).toHaveBeenCalledWith({
        providerId: "local",
        baseUrl: "http://localhost:9000/v1",
        apiKey: null,
      });
    });
  });

  it("shows buy link next to API Key label only for airouter provider", () => {
    renderWizard();

    fireEvent.click(screen.getByRole("button", { name: "Configure API Key" }));

    fireEvent.click(screen.getByRole("link", { name: "No API key yet? Buy one" }));
    expect(openUrl).toHaveBeenCalledWith("https://airouter.mxyhi.com");

    fireEvent.change(screen.getByLabelText("Provider"), {
      target: { value: "local" },
    });

    expect(screen.queryByRole("link", { name: "No API key yet? Buy one" })).toBeNull();
  });

  it("localizes local provider optional API key copy in zh-CN", () => {
    render(
      <I18nProvider locale="zh-CN">
        <StartupAiSetupWizard
          providers={[...FIXED_PROVIDERS]}
          appLanguage="zh-CN"
          selectedProviderId="airouter"
          selectedProviderName="Airouter"
          configuredBaseUrl={null}
          apiKeyConfigured={false}
          loginRequired
          loginBusy={false}
          loginAvailable
          settingsBusy={false}
          settingsError={null}
          onSignIn={vi.fn()}
          onSaveSettings={vi.fn().mockResolvedValue(undefined)}
          onUpdateAppLanguage={vi.fn().mockResolvedValue(undefined)}
          onDismiss={vi.fn()}
        />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "配置 API Key" }));
    fireEvent.change(screen.getByLabelText("提供方"), {
      target: { value: "local" },
    });

    expect(screen.getByPlaceholderText("本地网关无需时可留空")).toBeTruthy();
    expect(
      screen.getByText("如果你的本地网关不要求 API Key，这里可以留空。"),
    ).toBeTruthy();
  });

  it("switches wizard language immediately from the language selector", async () => {
    function WizardWithLanguageState() {
      const [appLanguage, setAppLanguage] = useState<"en" | "zh-CN">("en");

      return (
        <I18nProvider locale={appLanguage}>
          <StartupAiSetupWizard
            providers={[...FIXED_PROVIDERS]}
            appLanguage={appLanguage}
            selectedProviderId="airouter"
            selectedProviderName="Airouter"
            configuredBaseUrl={null}
            apiKeyConfigured={false}
            loginRequired
            loginBusy={false}
            loginAvailable
            settingsBusy={false}
            settingsError={null}
            onSignIn={vi.fn()}
            onSaveSettings={vi.fn().mockResolvedValue(undefined)}
            onUpdateAppLanguage={async (nextLanguage) => {
              setAppLanguage(nextLanguage);
            }}
            onDismiss={vi.fn()}
          />
        </I18nProvider>
      );
    }

    render(<WizardWithLanguageState />);

    expect(screen.getByText("Finish AI setup before you start")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Language"), {
      target: { value: "zh-CN" },
    });

    await waitFor(() => {
      expect(screen.getByText("先完成 AI 配置再开始使用")).toBeTruthy();
    });
  });
});
