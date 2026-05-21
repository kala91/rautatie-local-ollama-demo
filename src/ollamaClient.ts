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
  return normalizeScene(parseJsonResponse(content), currentSceneNumber, config.players.map((p) => p.name));
}

export async function generateArchetypesWithOllama(
  baseUrl: string,
  model: string,
  theme: string,
  initialIdea: string,
  playerNames: string[]
) {
  const prompt = `Luo roolit ja salaisuudet railroaded hidden role -larppipeliin.

Teema: ${theme}
Premissi: ${initialIdea || "Ei erityistä alustusta"}
Pelaajat: ${playerNames.join(", ")}

Palauta vain JSON-array. Ei markdownia.
Muoto:
[
  {"name":"pelaajan alkuperäinen nimi","role":"lyhyt rooli","secret":"toiminnallinen salaisuus tai motiivi"}
]

Säännöt:
  - Jokaisella pelaajalla pitää olla oma rooli.
- Käytä täsmälleen annettuja pelaajanimiä.
- Salaisuuksien pitää ristiinkytkeytyä ja tuottaa sosiaalista toimintaa.
- Kirjoita suomeksi.`;

  const content = await chatJson(baseUrl, model, prompt);
  return normalizeArchetypes(parseJsonResponse(content), playerNames);
}

export async function generateEpilogueWithOllama(
  baseUrl: string,
  model: string,
  config: GameConfig,
  history: Scene[],
  humanGmNotes = ""
): Promise<{ epilogue: string; wasCorrectlySolved: string }> {
  const prompt = `Kirjoita loppuepilogi pelille.

Teema: ${config.theme}
Premissi: ${config.initialIdea}
Pelaajat:
${config.players.map((p) => `- ${p.name}: ${p.role}. Salaisuus: ${p.secret}. Kuollut: ${p.isDead ? "kylla" : "ei"}`).join("\n")}

Pelin historia:
${history.map((s) => `Kohtaus ${s.sceneNumber}: ${s.sceneTitle}\n${s.narrativeIntroduction}\nPJ-huomiot: ${s.humanGmNotesFeedback || "ei"}`).join("\n\n")}

Viimeiset PJ-huomiot: ${humanGmNotes || "ei uusia"}

Palauta vain JSON-objekti:
{"epilogue":"2-3 kappaleen loppuratkaisu suomeksi","wasCorrectlySolved":"yksi lause ryhmän suoriutumisesta"}`;

  const content = await chatJson(baseUrl, model, prompt);
  return normalizeEpilogue(parseJsonResponse(content));
}

async function chatJson(baseUrl: string, model: string, prompt: string): Promise<string> {
  const systemPrompt = "Olet suomenkielinen roolipelien ja larpin dramaturgi. Palauta aina vain validia JSONia ilman markdown-koodiaitoja.";
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
  return `Luo railroaded hidden role -larppipeliin kohtaus ${currentSceneNumber}/${totalScenes}.

Teema: ${config.theme}
Premissi: ${config.initialIdea}

Pelaajat:
${config.players.map((p) => `- ${p.name}: ${p.role}. Salaisuus: ${p.secret}. Kuollut: ${p.isDead ? "kylla" : "ei"}`).join("\n")}

Aiemmat kohtaukset:
${history.length ? history.map((s) => `Kohtaus ${s.sceneNumber}: ${s.sceneTitle}\nAlustus: ${s.narrativeIntroduction}\nTehtävät: ${s.playerTasks.map((t) => `${t.characterName}: ${t.instructionPrompt}`).join(" | ")}\nPJ-huomiot: ${s.humanGmNotesFeedback || "ei"}`).join("\n\n") : "Ei aiempia kohtauksia."}

PJ:n uudet huomiot: ${humanGmNotes || "ei uusia"}

Draaman kaaren sääntö:
- 1 = esittely ja kevyt jännite
- keskikohtaukset = konfliktin syveneminen
- toiseksi viimeinen = konkreettinen kliimaksi
- viimeinen = kuulustelu, ratkaisu tai totuuksien paljastus

Palauta vain validi JSON-objekti. Ei markdownia.
Muoto:
{
  "sceneNumber": ${currentSceneNumber},
  "sceneTitle": "lyhyt otsikko",
  "narrativeIntroduction": "1-3 lausetta PJ:n ääneen luettavaksi",
  "dramaticArcPhase": "Esittely|Konfliktin herääminen|Käännekohta/Kliimaksi|Kuulustelu|Ratkaisu",
  "playerTasks": [
    {
      "characterName": "täsmälleen pelaajan nimi",
      "socialActionCategory": "Kysyvä|Toteava|Selvittävä|Tavoitteleva",
      "concreteActionCategory": "Monologi|Matkiminen|Dialogi|Fyysinen ele|Siirtyminen|Esineen kanssa toimiminen",
      "targetCharacter": "toinen pelaaja tai Kaikki",
      "instructionPrompt": "selkeä suoritettava ohje pelaajalle juuri nyt",
      "gamePurpose": "miksi tämä luo draamaa"
    }
  ]
}

Anna tehtävä jokaiselle elossa olevalle pelaajalle. Jos pelaaja on kuollut, anna vain kuolleeseen statukseen sopiva tehtävä.`;
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

function normalizeScene(scene: any, sceneNumber: number, playerNames: string[]): Scene {
  const tasks = Array.isArray(scene.playerTasks) ? scene.playerTasks : [];
  return {
    sceneNumber: Number(scene.sceneNumber || sceneNumber),
    sceneTitle: String(scene.sceneTitle || `Kohtaus ${sceneNumber}`),
    narrativeIntroduction: String(scene.narrativeIntroduction || ""),
    dramaticArcPhase: String(scene.dramaticArcPhase || "Kohtaus"),
    playerTasks: playerNames.map((name) => {
      const task = tasks.find((t: any) => String(t.characterName || "").toLowerCase() === name.toLowerCase()) || {};
      return {
        characterName: name,
        socialActionCategory: String(task.socialActionCategory || "Toteava"),
        concreteActionCategory: String(task.concreteActionCategory || "Dialogi"),
        targetCharacter: String(task.targetCharacter || "Kaikki"),
        instructionPrompt: String(task.instructionPrompt || "Osallistu kohtaukseen roolisi näkökulmasta ja reagoi muiden toimintaan."),
        gamePurpose: String(task.gamePurpose || "Pitää kohtaus liikkeessä.")
      };
    })
  };
}
