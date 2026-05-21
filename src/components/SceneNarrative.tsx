import React from "react";
import { Scene } from "../types";
import { Film, Milestone } from "lucide-react";

interface SceneNarrativeProps {
  scene: Scene;
  totalScenes: number;
}

export function SceneNarrative({ scene, totalScenes }: SceneNarrativeProps) {
  // Determine color matching the dramatic phase
  const getPhaseStyles = (phase: string) => {
    const p = phase.toLowerCase();
    if (p.includes("esittely")) return "border-blue-500/30 text-blue-400 bg-blue-950/25";
    if (p.includes("kliimaksi") || p.includes("käännekohta")) return "border-red-500/30 text-red-400 bg-red-950/25";
    if (p.includes("kuulustelu") || p.includes("syyte")) return "border-amber-500/30 text-amber-400 bg-amber-950/25";
    if (p.includes("konflikti")) return "border-purple-500/30 text-purple-400 bg-purple-950/25";
    return "border-emerald-500/30 text-emerald-400 bg-emerald-950/25";
  };

  const progressPercent = Math.min(100, Math.round((scene.sceneNumber / totalScenes) * 100));

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 md:p-6 shadow-xl space-y-4 animate-fade-in relative overflow-hidden">
      
      {/* Background radial accent */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-radial from-red-500/5 to-transparent rounded-full pointer-events-none"></div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
        {/* Scene and Title Info */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase font-bold tracking-widest text-zinc-500">
            <Film className="w-3.5 h-3.5 text-red-500" />
            <span>KOHTAUS {scene.sceneNumber} OF {totalScenes}</span>
          </div>
          <h2 className="text-xl md:text-2xl font-mono font-extrabold text-white uppercase tracking-tight">
            {scene.sceneTitle}
          </h2>
        </div>

        {/* Phase Badge & Progress Bar */}
        <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
          <div className={`px-3 py-1 rounded border text-xs font-mono font-bold uppercase ${getPhaseStyles(scene.dramaticArcPhase)}`}>
            Draamavaihe: {scene.dramaticArcPhase}
          </div>
          
          <div className="w-full md:w-48 space-y-1">
            <div className="flex justify-between text-[9px] font-mono text-zinc-500 font-bold uppercase uppercase">
              <span>Railroad pituus</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/60 shadow-inner">
              <div 
                className="h-full bg-gradient-to-r from-red-600 to-amber-500 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Narrative block */}
      <div className="space-y-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-mono tracking-widest uppercase font-bold text-red-500/90 leading-tight">
          <Milestone className="w-3 h-3 animate-pulse" />
          Pelinjohtajan Tilannekuvaus (Lue kovaäänisesti hitaasti):
        </span>
        <blockquote className="border-l-2 border-red-500 pl-4 py-1 text-gray-200 text-sm md:text-base font-sans italic tracking-wide leading-relaxed bg-zinc-950/20 rounded-r">
          "{scene.narrativeIntroduction}"
        </blockquote>
      </div>

    </div>
  );
}
