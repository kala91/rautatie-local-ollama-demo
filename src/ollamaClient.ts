import { GameConfig, Scene } from "./types";

export interface OllamaModel {
  name: string;
  modified_at?: string;
  size?: number;
}

interface GeneratedArchetype {
  name: string;
  role: string;
  secret: string;
}

export async function listOllamaModels(baseUrl: string): Promise<OllamaModel[]> {
  const res = await fetch(`${cleanBaseUrl(baseUrl)}/api/tags`);
  if (!res.ok) {
    throw new Error(`Ollama mallilistaus epäonnistui (${res.status}).`);
  }
  const data = await res.json();
  const models = Array.isArray(data.models) ? data.models : [];
  return models
    .filter((model: Partial<OllamaModel>) => typeof model.name === "string" && model.name.length > 0)
    .sort((a: OllamaModel, b: OllamaModel) => a.name.localeCompare(b.name));
}

export async function generateSceneWithOllama(
  baseUrl: string,
  model: string,
  config: GameConfig,
  history: Scene[],
  currentSceneNumber: number,
  humanGmNotes = ""
): Promise<Scene> {
  const prompt = buildScenePrompt(config, history, currentSceneNumber, humanGmNotes);
  const content = await chatJson(baseUrl, model, prompt);
  return normalizeScene(parseJsonResponse(content), currentSceneNumber, config.players.map((p) => p.name), inferScenarioLanguage(`${config.theme}\n${config.initialIdea}`));
}

export async function generateArchetypesWithOllama(
  baseUrl: string,
  model: string,
  theme: string,
  initialIdea: string,
  playerNames: string[]
) {
  const outputLanguageRule = buildOutputLanguageRule(theme, initialIdea);
  const prompt = `Create roles and secrets for a railroaded hidden-role live roleplaying game.

Theme: ${theme}
Scenario premise: ${initialIdea || "No additional premise"}
Players: ${playerNames.join(", ")}

Return only a JSON array. Do not use markdown.
Shape:
[
  {"name":"original player name","role":"short playable role","secret":"actionable secret or motive"}
]

Rules:
- Every player must have one role.
- Use the exact player names provided.
- Secrets must interlock and create immediate social action.
- ${outputLanguageRule}`;

  const content = await chatJson(baseUrl, model, prompt);
  try {
    return normalizeArchetypes(parseJsonResponse(content), playerNames);
  } catch (error) {
    console.warn("Ollama role JSON parsing failed, using playable fallback roles.", error);
    return buildFallbackArchetypes(playerNames, inferScenarioLanguage(`${theme}\n${initialIdea}`));
  }
}

export async function generateEpilogueWithOllama(
  baseUrl: string,
  model: string,
  config: GameConfig,
  history: Scene[],
  humanGmNotes = ""
): Promise<{ epilogue: string; wasCorrectlySolved: string }> {
  const outputLanguageRule = buildOutputLanguageRule(config.theme, config.initialIdea);
  const prompt = `Write the final epilogue for this game.

Theme: ${config.theme}
Scenario premise: ${config.initialIdea}
Players:
${config.players.map((p) => `- ${p.name}: ${p.role}. Secret: ${p.secret}. Dead: ${p.isDead ? "yes" : "no"}`).join("\n")}

Game history:
${history.map((s) => `Scene ${s.sceneNumber}: ${s.sceneTitle}\n${s.narrativeIntroduction}\nHuman GM notes: ${s.humanGmNotesFeedback || "none"}`).join("\n\n")}

Final human GM notes: ${humanGmNotes || "none"}

Return only this JSON object:
{"epilogue":"2-3 paragraph final resolution","wasCorrectlySolved":"one sentence about the group's performance"}

Language rule: ${outputLanguageRule}`;

  const content = await chatJson(baseUrl, model, prompt);
  return normalizeEpilogue(parseJsonResponse(content));
}

async function chatJson(baseUrl: string, model: string, prompt: string): Promise<string> {
  const systemPrompt = "You are a dramaturg and live roleplaying game designer. Follow the user's requested output language. Always return only valid JSON without markdown code fences.";
  const chatRes = await fetch(`${cleanBaseUrl(baseUrl)}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        { role: "user", content: prompt }
      ]
    })
  });

  if (chatRes.ok) {
    const data = await chatRes.json();
    return data.message?.content || data.response || "";
  }

  if (chatRes.status !== 404 && chatRes.status !== 405) {
    throw new Error(`Ollama generointi epäonnistui /api/chat (${chatRes.status}): ${await readOllamaError(chatRes)}`);
  }

  const generateRes = await fetch(`${cleanBaseUrl(baseUrl)}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      prompt: `${systemPrompt}\n\n${prompt}`
    })
  });

  if (!generateRes.ok) {
    const chatError = await readOllamaError(chatRes);
    const generateError = await readOllamaError(generateRes);
    throw new Error(`Ollama generointi epäonnistui. /api/chat: ${chatRes.status} ${chatError}. /api/generate: ${generateRes.status} ${generateError}`);
  }

  const data = await generateRes.json();
  return data.message?.content || data.response || "";
}

