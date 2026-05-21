import { GameConfig, SavedScenario, Scene } from "./types";

const SAVED_SCENARIOS_KEY = "rautatie_saved_scenarios";

export function listSavedScenarios(): SavedScenario[] {
  try {
    const raw = localStorage.getItem(SAVED_SCENARIOS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveScenario(
  title: string,
  config: GameConfig,
  scenes: Scene[],
  epilogueText = "",
  judgmentText = ""
): SavedScenario {
  const scenario: SavedScenario = {
    id: `scenario-${Date.now()}`,
    title: title.trim() || `${config.theme} ${new Date().toLocaleString("fi-FI")}`,
    savedAt: new Date().toISOString(),
    config: {
      ...config,
      generationMode: "offline",
      offlineScenes: scenes,
      savedScenarioId: undefined
    },
    scenes,
    epilogueText,
    judgmentText
  };
  const existing = listSavedScenarios();
  localStorage.setItem(SAVED_SCENARIOS_KEY, JSON.stringify([scenario, ...existing].slice(0, 20)));
  return scenario;
}

export function deleteSavedScenario(id: string) {
  const next = listSavedScenarios().filter((scenario) => scenario.id !== id);
  localStorage.setItem(SAVED_SCENARIOS_KEY, JSON.stringify(next));
}
