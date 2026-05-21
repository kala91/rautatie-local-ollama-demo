import React, { useState, useEffect } from "react";
import { GameConfig, Scene, Player, GameState } from "./types";
import { GameSetup } from "./components/GameSetup";
import { SceneNarrative } from "./components/SceneNarrative";
import { PlayerTaskGrid } from "./components/PlayerTaskGrid";
import { GmPanel } from "./components/GmPanel";
import { DramaturgicalLog } from "./components/DramaturgicalLog";
import { EpilogueView } from "./components/EpilogueView";
import { Film, Skull, Eye, EyeOff, AlertTriangle, RefreshCw, Compass, ArrowRight, Save } from "lucide-react";
import { generateEpilogueWithOllama, generateSceneWithOllama } from "./ollamaClient";
import { saveScenario } from "./scenarioStorage";

// List of fun, thematic loading quotes to alternate during AI generation
const LOADING_QUOTES = [
  "Lasketaan draaman kaarta ja konfliktipistettä...",
  "Haudotaan seuraavan kohtauksen salaisuuksia...",
  "Piirretään tylyä, junailtua tarinanhahmoa...",
  "Koordinoidaan pelaajien jännitteitä keskenään...",
  "Viritytään ihmis-pelinjohtajan huomioihin...",
  "Valmistellaan dramaturgista kliimaksia...",
  "Kiinnitetään kohtalon raiteita kasaan..."
];

