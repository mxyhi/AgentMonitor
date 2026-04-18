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
  const providers =
    overrides.providers ??
    [
      {
        id: "airouter",
        name: "Airouter",
        baseUrl: "https://airouter.mxyhi.com/v1",
        apiKey: null,
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
    ];
  return {
    configPath: "/tmp/config.toml",
    sessionDefaults: {
      modelProvider: "airouter",
      model: null,
      modelReasoningEffort: null,
      ...overrides.sessionDefaults,
    },
    providers,
    ...overrides,
  };
}

describe("resolveStartupAiSetupState", () => {
  it("shows wizard when airouter API key is missing", () => {
    expect(
      resolveStartupAiSetupState({
        activeAccount: makeAccount(),
        aiSettings: makeAiSettings(),
        dismissedForSession: false,
        settingsOpen: false,
      }).showWizard,
    ).toBe(true);
  });

  it("hides wizard when airouter is fully configured even without OpenAI login", () => {
    expect(
      resolveStartupAiSetupState({
        activeAccount: makeAccount(),
        aiSettings: makeAiSettings({
          providers: [
            {
              id: "airouter",
              name: "Airouter",
              baseUrl: "https://airouter.mxyhi.com/v1",
              apiKey: "sk-airouter",
              builtIn: true,
            },
          ],
        }),
        dismissedForSession: false,
        settingsOpen: false,
      }).showWizard,
    ).toBe(false);
  });

  it("shows wizard when airouter base URL falls outside allowlist", () => {
    expect(
      resolveStartupAiSetupState({
        activeAccount: makeAccount({
          requiresOpenaiAuth: false,
        }),
        aiSettings: makeAiSettings({
          providers: [
            {
              id: "airouter",
              name: "Airouter",
              baseUrl: "https://evil.example.com/v1",
              apiKey: "sk-airouter",
              builtIn: true,
            },
          ],
        }),
        dismissedForSession: false,
        settingsOpen: false,
      }).showWizard,
    ).toBe(true);
  });

  it("hides wizard when selected openai provider already has an API key", () => {
    expect(
      resolveStartupAiSetupState({
        activeAccount: makeAccount(),
        aiSettings: makeAiSettings({
          sessionDefaults: {
            modelProvider: "openai",
            model: null,
            modelReasoningEffort: null,
          },
          providers: [
            {
              id: "airouter",
              name: "Airouter",
              baseUrl: "https://airouter.mxyhi.com/v1",
              apiKey: null,
              builtIn: true,
            },
            {
              id: "openai",
              name: "OpenAI",
              baseUrl: "https://api.openai.com/v1",
              apiKey: "sk-openai",
              builtIn: true,
            },
            {
              id: "local",
              name: "Local",
              baseUrl: "http://127.0.0.1:9208/v1",
              apiKey: null,
              builtIn: true,
            },
          ],
        }),
        dismissedForSession: false,
        settingsOpen: false,
      }).showWizard,
    ).toBe(false);
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

  it("can reopen the wizard on demand after session dismissal", async () => {
    getGlobalAiSettingsMock.mockResolvedValue(makeAiSettings());

    const { result } = renderHook(() =>
      useStartupAiSetup({
        activeAccount: makeAccount(),
        settingsOpen: false,
      }),
    );

    await waitFor(() => {
      expect(result.current.showWizard).toBe(true);
    });

    act(() => {
      result.current.dismissWizard();
    });
    expect(result.current.showWizard).toBe(false);

    act(() => {
      result.current.requestWizard();
    });
    expect(result.current.showWizard).toBe(true);
  });

  it("refetches AI settings after settings close and hides when default provider becomes usable", async () => {
    getGlobalAiSettingsMock
      .mockResolvedValueOnce(makeAiSettings())
      .mockResolvedValueOnce(
        makeAiSettings({
          providers: [
            {
              id: "airouter",
              name: "Airouter",
              baseUrl: "https://airouter.mxyhi.com/v1",
              apiKey: "sk-airouter",
              builtIn: true,
            },
          ],
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