async function readOllamaError(res: Response) {
  try {
    const text = await res.text();
    if (!text) return "ei virhetekstiä";
    try {
      const data = JSON.parse(text);
      return String(data.error || text);
    } catch {
      return text.slice(0, 300);
    }
  } catch {
    return "virhetekstin luku epäonnistui";
  }
}

function buildScenePrompt(config: GameConfig, history: Scene[], currentSceneNumber: number, humanGmNotes: string) {
  const totalScenes = config.totalScenes || 5;
  const outputLanguageRule = buildOutputLanguageRule(config.theme, config.initialIdea);
  return `Create scene ${currentSceneNumber}/${totalScenes} for a railroaded hidden-role live roleplaying game.

Theme: ${config.theme}
Scenario premise: ${config.initialIdea}

Players:
${config.players.map((p) => `- ${p.name}: ${p.role}. Secret: ${p.secret}. Dead: ${p.isDead ? "yes" : "no"}`).join("\n")}

Previous scenes:
${history.length ? history.map((s) => `Scene ${s.sceneNumber}: ${s.sceneTitle}\nIntro: ${s.narrativeIntroduction}\nTasks: ${s.playerTasks.map((t) => `${t.characterName}: ${t.instructionPrompt}`).join(" | ")}\nHuman GM notes: ${s.humanGmNotesFeedback || "none"}`).join("\n\n") : "No previous scenes."}

New human GM notes: ${humanGmNotes || "none"}

Story arc rule:
- 1 = introduction and light tension
- middle scenes = escalating conflict
- penultimate scene = concrete climax
- final scene = interrogation, resolution, or revelation of truths

Return only a valid JSON object. Do not use markdown.
Shape:
{
  "sceneNumber": ${currentSceneNumber},
  "sceneTitle": "short title",
  "narrativeIntroduction": "1-3 sentences for the GM to read aloud",
  "dramaticArcPhase": "Introduction|Rising conflict|Turning point/Climax|Interrogation|Resolution",
  "playerTasks": [
    {
      "characterName": "exact player name",
      "socialActionCategory": "Questioning|Stating|Investigating|Pursuing",
      "concreteActionCategory": "Monologue|Mimicry|Dialogue|Physical gesture|Movement|Object interaction",
      "targetCharacter": "another player or Everyone",
      "instructionPrompt": "clear action instruction the player can perform right now",
      "gamePurpose": "why this creates drama"
    }
  ]
}

Give a task to every living player. If a player is dead, give only a task that fits their dead status.
Language rule: ${outputLanguageRule}`;
}

function buildOutputLanguageRule(theme: string, initialIdea: string) {
  const sourceLanguage = inferScenarioLanguage(`${theme}\n${initialIdea}`);
  if (sourceLanguage === "fi") {
    return "Write all player-facing story text, roles, secrets, epilogues, and task instructions in Finnish because the scenario setup is Finnish.";
  }
  return "Write all player-facing story text, roles, secrets, epilogues, and task instructions in English because the scenario setup is English or unclear.";
}

function inferScenarioLanguage(text: string): "fi" | "en" {
  const normalized = text.toLowerCase();
  const finnishSignals = ["ä", "ö", "å", " ja ", " joka ", " koska ", " mutta ", " peli", " pelaa", " hahmo", " salais", " juna", " mysteeri"];
  const englishSignals = [" the ", " and ", " because ", " but ", " game", " player", " character", " secret", " train", " mystery"];
  const finnishScore = finnishSignals.filter((signal) => normalized.includes(signal)).length;
  const englishScore = englishSignals.filter((signal) => normalized.includes(signal)).length;
  return finnishScore > englishScore ? "fi" : "en";
}

function cleanBaseUrl(baseUrl: string) {
  return (baseUrl || "http://localhost:11434").replace(/\/$/, "");
}

function parseJsonResponse(text: string): unknown {
  const candidates = extractJsonCandidates(text);
  const errors: string[] = [];

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(`Mallin vastaus sisälsi JSONin näköistä tekstiä, mutta sitä ei saatu parsittua. ${errors[0] || ""}`.trim());
}

function extractJsonCandidates(text: string): string[] {
  const trimmed = text.trim();
  const candidates: string[] = [];

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1].trim());

  for (const start of findJsonStarts(trimmed)) {
    const balanced = readBalancedJson(trimmed, start);
    if (balanced) candidates.push(balanced);
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) candidates.push(trimmed);

  const unique = [...new Set(candidates.map((candidate) => candidate.trim()).filter(Boolean))];
  if (unique.length === 0) throw new Error("Mallin vastaus ei sisältänyt JSONia.");
  return unique;
}

function findJsonStarts(text: string): number[] {
  const starts: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "{" || text[index] === "[") starts.push(index);
  }
  return starts;
}

