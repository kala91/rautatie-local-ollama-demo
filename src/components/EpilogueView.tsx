import React from "react";
import { GameConfig, Scene } from "../types";
import { Trophy, HelpCircle, RefreshCw, Star, Swords, Award } from "lucide-react";

interface EpilogueViewProps {
  config: GameConfig;
  history: Scene[];
  epilogueText: string;
  judgmentText: string;
  onResetGame: () => void;
}

export function EpilogueView({
  config,
  history,
  epilogueText,
  judgmentText,
  onResetGame
}: EpilogueViewProps) {
  
  // Quick count of casualties
  const deadCount = config.players.filter(p => p.isDead).length;
  const aliveCount = config.players.length - deadCount;

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in p-2 md:p-6 pb-20 leading-relaxed">
      
      {/* Epic Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-950/40 border border-red-500/30 text-red-500 rounded-full mb-2">
          <Award className="w-10 h-10 animate-pulse text-amber-500" />
        </div>
        <h1 className="text-3xl md:text-5xl font-mono tracking-tight text-white font-extrabold uppercase pb-2 border-b border-zinc-800">
          TARINAN EPILOGI & RATKAISU
        </h1>
        <p className="text-red-400 font-mono text-xs uppercase font-bold tracking-widest">
          {config.theme} • {history.length} KOHTAUSTA PÄÄTTYNYT
        </p>
      </div>

      {/* Main epilogue story card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 md:p-8 shadow-2xl relative overflow-hidden space-y-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-radial from-amber-500/5 to-transparent rounded-full pointer-events-none"></div>

        <div className="space-y-4">
          <h3 className="text-sm font-mono tracking-wider font-extrabold text-amber-500 uppercase flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            Miten tilanne lopulta ratkesi?
          </h3>
          <div className="text-gray-100 text-sm md:text-base font-sans leading-relaxed whitespace-pre-wrap tracking-wide border-l-2 border-amber-500 pl-4 py-2 bg-zinc-950/20 rounded-r">
            {epilogueText || "Palvelunjohtaja kirjoittaa lopputarinaa..." }
          </div>
        </div>

        {/* Action Performance Judgement */}
        {judgmentText && (
          <div className="p-4 bg-zinc-950/50 border border-zinc-805 rounded-lg space-y-2">
            <span className="text-[10px] font-mono uppercase text-zinc-500 block font-bold">Draamallinen tuomio & Tulokset:</span>
            <p className="text-xs text-zinc-300 font-semibold italic">
              "{judgmentText}"
            </p>
          </div>
        )}

        {/* Casualty stats */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-850">
          <div className="p-3 bg-zinc-950/30 rounded text-center border border-zinc-900">
            <span className="text-[10px] font-mono uppercase text-zinc-500 block">Selviytyneet larpit</span>
            <span className="text-xl font-mono font-bold text-emerald-400">{aliveCount}</span>
          </div>
          <div className="p-3 bg-zinc-950/30 rounded text-center border border-zinc-900">
            <span className="text-[10px] font-mono uppercase text-zinc-500 block">Uhriluku / Eliminoituneet</span>
            <span className="text-xl font-mono font-bold text-red-500">{deadCount}</span>
          </div>
        </div>
      </div>

      {/* Characters list & their ultimate status */}
      <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-5 space-y-4 shadow-xl">
        <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-zinc-400 border-b border-zinc-800 pb-2 flex items-center gap-1.5">
          <Swords className="w-4 h-4 text-zinc-500" />
          Hahmojen lopullinen tila ja salatut motiivit
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {config.players.map((p) => (
            <div key={p.id} className="p-4 bg-zinc-950/50 border border-zinc-850 rounded-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-1.5 border-b border-zinc-900 mb-2">
                  <span className="text-xs font-mono font-extrabold text-white tracking-wide">{p.name}</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase font-bold border ${
                    p.isDead 
                      ? "border-red-500/20 text-red-400 bg-red-950/20" 
                      : "border-emerald-500/20 text-emerald-400 bg-emerald-950/20"
                  }`}>
                    {p.isDead ? `Menehtyi (Kohtaus ${p.deathScene || '?'})` : "Selvisi Elossa"}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 font-sans block">
                  Alkuperäinen rooli: <span className="text-gray-300 font-medium">{p.role}</span>
                </p>
              </div>

              <div className="mt-2 text-[11px] text-amber-300/80 font-sans leading-relaxed pt-1.5 border-t border-zinc-900">
                <span className="text-[9px] font-mono text-amber-600 uppercase font-bold block mb-0.5">Taka-ajatus / Salaisuus:</span>
                "{p.secret}"
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Restart controls */}
      <div className="flex justify-center pt-2">
        <button
          onClick={onResetGame}
          className="py-3.5 px-8 rounded-lg bg-red-650 hover:bg-red-500 border border-red-500/10 text-white font-mono uppercase font-bold text-xs tracking-wider flex items-center gap-2 transition duration-300 shadow-xl shadow-red-950/30"
        >
          <RefreshCw className="w-4 h-4 text-white" />
          Aloita uusi dramaturgiapeli!
        </button>
      </div>

    </div>
  );
}
