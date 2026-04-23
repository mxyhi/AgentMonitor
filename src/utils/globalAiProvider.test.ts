import { describe, expect, it } from "vitest";
import {
  normalizeGlobalAiProviderId,
  resolveSelectedGlobalAiProvider,
  selectedGlobalAiProviderRequiresOpenAiAuth,
} from "./globalAiProvider";

describe("globalAiProvider", () => {
  it("normalizes legacy openai id to OpenAI", () => {
    expect(normalizeGlobalAiProviderId("openai")).toBe("OpenAI");
    expect(normalizeGlobalAiProviderId("OpenAI")).toBe("OpenAI");
  });

  it("resolves legacy openai settings into OpenAI provider", () => {
    const result = resolveSelectedGlobalAiProvider({
      configPath: "/tmp/config.toml",
      sessionDefaults: {
        modelProvider: "openai",
        model: "gpt-5.5",
        modelReasoningEffort: "high",
      },
      providers: [
        {
          id: "openai",
          name: "OpenAI",
          baseUrl: "https://api.openai.com/v1",
          apiKey: null,
          builtIn: true,
        },
      ],
    });

    expect(result.providerId).toBe("OpenAI");
    expect(result.provider.id).toBe("OpenAI");
    expect(result.provider.name).toBe("OpenAI");
  });

  it("keeps login preflight on for OpenAI without api key", () => {
    expect(
      selectedGlobalAiProviderRequiresOpenAiAuth({
        configPath: "/tmp/config.toml",
        sessionDefaults: {
          modelProvider: "OpenAI",
          model: "gpt-5.5",
          modelReasoningEffort: "high",
        },
        providers: [
          {
            id: "OpenAI",
            name: "OpenAI",
            baseUrl: "https://api.openai.com/v1",
            apiKey: null,
            builtIn: true,
          },
        ],
      }),
    ).toBe(true);
  });
});