function readBalancedJson(text: string, start: number): string | null {
  const opener = text[start];
  const closer = opener === "{" ? "}" : "]";
  const stack: string[] = [];
  let inString = false;
  let escaping = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (escaping) {
      escaping = false;
      continue;
    }

    if (char === "\\") {
      escaping = inString;
      continue;
    }

    if (char === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === "{" || char === "[") {
      stack.push(char === "{" ? "}" : "]");
      continue;
    }

    if (char === "}" || char === "]") {
      if (stack.pop() !== char) return null;
      if (stack.length === 0) {
        if (char !== closer) return null;
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
}

function normalizeArchetypes(data: unknown, playerNames: string[]): GeneratedArchetype[] {
  const list = findArchetypeArray(data);

  if (!list) {
    throw new Error("Ollama ei palauttanut roolilistaa tunnistettavassa muodossa.");
  }

  const byName = new Map<string, Record<string, unknown>>();
  list.forEach((item, index) => {
    if (!isRecord(item)) return;
    const rawName = getFirstString(item, ["name", "playerName", "characterName", "pelaaja", "nimi"]);
    const fallbackName = playerNames[index] || `Pelaaja ${index + 1}`;
    byName.set(normalizeName(rawName || fallbackName), item);
  });

  return playerNames.map((playerName, index) => {
    const source = byName.get(normalizeName(playerName)) || (isRecord(list[index]) ? list[index] as Record<string, unknown> : {});
    return {
      name: playerName,
      role: getFirstString(source, ["role", "characterRole", "archetype", "rooli", "ammatti"]) || "Osallistuja",
      secret: getFirstString(source, ["secret", "motive", "salaisuus", "motiivi", "tausta"]) || "Kantaa salattua menneisyyttä"
    };
  });
}

function normalizeEpilogue(data: unknown): { epilogue: string; wasCorrectlySolved: string } {
  if (!isRecord(data)) {
    throw new Error("Ollama ei palauttanut epilogia JSON-objektina.");
  }

  return {
    epilogue: getFirstString(data, ["epilogue", "text", "loppuepilogi", "loppuratkaisu"]) || "Tarina päättyi, mutta malli ei palauttanut epilogitekstiä.",
    wasCorrectlySolved: getFirstString(data, ["wasCorrectlySolved", "judgment", "arvio", "ratkaisu"]) || "Ryhmän suoriutumista ei arvioitu."
  };
}

function findArchetypeArray(data: unknown): unknown[] | null {
  if (Array.isArray(data)) return data;
  if (!isRecord(data)) return null;

  const preferredKeys = ["roles", "characters", "players", "archetypes", "hahmot", "roolit", "pelaajat"];
  for (const key of preferredKeys) {
    if (Array.isArray(data[key])) return data[key];
  }

  const nestedArray = Object.values(data).find((value) => Array.isArray(value));
  return Array.isArray(nestedArray) ? nestedArray : null;
}

function buildFallbackArchetypes(playerNames: string[], language: "fi" | "en"): GeneratedArchetype[] {
  return playerNames.map((name, index) => ({
    name,
    role: language === "fi" ? `Matkustaja ${index + 1}` : `Passenger ${index + 1}`,
    secret: language === "fi"
      ? "Tietää matkasta jotakin, mitä ei halua heti kertoa muille."
      : "Knows something about the journey that they do not want to reveal immediately."
  }));
}

function getFirstString(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeScene(scene: any, sceneNumber: number, playerNames: string[], language: "fi" | "en"): Scene {
  const tasks = Array.isArray(scene.playerTasks) ? scene.playerTasks : [];
  return {
    sceneNumber: Number(scene.sceneNumber || sceneNumber),
    sceneTitle: String(scene.sceneTitle || (language === "fi" ? `Kohtaus ${sceneNumber}` : `Scene ${sceneNumber}`)),
    narrativeIntroduction: String(scene.narrativeIntroduction || ""),
    dramaticArcPhase: String(scene.dramaticArcPhase || (language === "fi" ? "Kohtaus" : "Scene")),
    playerTasks: playerNames.map((name) => {
      const task = tasks.find((t: any) => String(t.characterName || "").toLowerCase() === name.toLowerCase()) || {};
      return {
        characterName: name,
        socialActionCategory: String(task.socialActionCategory || (language === "fi" ? "Toteava" : "Stating")),
        concreteActionCategory: String(task.concreteActionCategory || (language === "fi" ? "Dialogi" : "Dialogue")),
        targetCharacter: String(task.targetCharacter || (language === "fi" ? "Kaikki" : "Everyone")),
        instructionPrompt: String(task.instructionPrompt || (language === "fi"
          ? "Osallistu kohtaukseen roolisi näkökulmasta ja reagoi muiden toimintaan."
          : "Participate in the scene from your role's point of view and respond to the others.")),
        gamePurpose: String(task.gamePurpose || (language === "fi" ? "Pitää kohtaus liikkeessä." : "Keeps the scene moving."))
      };
    })
  };
}
