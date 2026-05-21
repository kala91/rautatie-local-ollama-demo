import React, { useState } from "react";
import { GameConfig, Player } from "../types";
import { Sparkles, Trash2, Plus, ArrowRight, Shield, Compass, Swords, Radio, RefreshCw, Server } from "lucide-react";
import { generateArchetypesWithOllama, listOllamaModels, OllamaModel } from "../ollamaClient";
import { deleteSavedScenario, listSavedScenarios } from "../scenarioStorage";

interface GameSetupProps {
  onStartGame: (config: GameConfig) => void;
}

const THEME_PRESETS = [
  {
    id: "manor",
    title: "Kartanon Murhamysteeri",
    description: "Sateinen ilta viktoriaanisessa kartanossa. Isäntä löydetään kuolleena kirjastosta, ja kaikilla on jotain salattavaa.",
    initialIdea: "Isäntä lordi Harrington on murhattu tunti sitten. Myrkkyvaihtoehto tai tikari. Kaikki vieraat ja palvelijat ovat lukittuna salonkiin odottamassa poliisia.",
    icon: Compass,
    accent: "border-red-500/30 text-red-400 bg-red-950/25",
  },
  {
    id: "scifi",
    title: "Avaruusaluksen Sabotaasi",
    description: "Syvän avaruuden kaivosalus Andromeda. Reaktori ylikuumenee, tekoäly sekoilee ja miehistössä lymyää sabotööri.",
    initialIdea: "Tuntematon virus tai sabotaasi on rikkonut toisen happigeneraattorijohtimista. Matkalla kohti Siriusta miehistön keskinäinen luottamus rakoilee.",
    icon: Radio,
    accent: "border-cyan-500/30 text-cyan-400 bg-cyan-950/25",
  },
  {
    id: "fantasy",
    title: "Valtaistuinpeli Hovisalissa",
    description: "Kuninkaan viimeiset hetket vetävät ahneet säädyt ja ritarit taistelemaan vallasta. Kuka perii hovin?",
    initialIdea: "Vanha kuningas on halvaantunut ja makaa vuoteellaan. Varjohovi kokoontuu neuvonpitoon valitsemaan sijaishallisjaa. Koruja ja lupauksia vaihdetaan salaa kuiskaten.",
    icon: Swords,
    accent: "border-amber-500/30 text-amber-400 bg-amber-950/25",
  },
  {
    id: "spy",
    title: "Kylmän Sodan Vakoojat",
    description: "Jaetun Berliinin alle piilotettu bunkkeri vuonna 1983. CIA:n ja KGB:n agentit loukussa paljastuneessa tukikohdassa.",
    initialIdea: "Koodilaitteen koodikirja on kadonnut ja radioyhteys on poikki. Jokaisen täytyy todistaa uskollisuutensa tai eliminoida mooli ennen kuin bunkkerilukitus aukeaa.",
    icon: Shield,
    accent: "border-emerald-500/30 text-emerald-400 bg-emerald-950/25",
  }
];

