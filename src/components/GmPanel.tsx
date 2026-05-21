import React, { useState } from "react";
import { Player, Scene } from "../types";
import { Eye, EyeOff, ShieldAlert, Skull, ArrowRight, Save, History, Users, RefreshCw } from "lucide-react";

interface GmPanelProps {
  players: Player[];
  currentScene: Scene;
  isGmView: boolean;
  onToggleViewMode: () => void;
  onUpdatePlayers: (updatedPlayers: Player[]) => void;
  onGenerateNextScene: (humanNotes: string) => void;
  isGenerating: boolean;
  sceneCountHistory: number;
}

export function GmPanel({
  players,
  currentScene,
  isGmView,
  onToggleViewMode,
  onUpdatePlayers,
  onGenerateNextScene,
  isGenerating,
  sceneCountHistory
}: GmPanelProps) {
  const [gmNotes, setGmNotes] = useState("");

  const handleMarkDeadToggle = (playerId: string) => {
    const updated = players.map(p => {
      if (p.id === playerId) {
        const nextState = !p.isDead;
        return {
          ...p,
          isDead: nextState,
          deathScene: nextState ? currentScene.sceneNumber : undefined
        };
      }
      return p;
    });
    onUpdatePlayers(updated);
  };

  const handleSubmitScene = () => {
    onGenerateNextScene(gmNotes);
    setGmNotes(""); // reset prompt after submitting
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 md:p-6 shadow-2xl space-y-6 animate-fade-in border-l-4 border-l-red-600/60 leading-relaxed">
      
      {/* Header with View mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-red-400 font-mono font-extrabold uppercase">
            <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
            <span>Ihmis-Pelinjohtajan Ohjauspaneeli</span>
          </div>
          <h3 className="text-base font-bold font-mono text-white uppercase">
            {isGmView ? "🔒 PELINJOHTAJAN NÄKYMÄ (Salaisuudet Näkyvillä)" : "👁️ PELAAJANÄKYMÄ (Kaikki piilotettu)"}
          </h3>
        </div>

        {/* View togglers */}
        <button
          onClick={onToggleViewMode}
          className={`px-4 py-2 rounded-lg font-mono text-xs uppercase font-bold border transition flex items-center gap-2 ${
            isGmView 
              ? "border-red-500/40 bg-red-950/20 text-red-400 hover:bg-red-500/10" 
              : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200"
          }`}
          title="Vaihda esitys- ja ohjausnäkymän välillä"
        >
          {isGmView ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {isGmView ? "Piilota PJ-Hallinta (Pelaajille)" : "Näytä PJ-Hallinta"}
        </button>
      </div>

      {/* Conditionally hide the actual controls if the GM is sharing the screen */}
      {isGmView ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 animate-fade-in">
          
          {/* Column 1: Player roster health manager */}
          <div className="md:col-span-5 bg-zinc-950/40 border border-zinc-850 p-4 rounded-lg space-y-4 shadow-inner">
            <h4 className="text-xs font-mono font-bold tracking-wider uppercase text-zinc-400 flex items-center gap-2 pb-2 border-b border-zinc-850">
              <Users className="w-4 h-4 text-zinc-500" />
              Tapahtumat & Hahmojen tila
            </h4>
            <p className="text-[11px] text-zinc-500 font-sans">
              Jos joku hahmoista murhataan oikeassa elämässä (esim. kliimaksikohtauksessa) tai eliminoidaan, merkitse hänet alta kuolleeksi. Tekoäly PJ poistaa hänet aktiivisesta draamasta.
            </p>

            <div className="space-y-2">
              {players.map((p) => (
                <div 
                  key={p.id} 
                  className="flex items-center justify-between p-2 rounded bg-zinc-900 border border-zinc-850/80 hover:border-zinc-800 transition text-xs"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-gray-200">{p.name}</span>
                    <span className="text-[10px] text-red-400 font-sans block">{p.role}</span>
                  </div>

                  <button
                    onClick={() => handleMarkDeadToggle(p.id)}
                    className={`px-2.5 py-1 rounded text-[10px] font-mono font-semibold transition flex items-center gap-1.5 border uppercase ${
                      p.isDead 
                        ? "border-red-500/30 bg-red-950/30 text-red-400" 
                        : "border-zinc-850 bg-zinc-950 text-zinc-500 hover:text-zinc-400 hover:border-zinc-800"
                    }`}
                  >
                    <Skull className="w-3.5 h-3.5" />
                    {p.isDead ? "Kuollut" : "Elossa"}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Column 2: Reporting real-world actions for context */}
          <div className="md:col-span-7 bg-zinc-950/40 border border-zinc-850 p-4 rounded-lg space-y-4 shadow-inner flex flex-col justify-between">
            <div className="space-y-3">
              <h4 className="text-xs font-mono font-bold tracking-wider uppercase text-zinc-400 flex items-center gap-2 pb-2 border-b border-zinc-850">
                <History className="w-4 h-4 text-zinc-500" />
                Mitä oikeasti tapahtui? (PJ:n raportti tekoälylle)
              </h4>
              
              <label className="block text-[10px] text-zinc-500 font-mono uppercase">
                Kirjoita lyhyt kuvaus tositapahtumista ja tuloksista (valinnainen):
              </label>
              
              <textarea
                rows={3}
                placeholder="Esim. 'Sofia epäonnistui ja Matias poimi esineen jota Thomas vahti.' tai 'Sofia paljasti salaisuutensa muille dramaattisesti.' tai 'Kaikki epäilevät Sofiaa varkaaksi.'"
                value={gmNotes}
                onChange={(e) => setGmNotes(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-850 rounded p-2.5 text-xs text-white focus:outline-none focus:border-red-500/50 font-sans leading-relaxed resize-none"
              />
              <p className="text-[10.5px] text-zinc-500 leading-tight">
                Tämä teksti lisätään tekoälyn pitkäkestoiseen tarinakontekstiin, joten peli säilyttää tarkan lineaarisuuden ja muistaa miten pelaajat oikeasti suoriutuivat.
              </p>
            </div>

            {/* Next iteration action trigger */}
            <div className="pt-3 border-t border-zinc-850 flex items-center justify-between">
              <span className="text-[10px] font-mono text-zinc-600">
                Lopetus pyydetään automaattisesti viimeisessä kohtauksessa.
              </span>

              <button
                type="button"
                onClick={handleSubmitScene}
                disabled={isGenerating}
                className={`py-2 px-5 rounded font-mono text-xs font-bold uppercase border flex items-center gap-1.5 transition-all duration-300 ${
                  isGenerating 
                    ? "bg-zinc-950 border-zinc-850 text-zinc-500 cursor-not-allowed" 
                    : "bg-red-600 hover:bg-red-500 text-white border-red-500/10 shadow-lg shadow-red-950/20 animate-pulse hover:animate-none cursor-pointer"
                }`}
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Tehdään junaa...
                  </>
                ) : (
                  <>
                    Generoi Seurava Kohtaus
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

          </div>

        </div>
      ) : (
        <div className="p-4 bg-zinc-950/40 border border-zinc-800 rounded-lg text-center font-mono text-xs text-zinc-500">
          🔒 Pelinjohtajan ohjaukset on piilotettu turvallisesti, jotta pelaajat voivat katsoa tätä ruutua. <br />
          Saat kaiken näkyviin painamalla ylhäältä <strong>"Näytä PJ-Hallinta"</strong> -nappia.
        </div>
      )}

    </div>
  );
}
