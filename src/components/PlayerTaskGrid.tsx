import React, { useState } from "react";
import { Player, PlayerTask } from "../types";
import { MessageSquare, ArrowRight, Eye, EyeOff, Skull, Compass, ShieldAlert, Sparkles, HelpCircle } from "lucide-react";

interface PlayerTaskGridProps {
  players: Player[];
  tasks: PlayerTask[];
  isGmView: boolean; // if true, secrets are always visible
}

export function PlayerTaskGrid({ players, tasks, isGmView }: PlayerTaskGridProps) {
  // Store individual card toggles: map of player id -> hidden (boolean)
  // By default, let's keep them EXPOSED (since user said: "pelaajilla on mahdollisuus huijata... tämä ei haittaa")
  // but let them hide it optionally if they want to.
  const [individualExposure, setIndividualExposure] = useState<{ [playerId: string]: boolean }>({});

  const toggleRevealSecret = (id: string) => {
    setIndividualExposure(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const getSocialBadgeColor = (category: string) => {
    switch (category) {
      case "Kysyvä": return "border-blue-500/30 text-blue-400 bg-blue-950/20";
      case "Toteava": return "border-cyan-500/30 text-cyan-400 bg-cyan-950/20";
      case "Selvittävä": return "border-purple-500/30 text-purple-400 bg-purple-950/20";
      case "Tavoitteleva": return "border-amber-500/30 text-amber-400 bg-amber-950/20";
      default: return "border-zinc-700 text-zinc-400 bg-zinc-850";
    }
  };

  const getConcreteIndicator = (category: string) => {
    switch (category) {
      case "Monologi": return "💬 Monologi";
      case "Matkiminen": return "🎭 Matkiminen";
      case "Dialogi": return "🗣️ Dialogi toisen kanssa";
      case "Fyysinen ele": return "🕺 Fyysinen ele";
      case "Siirtyminen": return "🚶 Siirtyminen paikkaan";
      case "Esineen kanssa toimiminen": return "📦 Esineen kanssa toimiminen";
      default: return "⚡ Toiminta";
    }
  };

  return (
    <div className="space-y-4 animate-fade-in pb-4">
      
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
        <h3 className="text-xs sm:text-sm font-mono tracking-wider font-extrabold text-zinc-400 uppercase flex items-center gap-2">
          <Sparkles className="w-4.5 h-4.5 text-amber-500" />
          Aktiiviset Toimintaohjeet Pelaajille
        </h3>
        <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider hidden sm:block">
          Suoritetaan samanaikaisesti reaaliajassa!
        </p>
      </div>

      {/* Grid of Players - adapted for screen-width filling on walls with xl / 2xl scalability */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3.5">
        {players.map((player) => {
          const task = tasks.find(t => t.characterName.toLowerCase() === player.name.toLowerCase());
          const isDead = player.isDead;
          const isSecretRevealed = isGmView || individualExposure[player.id];

          return (
            <div 
              key={player.id} 
              className={`relative rounded-xl border p-4 flex flex-col justify-between transition-all duration-300 min-h-[220px] shadow-xl overflow-hidden ${
                isDead 
                  ? "border-zinc-900 bg-zinc-950/70 text-zinc-600 opacity-50" 
                  : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900/70"
              }`}
            >
              
              {/* Card top edge background flair */}
              {!isDead && (
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500/60 via-amber-500/40 to-purple-500/30"></div>
              )}

              {/* Player / Character Info Header */}
              <div className="space-y-1.5 relative pb-2 border-b border-zinc-800/60 shrink-0">
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono font-bold tracking-widest text-zinc-500 uppercase">
                      Hahmo
                    </span>
                    <h4 className="text-xl sm:text-2xl font-black text-white font-mono uppercase flex items-center gap-2 leading-none">
                      {isDead && <Skull className="w-5 h-5 text-zinc-600 animate-pulse shrink-0" />}
                      {player.name}
                    </h4>
                    <p className="text-xs sm:text-sm text-red-400 font-mono font-bold uppercase tracking-wide">
                      Rooli: {player.role}
                    </p>
                  </div>

                  {/* Toggle View Secret Motivation */}
                  {!isDead && !isGmView && (
                    <button
                      onClick={() => toggleRevealSecret(player.id)}
                      className="p-1 px-2 rounded border border-zinc-800 bg-zinc-950 text-[10px] font-mono text-zinc-400 hover:text-white hover:border-zinc-700 transition flex items-center gap-1 shrink-0"
                      title={isSecretRevealed ? "Piilota salaisuus" : "Paljasta salaisuus"}
                    >
                      {isSecretRevealed ? <EyeOff className="w-3.5 h-3.5 text-red-400" /> : <Eye className="w-3.5 h-3.5 text-zinc-450" />}
                      {isSecretRevealed ? "Piilota" : "Salaisuus"}
                    </button>
                  )}
                </div>

                {/* Secret Motivation display */}
                {isDead ? (
                  <div className="text-[11px] text-zinc-500 italic bg-zinc-950/40 rounded p-1.5 border border-zinc-900">
                    Sankari on eliminoitu tarinasta tässä vaiheessa.
                  </div>
                ) : isSecretRevealed ? (
                  <div className="text-[11px] text-amber-300 font-sans bg-amber-950/30 border border-amber-500/20 rounded p-2 leading-relaxed">
                    <strong className="text-[9px] font-mono uppercase text-amber-500 block mb-0.5 tracking-wider">Motiivi / Tehtävän Tausta:</strong>
                    {player.secret}
                  </div>
                ) : (
                  <div className="text-[10px] text-zinc-500 italic py-1 text-center font-mono rounded bg-zinc-950/30 select-none border border-zinc-900/60">
                    Salaisuus piilotettu peliruudulta
                  </div>
                )}
              </div>

              {/* Task Section */}
              <div className="flex-grow flex flex-col justify-between pt-2.5 space-y-3">
                {isDead ? (
                  <div className="flex-grow flex flex-col items-center justify-center text-center p-2 text-xs italic font-mono space-y-1.5 text-zinc-600">
                    <Skull className="w-10 h-10 text-zinc-800 animate-pulse" />
                    <div>
                      Rooli on loppunut toistaiseksi.<br />
                      Seuraa muiden kiihkeää peliä ja toimi varjona.
                    </div>
                  </div>
                ) : task ? (
                  <>
                    {/* Action taxonomic badges */}
                    <div className="flex flex-wrap gap-1">
                      <span className={`px-2 py-0.5 rounded border text-[9px] font-mono uppercase font-black tracking-wider ${getSocialBadgeColor(task.socialActionCategory)}`}>
                        {task.socialActionCategory}
                      </span>
                      <span className="px-2 py-0.5 rounded border border-zinc-800 bg-zinc-950 text-zinc-400 text-[9px] font-mono uppercase font-semibold">
                        {getConcreteIndicator(task.concreteActionCategory)}
                      </span>
                      {task.targetCharacter && task.targetCharacter !== "Kaikki" && (
                        <span className="px-2 py-0.5 rounded border border-red-500/20 bg-red-950/20 text-red-450 text-[9px] font-mono uppercase font-bold flex items-center gap-1">
                          Kohde: {task.targetCharacter}
                        </span>
                      )}
                    </div>

                    {/* Instruction Prompt itself */}
                    <div className="space-y-1 py-1 bg-zinc-950/20 p-2 rounded border border-zinc-850/50">
                      <strong className="text-[9px] font-mono uppercase text-zinc-500 font-bold block tracking-wider">Tämän hetken tehtäväsi:</strong>
                      <p className="text-zinc-100 font-sans text-xs sm:text-sm md:text-md font-bold leading-relaxed border-l-2 border-red-500 pl-2.5">
                        {task.instructionPrompt}
                      </p>
                    </div>

                    {/* Background game purpose clue for the player */}
                    {isSecretRevealed && (
                      <div className="text-[10px] text-zinc-500 italic pt-1 border-t border-zinc-850 flex items-center gap-1 shrink-0">
                        <span className="font-mono text-[8px] font-black text-zinc-600 uppercase shrink-0">Draamatekninen Ohje:</span>
                        <span className="line-clamp-1 text-[10px]" title={task.gamePurpose}>{task.gamePurpose}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex-grow flex items-center justify-center text-zinc-500 font-mono text-xs italic text-center">
                    Tekoäly ei asettanut ohjetta tässä skenaariossa.
                  </div>
                )}
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}