export default function App() {
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [currentScene, setCurrentScene] = useState<Scene | null>(null);
  const [history, setHistory] = useState<Scene[]>([]);
  const [isStarted, setIsStarted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  
  // Game control states
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGmView, setIsGmView] = useState(true); // default to true so GM sees their panel at the start
  const [showGmControls, setShowGmControls] = useState(false); // Collapsed by default to keep the projected screen clean!
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [epilogueText, setEpilogueText] = useState("");
  const [judgmentText, setJudgmentText] = useState("");
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  
  // Fun rotating loading quote index
  const [loadingQuoteIdx, setLoadingQuoteIdx] = useState(0);

  // Rotate loading quotes when generation is active
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating) {
      interval = setInterval(() => {
        setLoadingQuoteIdx((prev) => (prev + 1) % LOADING_QUOTES.length);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  // Load game state from localStorage on mount (for persistent in-person play resilience!)
  useEffect(() => {
    const saved = localStorage.getItem("rautatie_game_state");
    if (saved) {
      try {
        const stateObj = JSON.parse(saved);
        if (stateObj.config && stateObj.isStarted) {
          setConfig(stateObj.config);
          setCurrentScene(stateObj.currentScene);
          setHistory(stateObj.history || []);
          setIsStarted(stateObj.isStarted);
          setIsFinished(stateObj.isFinished || false);
          setEpilogueText(stateObj.epilogueText || "");
          setJudgmentText(stateObj.judgmentText || "");
        }
      } catch (e) {
        console.error("Local storage restoration failed", e);
      }
    }
  }, []);

  // Sync game state to localStorage
  const syncStorage = (
    cfg: GameConfig | null, 
    curS: Scene | null, 
    hist: Scene[], 
    started: boolean, 
    finished: boolean,
    epText = "",
    jdText = ""
  ) => {
    if (started) {
      localStorage.setItem("rautatie_game_state", JSON.stringify({
        config: cfg,
        currentScene: curS,
        history: hist,
        isStarted: started,
        isFinished: finished,
        epilogueText: epText,
        judgmentText: jdText
      }));
    } else {
      localStorage.removeItem("rautatie_game_state");
    }
  };

  const handleStartGame = async (selectedConfig: GameConfig) => {
    setIsGenerating(true);
    setError(null);
    setConfig(selectedConfig);

    try {
      let firstScene: Scene;

      if (selectedConfig.generationMode === "offline" && selectedConfig.offlineScenes?.length) {
        firstScene = selectedConfig.offlineScenes[0];
      } else {
        if (!selectedConfig.ollamaBaseUrl || !selectedConfig.ollamaModel) {
          throw new Error("Ollama URL tai malli puuttuu.");
        }
        firstScene = await generateSceneWithOllama(
          selectedConfig.ollamaBaseUrl,
          selectedConfig.ollamaModel,
          selectedConfig,
          [],
          1,
          ""
        );
      }

      setCurrentScene(firstScene);
      setIsStarted(true);
      setHistory([]);
      setIsFinished(false);

      syncStorage(selectedConfig, firstScene, [], true, false);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Yhteysvirhe kielimalliin. Tarkista Ollama-asetukset.");
      setConfig(null);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpdatePlayersInConfig = (updatedPlayers: Player[]) => {
    if (!config) return;
    const updatedConfig = { ...config, players: updatedPlayers };
    setConfig(updatedConfig);
    syncStorage(updatedConfig, currentScene, history, isStarted, isFinished, epilogueText, judgmentText);
  };

  const handleGenerateNextScene = async (humanNotes: string) => {
    if (!config || !currentScene) return;

    setIsGenerating(true);
    setError(null);

    // Save notes of current scene into history stack
    const sceneToArchive = {
      ...currentScene,
      humanGmNotesFeedback: humanNotes || undefined
    };
    const updatedHistory = [...history, sceneToArchive];
    setHistory(updatedHistory);

    const nextSceneNum = currentScene.sceneNumber + 1;
    const isOverLimit = nextSceneNum > config.totalScenes;

    try {
      if (isOverLimit) {
        let data = {
          epilogue: "Offline-skenaario päättyi. Pelinjohtaja voi lukea viimeisen kohtauksen lopetuksena tai kirjata oman epilogin seuraavaan versioon.",
          wasCorrectlySolved: "Offline-pelissä erillistä mallin arvioimaa ratkaisua ei luotu."
        };
        if (config.generationMode !== "offline" && config.ollamaBaseUrl && config.ollamaModel) {
          data = await generateEpilogueWithOllama(config.ollamaBaseUrl, config.ollamaModel, config, updatedHistory, humanNotes);
        }
        setEpilogueText(data.epilogue);
        setJudgmentText(data.wasCorrectlySolved);
        setIsFinished(true);

        syncStorage(config, currentScene, updatedHistory, true, true, data.epilogue, data.wasCorrectlySolved);

      } else {
        let nextScene: Scene;
        if (config.generationMode === "offline" && config.offlineScenes?.[nextSceneNum - 1]) {
          nextScene = config.offlineScenes[nextSceneNum - 1];
        } else {
          if (!config.ollamaBaseUrl || !config.ollamaModel) {
            throw new Error("Ollama URL tai malli puuttuu.");
          }
          nextScene = await generateSceneWithOllama(
            config.ollamaBaseUrl,
            config.ollamaModel,
            config,
            updatedHistory,
            nextSceneNum,
            humanNotes
          );
        }
        setCurrentScene(nextScene);

        syncStorage(config, nextScene, updatedHistory, true, false);
      }

    } catch (err: any) {
      console.error(err);
      setError(`Rautatien siirrossa sattui virhe: ${err.message || 'Tekoälyyhteys katkesi.'}`);
      // Revert history back so GM can re-try safely without duplicate stack entries
      setHistory(history);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleResetGame = () => {
    setShowResetConfirm(true);
  };

  const handleConfirmReset = () => {
    setConfig(null);
    setCurrentScene(null);
    setHistory([]);
    setIsStarted(false);
    setIsFinished(false);
    setEpilogueText("");
    setJudgmentText("");
    setError(null);
    setShowResetConfirm(false);
    syncStorage(null, null, [], false, false);
  };

  const handleCancelReset = () => {
    setShowResetConfirm(false);
  };

  const handleSaveCurrentScenario = () => {
    if (!config) return;
    const scenes = isFinished
      ? history
      : currentScene
        ? [...history, currentScene]
        : history;
    if (scenes.length === 0) {
      setSaveNotice("Ei kohtauksia tallennettavaksi.");
      return;
    }
    const saved = saveScenario(`${config.theme} (${scenes.length} kohtausta)`, config, scenes, epilogueText, judgmentText);
    setSaveNotice(`Tallennettu offline-skenaarioksi: ${saved.title}`);
    setTimeout(() => setSaveNotice(null), 3500);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-gray-100 flex flex-col font-sans transition-colors duration-500 relative">
      
      {/* Background static fog/vibe */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(24,24,27,0.8),rgba(9,9,11,1))] pointer-events-none z-0"></div>

      {/* Atmospheric Full screen loader */}
      {isGenerating && (
        <div className="fixed inset-0 bg-zinc-950/90 flex flex-col items-center justify-center z-50 p-6 backdrop-blur-sm animate-fade-in uppercase">
          <div className="space-y-6 text-center max-w-sm">
            {/* Spinning visual compass */}
            <div className="relative w-20 h-20 mx-auto">
              {/* Outer ticking border */}
              <div className="absolute inset-0 rounded-full border-2 border-red-500/20 border-t-red-500 animate-spin"></div>
              {/* Spinning compass center */}
              <div className="absolute inset-2 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                <Compass className="w-8 h-8 text-red-500 animate-pulse-slow" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-sm font-mono tracking-widest font-extrabold text-white">
                ORCHESTRATING SCENE...
              </h2>
              <p className="text-xs text-zinc-500 font-mono tracking-wide">
                Rautatie -tekoäly rakentaa sosiaalisia akseleita
              </p>
            </div>

            {/* Rotating text */}
            <div className="p-3 bg-zinc-900/60 border border-zinc-900 rounded-lg min-h-[50px] flex items-center justify-center">
              <span className="text-[11px] text-amber-400 font-mono italic animate-pulse">
                "{LOADING_QUOTES[loadingQuoteIdx]}"
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Primary Application Body */}
      <div className="relative z-10 flex-grow flex flex-col select-none md:select-text">
        
        {/* Navigation / Live App Top Bar */}
        <header className="border-b border-zinc-900 bg-zinc-950/60 backdrop-blur-md sticky top-0 z-40 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3.5">
              <div className="w-8 h-8 rounded-lg bg-red-650 flex items-center justify-center border border-red-500/20 shadow-md">
                <Film className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <span className="text-sm md:text-base font-mono font-black text-white tracking-tight uppercase leading-tight">
                  <span className="text-red-500">RAUTATIE</span> MOOTTORI
                </span>
                <span className="text-[10px] text-zinc-500 font-mono block -mt-1 hidden sm:block uppercase">
                  Hidden Role RPG Conductor
                </span>
              </div>
            </div>

            {/* Quick status details during play */}
            {isStarted && config && (
              <div className="flex items-center gap-2 md:gap-4 font-mono text-xs">
                {/* Active casualties tracking helper */}
                <div className="hidden md:flex items-center gap-1.5 text-zinc-500">
                  <Skull className="w-3.5 h-3.5" />
                  <span>Kuolleita: {config.players.filter(p => p.isDead).length}</span>
                </div>

                <span className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-850 text-gray-400 hidden sm:inline-block">
                  {config.theme}
                </span>

                <button
                  type="button"
                  onClick={handleSaveCurrentScenario}
                  className="px-2.5 py-1 rounded bg-emerald-950/30 hover:bg-emerald-950/60 border border-emerald-500/25 text-emerald-300 transition flex items-center gap-1"
                  title="Tallenna pelatut/generoidut kohtaukset offline-skenaarioksi"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Tallenna</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetGame}
                  className="px-2.5 py-1 rounded bg-red-950/30 hover:bg-red-950/60 border border-red-500/20 text-red-400 transition hover:text-red-300"
                >
                  Keskeytä
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Outer view router container */}
        <main className="flex-grow">
          {error && (
            <div className="max-w-xl mx-auto mt-6 p-4 bg-red-950/30 border border-red-500/30 text-red-300 rounded-lg text-xs md:text-sm font-mono flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <strong>TEKNINEN VIRHE:</strong> {error}
                <button
                  onClick={() => setError(null)}
                  className="mt-2 block px-3 py-1 bg-zinc-900 border border-zinc-800 text-white rounded text-[10px] hover:bg-zinc-800 transition uppercase"
                >
                  Sulje virheviesti
                </button>
              </div>
            </div>
          )}

          {saveNotice && (
            <div className="max-w-xl mx-auto mt-6 p-3 bg-emerald-950/30 border border-emerald-500/30 text-emerald-200 rounded-lg text-xs md:text-sm font-mono">
              {saveNotice}
            </div>
          )}

          {!isStarted ? (
            // Phase 1: Game Settings Setup
            <div className="py-6 md:py-10">
              <GameSetup onStartGame={handleStartGame} />
            </div>
          ) : isFinished ? (
            // Phase 3: Epilogue and outcomes
            <div className="py-6 md:py-10">
              <EpilogueView
                config={config!}
                history={history}
                epilogueText={epilogueText}
                judgmentText={judgmentText}
                onResetGame={handleResetGame}
              />
            </div>
          ) : (
            // Phase 2: Core gameplay view - expanded to maximum monitor width for in-room wall projection
            <div className="max-w-full px-4 md:px-8 xl:px-12 py-6 space-y-6 pb-32">
              
              {/* Scene Description Card */}
              {currentScene && (
                <SceneNarrative 
                  scene={currentScene} 
                  totalScenes={config!.totalScenes} 
                />
              )}

              {/* Character Prompt Grid */}
              {currentScene && config && (
                <PlayerTaskGrid
                  players={config.players}
                  tasks={currentScene.playerTasks}
                  isGmView={isGmView}
                />
              )}

              {/* Streamlined Live Controls Ribbons below player prompts */}
              {currentScene && config && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 md:p-5 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="space-y-0.5 text-center md:text-left">
                    <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider block">Kohtauksen ohjaus</span>
                    <p className="text-xs text-zinc-300 font-sans">
                      Kun larp-pelaajat ovat esittäneet annetut ohjeet, siirry seuraavaan kohtaukseen alta:
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-3 w-full md:w-auto">
                    {/* Primary direct Next Scene action button */}
                    <button
                      type="button"
                      onClick={() => handleGenerateNextScene("")}
                      disabled={isGenerating}
                      className={`flex-1 md:flex-none py-3 px-8 rounded-lg font-mono text-xs sm:text-sm font-black uppercase border tracking-wider flex items-center justify-center gap-2 transition duration-300 shadow-xl ${
                        isGenerating
                          ? "bg-zinc-950 border-zinc-850 text-zinc-500 cursor-not-allowed"
                          : "bg-red-650 hover:bg-red-500 text-white border-red-500/20 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                      }`}
                    >
                      {isGenerating ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-red-400" />
                          Generoidaan...
                        </>
                      ) : (
                        <>
                          Seuraava Kohtaus
                          <ArrowRight className="w-4 h-4 text-white" />
                        </>
                      )}
                    </button>

                    {/* Secondary button toggling advanced settings / notes commentator layout */}
                    <button
                      type="button"
                      onClick={() => setShowGmControls(!showGmControls)}
                      className={`py-3 px-4 rounded-lg font-mono text-xs uppercase font-extrabold border transition duration-300 flex items-center justify-center gap-2 ${
                        showGmControls
                          ? "border-amber-500/30 bg-amber-950/20 text-amber-400 hover:bg-amber-500/10"
                          : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      ⚙️ {showGmControls ? "Piilota erikoishallinta" : "Erikoissäädöt & Raportointi"}
                    </button>
                  </div>
                </div>
              )}

              {/* Render the full Human GM detailed comment panel and casualties editor, if requested/expanded */}
              {currentScene && config && showGmControls && (
                <div className="animate-slide-down">
                  <GmPanel
                    players={config.players}
                    currentScene={currentScene}
                    isGmView={isGmView}
                    onToggleViewMode={() => setIsGmView(!isGmView)}
                    onUpdatePlayers={handleUpdatePlayersInConfig}
                    onGenerateNextScene={handleGenerateNextScene}
                    isGenerating={isGenerating}
                    sceneCountHistory={history.length}
                  />
                </div>
              )}

              {/* Previous Scenes Logs - Accordion */}
              {history.length > 0 && (
                <DramaturgicalLog history={history} />
              )}

            </div>
          )}
        </main>

        {/* Global Footer info */}
        <footer className="border-t border-zinc-900 py-4 bg-zinc-950/20 text-center font-mono text-[9px] text-zinc-600 z-10 shrink-0 select-none">
          RAUTATIE ENALTA-MÄÄRÄTTY HIDDEN ROLE PELIMOOTTORI © 2026 • CREATED IN FULLSTACK AI WORKSPACE
        </footer>

        {/* Custom state-based overlay confirm modal - avoids iframe window.confirm limits */}
        {showResetConfirm && (
          <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-55 p-4 backdrop-blur-md animate-fade-in uppercase font-mono">
            <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6 text-center leading-relaxed">
              <div className="w-12 h-12 rounded-full bg-red-950/40 border border-red-500/30 text-red-500 flex items-center justify-center mx-auto mb-2 animate-bounce">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-black text-white">Nollataanko pelin kulku?</h2>
                <p className="text-xs text-zinc-405 font-sans normal-case text-zinc-450">
                  Tämä päättää nykyisen tarinan raiteet ja ohjaa takaisin luonti-ikkunaan. Nykyisiä tietoja ei voi palauttaa.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleConfirmReset}
                  className="flex-1 py-3 px-4 bg-red-650 hover:bg-red-500 text-white rounded-lg font-bold text-xs tracking-wider transition uppercase cursor-pointer"
                >
                  Kyllä, nollaa peli
                </button>
                <button
                  type="button"
                  onClick={handleCancelReset}
                  className="flex-1 py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg font-bold text-xs tracking-wider transition border border-zinc-750 uppercase cursor-pointer"
                >
                  Peruuta
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
