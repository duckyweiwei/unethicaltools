import type { LlmClient } from "./types";

/**
 * Default LLM client: OFF. The app is fully functional with the LLM disabled;
 * the deterministic parser handles regularly-formatted tests on its own.
 * Swap this for a real provider-backed client to enable the fallback.
 */
export const disabledLlmClient: LlmClient = {
  enabled: false,
  async refine() {
    throw new Error("LLM fallback is disabled");
  },
};
