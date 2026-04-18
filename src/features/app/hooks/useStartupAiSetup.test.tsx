// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AccountSnapshot, GlobalAiSettings } from "@/types";
import { getGlobalAiSettings } from "@services/tauri";
import {
  resolveStartupAiSetupState,
  useStartupAiSetup,
} from "./useStartupAiSetup";

vi.mock("@services/tauri", () => ({
  getGlobalAiSettings: vi.fn(),
}));

const getGlobalAiSettingsMock = vi.mocked(getGlobalAiSettings);

function makeAccount(
  overrides: Partial<AccountSnapshot> = {},
): AccountSnapshot {
  return {
    type: "unknown",
    email: null,
    planType: null,
    requiresOpenaiAuth: true,
    ...overrides,
  };
}

function makeAiSettings(
  overrides: Partial<GlobalAiSettings> = {},
): GlobalAiSettings {
  return {
    configPath: "/tmp/config.toml",
    sessionDefaults: {
      modelProvider: "openai",
      model: null,
      modelReasoningEffort: null,
      ...overrides.sessionDefaults,
    },
    openaiBaseUrl: null,
    providers: [
      {
        id: "openai",
        name: "OpenAI",
        baseUrl: null,
        apiKey: null,
        builtIn: true,
      },
      {
        id: "ollama",
        name: "gpt-oss",
        baseUrl: "http://localhost:11434/v1",
        apiKey: null,
        builtIn: true,
      },
      {
        id: "lmstudio",
        name: "gpt-oss",
        baseUrl: "http://localhost:1234/v1",
        apiKey: null,
        builtIn: true,
      },
    ],
    ...overrides,
  };
}

describe("resolveStartupAiSetupState", () => {
  it("shows wizard when default OpenAI route still requires login", () => {
    expect(
      resolveStartupAiSetupState({
        activeAccount: makeAccount(),
        aiSettings: makeAiSettings(),
        dismissedForSession: false,
        settingsOpen: false,
      }).showWizard,
    ).toBe(true);
  });

  it("hides wizard when default provider is a built-in local provider", () => {
    expect(
      resolveStartupAiSetupState({
        activeAccount: makeAccount(),
        aiSettings: makeAiSettings({
          sessionDefaults: {
            modelProvider: "ollama",
            model: null,
            modelReasoningEffort: null,
          },
        }),
        dismissedForSession: false,
        settingsOpen: false,
      }).showWizard,
    ).toBe(false);
  });

  it("shows wizard when selected custom provider is missing connection fields", () => {
    expect(
      resolveStartupAiSetupState({
        activeAccount: makeAccount({
          requiresOpenaiAuth: false,
        }),
        aiSettings: makeAiSettings({
          sessionDefaults: {
            modelProvider: "gateway",
            model: null,
            modelReasoningEffort: null,
          },
          providers: [
            ...makeAiSettings().providers,
            {
              id: "gateway",
              name: "Gateway",
              baseUrl: null,
              apiKey: null,
              builtIn: false,
            },
          ],
        }),
        dismissedForSession: false,
        settingsOpen: false,
      }).showWizard,
    ).toBe(true);
  });
});

describe("useStartupAiSetup", () => {
  it("keeps dismissal within current session", async () => {
    getGlobalAiSettingsMock.mockResolvedValue(makeAiSettings());

    const { result, rerender } = renderHook(
      ({ settingsOpen }) =>
        useStartupAiSetup({
          activeAccount: makeAccount(),
          settingsOpen,
        }),
      {
        initialProps: {
          settingsOpen: false,
        },
      },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.showWizard).toBe(true);

    act(() => {
      result.current.dismissWizard();
    });
    expect(result.current.showWizard).toBe(false);

    rerender({ settingsOpen: true });
    expect(result.current.showWizard).toBe(false);

    rerender({ settingsOpen: false });
    expect(result.current.showWizard).toBe(false);
  });

  it("refetches AI settings after settings close and hides when default provider becomes usable", async () => {
    getGlobalAiSettingsMock
      .mockResolvedValueOnce(makeAiSettings())
      .mockResolvedValueOnce(
        makeAiSettings({
          sessionDefaults: {
            modelProvider: "ollama",
            model: null,
            modelReasoningEffort: null,
          },
        }),
      );

    const { result, rerender } = renderHook(
      ({ settingsOpen }) =>
        useStartupAiSetup({
          activeAccount: makeAccount(),
          settingsOpen,
        }),
      {
        initialProps: {
          settingsOpen: false,
        },
      },
    );

    await waitFor(() => {
      expect(result.current.showWizard).toBe(true);
    });

    rerender({ settingsOpen: true });
    expect(result.current.showWizard).toBe(false);

    rerender({ settingsOpen: false });

    await waitFor(() => {
      expect(result.current.showWizard).toBe(false);
    });
    expect(getGlobalAiSettingsMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