export function GameSetup({ onStartGame }: GameSetupProps) {
  const [selectedPresetId, setSelectedPresetId] = useState<string>("manor");
  const [customTheme, setCustomTheme] = useState<string>("");
  const [initialIdea, setInitialIdea] = useState<string>(THEME_PRESETS[0].initialIdea);
  const [playerNames, setPlayerNames] = useState<string[]>([
    "Sofia", "Matias", "Antti", "Beata", "Cyril"
  ]);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [totalScenes, setTotalScenes] = useState<number>(5);
  
  // Generated player roles & secrets
  const [players, setPlayers] = useState<Player[]>([]);
  const [isGeneratingRoles, setIsGeneratingRoles] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState(() => localStorage.getItem("rautatie_ollama_base_url") || "http://localhost:11434");
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem("rautatie_ollama_model") || "");
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [savedScenarios, setSavedScenarios] = useState(() => listSavedScenarios());

  const activeThemeTitle = selectedPresetId === "custom" 
    ? customTheme || "Oma Custom-Teema" 
    : THEME_PRESETS.find(p => p.id === selectedPresetId)?.title || "Teema";

  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    setError(null);
    if (presetId === "custom") {
      setInitialIdea("");
    } else {
      const preset = THEME_PRESETS.find(p => p.id === presetId);
      if (preset) {
        setInitialIdea(preset.initialIdea);
      }
    }
  };

  const handleAddPlayerName = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newPlayerName.trim();
    if (!name) return;
    if (playerNames.includes(name)) {
      setError("Pelaajan nimi on jo lisätty.");
      return;
    }
    if (playerNames.length >= 10) {
      setError("Maksiväestö on 10 pelaajaa jotta prompit mahtuvat näytölle.");
      return;
    }
    setPlayerNames([...playerNames, name]);
    setNewPlayerName("");
    setError(null);
  };

  const handleRemovePlayerName = (indexToRemove: number) => {
    if (playerNames.length <= 3) {
      setError("Peli vaatii vähintään 3 pelaajaa draaman ylläpitämiseen.");
      return;
    }
    setPlayerNames(playerNames.filter((_, idx) => idx !== indexToRemove));
    setError(null);
  };

  const handleGenerateRoles = async () => {
    setIsGeneratingRoles(true);
    setError(null);
    setPlayers([]);
    
    const themeName = selectedPresetId === "custom" ? customTheme : THEME_PRESETS.find(p => p.id === selectedPresetId)?.title;
    
    if (!themeName || themeName.trim() === "") {
      setError("Kirjoita peliin teema tai valitse valmis pohja.");
      setIsGeneratingRoles(false);
      return;
    }

    try {
      if (!selectedModel) {
        throw new Error("Valitse ensin Ollama-malli.");
      }
      const archetypes = await generateArchetypesWithOllama(ollamaBaseUrl, selectedModel, themeName, initialIdea, playerNames);
      
      // Map server response to Player array
      const mappedPlayers: Player[] = archetypes.map((node: any, idx: number) => ({
        id: `p-${idx}-${Date.now()}`,
        name: node.name,
        role: node.role || "Osallistuja",
        secret: node.secret || "Kantaa salattua menneisyyttä"
      }));

      setPlayers(mappedPlayers);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Ollamaan ei saatu yhteyttä. Tarkista osoite, CORS ja valittu malli.");
    } finally {
      setIsGeneratingRoles(false);
    }
  };

  const handleLoadModels = async () => {
    setIsLoadingModels(true);
    setError(null);
    try {
      localStorage.setItem("rautatie_ollama_base_url", ollamaBaseUrl);
      const models = await listOllamaModels(ollamaBaseUrl);
      setOllamaModels(models);
      if (!selectedModel && models[0]?.name) {
        setSelectedModel(models[0].name);
        localStorage.setItem("rautatie_ollama_model", models[0].name);
      }
    } catch (err: any) {
      setError(err.message || "Ollama-mallien listaus epäonnistui. Jos selain blokkaa pyynnön, käynnistä Ollama CORS-säännöllä.");
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleModelSelect = (model: string) => {
    setSelectedModel(model);
    localStorage.setItem("rautatie_ollama_model", model);
  };

  const handleStartSavedScenario = (scenarioId: string) => {
    const scenario = savedScenarios.find((item) => item.id === scenarioId);
    if (!scenario || scenario.scenes.length === 0) return;
    onStartGame({
      ...scenario.config,
      generationMode: "offline",
      offlineScenes: scenario.scenes,
      totalScenes: scenario.scenes.length,
      savedScenarioId: scenario.id
    });
  };

  const handleDeleteSavedScenario = (scenarioId: string) => {
    deleteSavedScenario(scenarioId);
    setSavedScenarios(listSavedScenarios());
  };

  const handleManualPlayerChange = (index: number, field: 'role' | 'secret', value: string) => {
    const updated = [...players];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setPlayers(updated);
  };

  const handleLaunchGame = () => {
    if (players.length === 0) {
      setError("Generoi ensin hahmojen roolit ja salaisuudet painamalla painiketta.");
      return;
    }
    
    const finalTheme = selectedPresetId === "custom" ? customTheme : THEME_PRESETS.find(p => p.id === selectedPresetId)?.title || "Mysteeri";
    
    onStartGame({
      theme: finalTheme,
      initialIdea: initialIdea,
      totalScenes: totalScenes,
      players: players,
      generationMode: "ollama",
      ollamaBaseUrl,
      ollamaModel: selectedModel
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in p-2 md:p-6 pb-20">
      
      {/* Intro Header */}
      <div className="text-center space-y-3">
        <h1 className="text-4xl md:text-5xl font-mono tracking-tight text-white font-bold uppercase border-b border-gray-800 pb-4">
          <span className="text-red-500">RAUTATIE</span> Draamamoottori
        </h1>
        <p className="text-gray-400 font-sans max-w-xl mx-auto text-sm md:text-base leading-relaxed">
          Lineaarinen ja ohjattu (railroaded) hidden role -sosiaalipeli. Tekoäly luo dramaturgisia mikroskenaarioita, joita pelaajat näyttelevät reaaliajassa samanaikaisesti.
        </p>
      </div>

      {/* Local Ollama connection */}
      <div className="bg-zinc-900/60 border border-zinc-800 p-5 rounded-xl space-y-4 shadow-xl leading-relaxed">
        <div className="flex items-center justify-between gap-4 border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2 text-white font-semibold font-mono">
            <Server className="w-4 h-4 text-emerald-400" />
            <h3>LOKAALI OLLAMA SELAIMESTA</h3>
          </div>
          <button
            type="button"
            onClick={handleLoadModels}
            disabled={isLoadingModels}
            className="px-3 py-2 rounded bg-emerald-950/30 hover:bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs font-mono uppercase flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingModels ? "animate-spin" : ""}`} />
            Listaa mallit
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block text-xs font-mono font-bold text-gray-400 uppercase space-y-2">
            <span>Ollama URL selaimesta katsottuna</span>
            <input
              type="text"
              value={ollamaBaseUrl}
              onChange={(e) => setOllamaBaseUrl(e.target.value)}
              placeholder="http://localhost:11434"
              className="w-full bg-zinc-950 border border-zinc-800 text-white rounded p-3 text-sm focus:outline-none focus:border-emerald-500/60 font-sans normal-case"
            />
          </label>

          <label className="block text-xs font-mono font-bold text-gray-400 uppercase space-y-2">
            <span>Kielimalli listasta</span>
            <select
              value={selectedModel}
              onChange={(e) => handleModelSelect(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 text-white rounded p-3 text-sm focus:outline-none focus:border-emerald-500/60 font-sans normal-case"
            >
              <option value="">Valitse malli...</option>
              {ollamaModels.map((model) => (
                <option key={model.name} value={model.name}>{model.name}</option>
              ))}
              {selectedModel && !ollamaModels.some((model) => model.name === selectedModel) && (
                <option value={selectedModel}>{selectedModel}</option>
              )}
            </select>
          </label>
        </div>

        <label className="block text-xs font-mono font-bold text-gray-400 uppercase space-y-2">
          <span>Kielimalli käsin, jos listaus on tyhjä</span>
          <input
            type="text"
            value={selectedModel}
            onChange={(e) => handleModelSelect(e.target.value)}
            placeholder="esim. gemma3:4b tai llama3.2:3b"
            className="w-full bg-zinc-950 border border-zinc-800 text-white rounded p-3 text-sm focus:outline-none focus:border-emerald-500/60 font-sans normal-case"
          />
        </label>

        <p className="text-[11px] text-zinc-500 font-sans">
          Mallilista palautti {ollamaModels.length} mallia. Jos tiedat mallin nimen, voit kirjoittaa sen suoraan ja kokeilla generointia.
        </p>

        <p className="text-[11px] text-zinc-500 font-sans">
          Kun tämä sivu ajetaan Raspberryltä ja Ollama läppäriltä, <code className="text-zinc-300">localhost</code> tarkoittaa läppäriäsi selaimen näkökulmasta. Jos selain estää pyynnöt, Ollama pitää käynnistää sallimaan tämän sivun origin.
        </p>
      </div>

      {/* Saved offline scenarios */}
      {savedScenarios.length > 0 && (
        <div className="bg-zinc-900/60 border border-zinc-800 p-5 rounded-xl space-y-4 shadow-xl leading-relaxed">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h3 className="text-white font-semibold font-mono">TALLENNETUT OFFLINE-SKENAARIOT</h3>
            <span className="text-[10px] text-zinc-500 font-mono uppercase">{savedScenarios.length} tallessa</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {savedScenarios.map((scenario) => (
              <div key={scenario.id} className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-4 space-y-3">
                <div>
                  <h4 className="text-sm font-mono font-bold text-white">{scenario.title}</h4>
                  <p className="text-[11px] text-zinc-500">
                    {scenario.scenes.length} kohtausta • {new Date(scenario.savedAt).toLocaleString("fi-FI")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleStartSavedScenario(scenario.id)}
                    className="flex-1 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs uppercase font-bold"
                  >
                    Pelaa offline
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSavedScenario(scenario.id)}
                    className="px-3 py-2 rounded bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-red-300"
                    title="Poista tallennettu skenaario"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-950/40 border border-red-500/30 text-red-300 rounded-lg text-sm text-center font-mono">
          <strong>VIRHE:</strong> {error}
        </div>
      )}

      {/* Grid: Settings Column + Players Column */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        
        {/* Step 1: Theme selection & settings */}
        <div className="md:col-span-7 bg-zinc-900/60 border border-zinc-800 p-6 rounded-xl space-y-6 shadow-xl leading-relaxed">
          <div className="flex items-center space-x-2 text-white font-semibold font-mono pb-2 border-b border-zinc-800">
            <span className="w-6 h-6 flex items-center justify-center bg-red-500/20 text-red-400 border border-red-500/40 rounded text-xs">1</span>
            <h3>VALITSE PELITEEMA JA SKENAARIO</h3>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {THEME_PRESETS.map((preset) => {
              const IconComp = preset.icon;
              const isSelected = selectedPresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset.id)}
                  className={`flex flex-col text-left p-3 rounded-lg border transition-all duration-300 relative overflow-hidden h-36 justify-between ${
                    isSelected 
                      ? `${preset.accent} border-current ring-1 ring-white/10` 
                      : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700 text-gray-400 hover:text-gray-300"
                  }`}
                >
                  <div className="flex justify-between items-start w-full">
                    <span className="text-xs font-mono uppercase font-semibold">Preset</span>
                    <IconComp className={`w-5 h-5 ${isSelected ? 'opacity-100' : 'opacity-40'}`} />
                  </div>
                  <div className="space-y-1 mt-auto">
                    <h4 className="font-mono text-sm font-bold text-white leading-tight">{preset.title}</h4>
                    <p className="text-[11px] leading-tight text-gray-400 opacity-90 line-clamp-2 md:line-clamp-3">{preset.description}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Custom Theme toggle */}
          <button
            onClick={() => handleSelectPreset("custom")}
            className={`w-full text-left p-4 rounded-lg border transition-all ${
              selectedPresetId === "custom" 
                ? "border-purple-500/50 bg-purple-950/20 text-purple-300 font-mono" 
                : "border-zinc-800 bg-zinc-950/40 text-zinc-500 hover:text-zinc-400"
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold">Luo täysin oma custom-teema...</span>
              <Sparkles className="w-4 h-4" />
            </div>
          </button>

          {/* Custom Input Fields */}
          {selectedPresetId === "custom" && (
            <div className="space-y-3 animate-fade-in">
              <label className="block text-xs font-mono font-bold text-gray-400 uppercase">Teeman Nimi</label>
              <input
                type="text"
                placeholder="Esim. Apokalyptinen majakka, Suo-olennon pito jne."
                value={customTheme}
                onChange={(e) => setCustomTheme(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 text-white rounded p-3 text-sm focus:outline-none focus:border-purple-500/60 font-sans"
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-xs font-mono font-bold text-gray-400 uppercase">
              Tarkemmat PJ:n alustusnuotit (Premissi / Tilannekuvaus)
            </label>
            <textarea
              rows={3}
              placeholder="Kirjoita vapaa kuvaus siitä mistä lähdetään liikkeelle tai miten mysteeri alkaa..."
              value={initialIdea}
              onChange={(e) => setInitialIdea(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 text-white rounded p-3 text-sm focus:outline-none focus:border-red-500/60 font-sans leading-relaxed"
            />
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-mono font-bold text-gray-400 uppercase">Pelin Kesto (Draamakohtauksia)</label>
            <div className="flex items-center space-x-3">
              {[3, 4, 5, 6, 7].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setTotalScenes(num)}
                  className={`flex-1 py-2 rounded text-xs font-mono font-semibold border transition ${
                    totalScenes === num 
                      ? "border-red-500/50 bg-red-950/20 text-red-400 font-bold" 
                      : "border-zinc-800 bg-zinc-950/40 text-gray-400 hover:border-zinc-700"
                  }`}
                >
                  {num} {num === 5 ? "(Normaali)" : ""}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-500 font-sans">
              Draaman kaari räätälöidään siten, että kliimaksi sijoittuu toiseksi viimeiseen ja täydellinen välienselvittely / ratkaisupeli viimeiseen kohtaukseen.
            </p>
          </div>
        </div>

        {/* Step 2: Players and names */}
        <div className="md:col-span-5 bg-zinc-900/60 border border-zinc-800 p-6 rounded-xl space-y-5 shadow-xl leading-relaxed">
          <div className="flex items-center space-x-2 text-white font-semibold font-mono pb-2 border-b border-zinc-800">
            <span className="w-6 h-6 flex items-center justify-center bg-red-500/20 text-red-400 border border-red-500/40 rounded text-xs">2</span>
            <h3>PELAAJAT ({playerNames.length}/10)</h3>
          </div>

          <form onSubmit={handleAddPlayerName} className="flex gap-2">
            <input
              type="text"
              placeholder="Pelaajan nimi..."
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              className="flex-grow bg-zinc-950 border border-zinc-800 text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-red-500/60"
            />
            <button
              type="submit"
              className="px-3 bg-zinc-800 border border-zinc-700 text-white rounded hover:bg-zinc-700 transition"
            >
              <Plus className="w-5 h-5" />
            </button>
          </form>

          {/* List of current simple player names with badge */}
          <div className="flex flex-wrap gap-2">
            {playerNames.map((name, idx) => (
              <span 
                key={idx} 
                className="inline-flex items-center pl-3 pr-2 py-1 bg-zinc-950/60 border border-zinc-800 rounded-full text-xs text-gray-300 font-medium"
              >
                {name}
                <button
                  type="button"
                  onClick={() => handleRemovePlayerName(idx)}
                  className="ml-2 text-gray-500 hover:text-red-400 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>

          {/* Button to let Gemini auto-generate deep roles/secrets */}
          <button
            type="button"
            onClick={handleGenerateRoles}
            disabled={isGeneratingRoles}
            className={`w-full py-3 px-4 rounded-lg font-mono text-xs uppercase font-bold tracking-wider border flex items-center justify-center gap-2 transition duration-300 ${
              isGeneratingRoles 
                ? "bg-zinc-950 border-zinc-800 text-zinc-500 cursor-not-allowed" 
                : "bg-red-500/10 border-red-500/40 hover:bg-red-500/25 text-red-400 shadow-md shadow-red-950/20 pointer-events-auto"
            }`}
          >
            {isGeneratingRoles ? (
              <>
                <svg className="animate-spin h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Generoidaan Roolihahmoja...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-400" />
                Generoi Roolit & Motiivit Tekoälyllä
              </>
            )}
          </button>
        </div>
      </div>

      {/* Step 3: View generated roles and edit them if needed */}
      {players.length > 0 && (
        <div className="bg-zinc-900/60 border border-zinc-800 p-6 rounded-xl space-y-6 shadow-xl leading-relaxed animate-fade-in-up">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <div className="flex items-center space-x-2 text-white font-semibold font-mono">
              <span className="w-6 h-6 flex items-center justify-center bg-red-500/20 text-red-400 border border-red-500/40 rounded text-xs animate-pulse">3</span>
              <h3>ROOLIHAHMOT JA SALAISUUDET ({activeThemeTitle})</h3>
            </div>
            <span className="text-[10px] font-mono text-zinc-500 uppercase">GMin Muokattavissa vapaasti</span>
          </div>

          <p className="text-gray-400 text-xs font-sans">
            Tekoäly loi teemaan sopivat juonikytkökset. Voit hienosäätää rooleja ja salaisuuksia ennen pelin julistamista alkaneeksi!
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {players.map((p, idx) => (
              <div key={p.id} className="bg-zinc-950/40 border border-zinc-800/80 rounded-lg p-4 space-y-3 shadow-inner">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-200 font-mono flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
                    {p.name}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <div>
                    <label className="block text-[10px] font-mono tracking-wider uppercase text-zinc-500 mb-1">Draamallinen Rooli / Virka</label>
                    <input
                      type="text"
                      value={p.role}
                      onChange={(e) => handleManualPlayerChange(idx, 'role', e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-zinc-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono tracking-wider uppercase text-zinc-500 mb-1">Motiivi tai Hidden Role -Salaisuus</label>
                    <textarea
                      rows={2}
                      value={p.secret}
                      onChange={(e) => handleManualPlayerChange(idx, 'secret', e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-700 font-sans leading-relaxed resize-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-zinc-800 flex justify-end">
            <button
              onClick={handleLaunchGame}
              className="py-3 px-8 rounded-lg bg-red-600 hover:bg-red-500 text-white font-mono uppercase font-bold text-xs tracking-wider border border-red-500/20 flex items-center gap-2 transition duration-300 shadow-lg shadow-red-950/40 animate-pulse hover:animate-none"
            >
              Käynnistä Junailtu Rooli-ilmaisu!
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
