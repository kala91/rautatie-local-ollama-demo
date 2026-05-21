/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Player {
  id: string;
  name: string;
  role: string;         // e.g. "Hovimestari", "Laivainsinööri"
  secret: string;       // e.g. "Varasti timantin tunteja aiemmin", "Kantaa alien-alkiota"
  isDead?: boolean;     // Can be killed by other players in the dramatic arc
  deathScene?: number;  // The scene where they were reported dead/captured
}

export interface PlayerTask {
  characterName: string;
  socialActionCategory: string;   // e.g., "Kysyvä", "Toteava", "Selvittävä", "Tavoitteleva"
  concreteActionCategory: string; // e.g., "Monologi", "Matkiminen", "Dialogi", "Fyysinen ele", "Siirtyminen", "Esineen kanssa toimiminen"
  targetCharacter: string;        // Name of player target, or "Kaikki"
  instructionPrompt: string;      // What they must perform right now
  gamePurpose: string;            // Why they are doing this (for context)
}

export interface Scene {
  sceneNumber: number;
  sceneTitle: string;
  narrativeIntroduction: string;  // Simple narrative intro by Gemini
  dramaticArcPhase: string;       // e.g., "Esittely", "Konfliktin herääminen", "Käännekohta/Kliimaksi", "Kuulustelu", "Ratkaisu"
  playerTasks: PlayerTask[];
  humanGmNotesFeedback?: string;  // Notes provided by human GM after this scene
}

export interface GameConfig {
  theme: string;                // Premise: e.g. "Kartanon Murhamysteeri"
  initialIdea: string;          // Human GM's prompt / pitch for the game
  totalScenes: number;          // Typically 3 to 7 scenes (default 5)
  players: Player[];
  generationMode?: "ollama" | "offline";
  ollamaBaseUrl?: string;
  ollamaModel?: string;
  offlineScenes?: Scene[];
  savedScenarioId?: string;
}

export interface GameState {
  config: GameConfig;
  currentScene: Scene | null;
  history: Scene[];
  isStarted: boolean;
  isFinished: boolean;
  winnerOutcome?: string;       // Narrative explanation of how the story concluded
}

export interface SavedScenario {
  id: string;
  title: string;
  savedAt: string;
  config: GameConfig;
  scenes: Scene[];
  epilogueText?: string;
  judgmentText?: string;
}
