import React, { useState } from "react";
import { Scene } from "../types";
import { History, ChevronDown, ChevronUp, BookOpen, Flag } from "lucide-react";

interface DramaturgicalLogProps {
  history: Scene[];
}

export function DramaturgicalLog({ history }: DramaturgicalLogProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!history || history.length === 0) {
    return null;
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-md animate-fade-in">
      
      {/* Accordion trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 bg-zinc-950/40 hover:bg-zinc-950/80 transition flex items-center justify-between text-left cursor-pointer"
      >
        <div className="flex items-center space-x-2 text-white font-mono font-bold text-xs uppercase tracking-wider">
          <History className="w-4 h-4 text-zinc-500 animate-spin-slow" />
          <span>Aikaisemmat Kohtaukset & Tapahtumahistoria ({history.length})</span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-500 font-mono uppercase">Katso lokikirjaa</span>
          {isOpen ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
        </div>
      </button>

      {/* Accordion content */}
      {isOpen && (
        <div className="p-4 md:p-6 bg-zinc-950/20 border-t border-zinc-850 space-y-4 max-h-[350px] overflow-y-auto divide-y divide-zinc-850 animate-slide-down">
          {history.map((scene, index) => (
            <div key={index} className="pt-4 first:pt-0 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-mono font-bold text-white uppercase tracking-tight flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded bg-zinc-800 text-zinc-400 border border-zinc-700 text-[10px] flex items-center justify-center font-bold">
                    {scene.sceneNumber}
                  </span>
                  {scene.sceneTitle}
                </span>

                <span className="px-2 py-0.5 rounded border border-zinc-800 bg-zinc-950 text-zinc-400 text-[9px] font-mono uppercase font-semibold">
                  {scene.dramaticArcPhase}
                </span>
              </div>

              {/* Narrative read out */}
              <div className="text-xs text-gray-300 font-sans italic leading-relaxed border-l-2 border-zinc-700 pl-3">
                "{scene.narrativeIntroduction}"
              </div>

              {/* Real life occurrences recorded */}
              {scene.humanGmNotesFeedback && (
                <div className="text-[11px] text-red-400 bg-red-950/10 border border-red-500/10 rounded p-2 flex items-start gap-1.5 font-sans leading-relaxed">
                  <Flag className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[9px] font-mono uppercase tracking-wider text-red-500 block">Pelinjohtajan Havainnot:</strong>
                    {scene.humanGmNotesFeedback}
                  </div>
                </div>
              )}

              {/* Mini task descriptions for debugging/recap */}
              <div className="mt-2 text-[10px] font-mono text-zinc-500 uppercase">
                <details className="cursor-pointer group">
                  <summary className="hover:text-zinc-400 transition select-none flex items-center gap-1">
                    <span>Näytä annetut toimintaohjeet</span>
                  </summary>
                  <ul className="mt-2 space-y-1 bg-zinc-950/40 p-2 rounded border border-zinc-900/60 font-sans normal-case text-xs text-gray-400">
                    {scene.playerTasks.map((task, pIdx) => (
                      <li key={pIdx} className="leading-relaxed">
                        <strong className="text-zinc-500 font-mono text-[10px]">{task.characterName}:</strong> {task.instructionPrompt}
                      </li>
                    ))}
                  </ul>
                </details>
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
}
