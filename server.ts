import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

// Initialize environment variables from .env
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json());

// Helper to get or lazily initialize the Google GenAI SDK client
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error("GEMINI_API_KEY is not configured. Please add your Gemini API Key in Settings > Secrets.");
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// 1. Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// 2. Archetype Generator
// Generates character roles and secrets based on theme and players
app.post("/api/generate-archetypes", async (req, res) => {
  try {
    const { theme, initialIdea, playerNames } = req.body;
    
    if (!theme || !playerNames || !Array.isArray(playerNames) || playerNames.length === 0) {
      return res.status(400).json({ error: "Teema ja vähintään yksi pelaajan nimi vaaditaan." });
    }

    const ai = getGeminiClient();
    
    const userPrompt = `Luo roolit ja mehukkaat, toisiinsa kietoutuvat salaisuudet seuraaville pelaajille.
Pelin teema: "${theme}"
Alustus/Idea: "${initialIdea || 'Ei erityistä alustusta'}"
Pelaajat: ${playerNames.join(", ")}

Säännöt hahmonluontiin:
- Roolin tulee olla ytimekäs (esim. "Hovimestari", "Laivainsinööri", "Turvamies").
- Salaisuuden tai motiivin tulee olla toiminnallinen ja kytkeytyä muihin pelaajiin (esim. joku on rikollinen/vakooja, joku kantaa pelastuksen avainta, joku epäilee toista, jollakin on murhamotiivi).
- Salaisuudet luovat sosiaalista jännitettä, jotta niistä syntyy larpattavaa peliliikettä ja epäilyksiä.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction: "Olet roolipelien suunnittelija. Luot hahmojen rooleja ja salaisuuksia roolipeliin. Palauta luodut hahmot täsmälleen annetussa JSON-formaatissa.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Pelaajan alkuperäinen nimi" },
              role: { type: Type.STRING, description: "Hahmon ammatti tai rooli" },
              secret: { type: Type.STRING, description: "Hahmon salainen motiivi tai salaisuus pelissä" }
            },
            required: ["name", "role", "secret"]
          }
        }
      }
    });

    const parsedData = JSON.parse(response.text || "[]");
    res.json({ archetypes: parsedData });

  } catch (error: any) {
    console.error("Archetype generation error:", error);
    res.status(500).json({ 
      error: error.message || "Tapahtui virhe hahmojen generoinnissa." 
    });
  }
});

// 3. Next Scene Generator (Full linear game conductor)
app.post("/api/generate-next-scene", async (req, res) => {
  try {
    const { config, history, currentSceneNumber, humanGmNotes } = req.body;

    if (!config || !config.theme || !config.players) {
      return res.status(400).json({ error: "Pelin asetukset puuttuvat." });
    }

    const ai = getGeminiClient();

    // Setup history notes
    let historyPrompt = "";
    if (history && history.length > 0) {
      historyPrompt = history.map((scene: any) => {
        return `Kohtaus ${scene.sceneNumber}: "${scene.sceneTitle}" (${scene.dramaticArcPhase})
- Alustus: ${scene.narrativeIntroduction}
- Pelaajien toimintaohjeet:
${scene.playerTasks.map((t: any) => `   * ${t.characterName} (Rooli: ${t.concreteActionCategory}): ${t.instructionPrompt}`).join("\n")}
- PJ:n huomiot ja tapahtumat realielämässä: ${scene.humanGmNotesFeedback || "Ei huomioita"}`;
      }).join("\n\n");
    } else {
      historyPrompt = "Peli on vasta alkamassa. Ei aiempaa historiaa.";
    }

    const totalScenes = config.totalScenes || 5;
    const isLastScene = currentSceneNumber >= totalScenes;

    const systemInstruction = `Olet rautaisen junailtu ("railroaded") roolipelinjohtaja ja tarinan orkestroija.
Tehtäväsi on ohjata pelaajaryhmää lineaarisen ja tiukan draamallisen kaaren halki. Pelissä on yhteensä ${totalScenes} kohtausta.
Sinun tulee luoda KOHTAUS numero ${currentSceneNumber}.

Draaman kaaren vaiheiden ohjeistus:
- Vaihe ${currentSceneNumber}/${totalScenes}.
- Jos ${currentSceneNumber} === 1: ESITTELY. Esitellään roolit, viratellään pieniä sosiaalisia kontakteja ja motiiveja. Pelaajille annetaan kevyitä itsenäisiä selvitys- tai ele-tehtäviä.
- Jos ${currentSceneNumber} on keskivaiheilla (esim 2 tai 3) ja ${totalScenes} > 3: KONFLIKTI SYVENEE. Sosiaalinen paine kasvaa, salaisuudet vuotavat tai niitä kiristetään.
- Jos tämä on KLIIMAKSI (kohtaus ${Math.max(2, totalScenes - 1)} tai ${totalScenes - 1}): TAPAHTUU ISO KONKREETTINEN VÄLITÖN TAPAHTUMA (esim. murha tapahtuu, siirtoleiri sabotoidaan, virustartunta leviää, timantti varastetaan).
  * HUOMIO KLIIMAKSISTA: Anna vain yhdelle tai kahdelle sopivalle pelaajalle eksplisiittinen fyysinen tai konkreettinen toimintaohje tehdä kyseinen isku tai teko realielämässä. Muille pelaajille annetaan tehtäväksi havaita, tarkkailla tai vahtia tilannetta, mikä synnyttää sosiaalisen ja jännittävän emergentin hetken siitä, kuka ehtii toimia ensin.
- Jos tämä on KAUKALOKUULUSTELU/SELVITYS (kohtaus ${totalScenes}): RATKAISUN SHOWDOWN TAI KUULUSTELU. Pelaajat saavat kukin ohjeet joko paljastaa totuutensa, syyttää tiettyä henkilöä (joka herättää epäilyksen), tai pelastaa nahkansa valehtelemalla tietyllä taktiikalla.

Säännöt ja sielunelämä:
1. Älä kuvaile pelimaailmaa turhaan taustalla. Junailtu (railroaded) peli tarkoittaa, että luot pelkät dramaturgiset puitteet ja suorat tehtävät ("prompts") pelaajille.
2. Jokaiselle pelaajalle on annettava selkeä, ymmärrettävä ja suoritettava mikro-tehtävä tässä kohtauksessa samanaikaisesti.
3. Taksonomiat toiminnolle:
   - Sosiaalinen tyyli: "Kysyvä" (kysymyksiä jostakin salaisuudesta), "Toteava" (tuo esiin fakta tai teeskennelty totuus), "Selvittävä" (tutkii toista tai jotakin esinettä), "Tavoitteleva" (vaatii selityksiä tai lupauksia).
   - Fyysinen toteutus: "Monologi" (puhuu yksin ääneen tilanteesta), "Matkiminen" (matkii toista pelaajaa kehonkielellä), "Dialogi" (ottaa tietyn kohteen kahdenkeskiseen puheeseen), "Fyysinen ele" (tekee eleen kuten hermostunut pyöriminen, tuijotus), "Siirtyminen" (vaihtaa paikkaa huoneessa), "Esineen kanssa toimiminen" (koskee, tutkii tai piilottaa jotain kuvitteellista tai todellista esinettä).
4. Ota ehdottomasti huomioon pelaajien elossaolo tai status! Jos pelaaja on merkitty kuolleeksi (isDead tai ilmoitettu kuolleeksi PJ:n huomioissa), kytke hänen ohjeensa siihen (esim. 'Esitä kuollutta maassa', 'Toimi haamuna ja kuiskaa yksi sana epäillylle', tai 'Pelaaja on eliminoitu pelistä, ei aktiivista ohjetta'). Älä anna kuolleelle hahmolle normaaleja haku- tai puhetehtäviä.
5. Varmista, että eri pelaajien ohjeet kohtaavat toisensa: esim. Pelaaja A:n ohje on tarkkailla salaa Pelaaja B:tä, ja Pelaaja B:n ohje on hermostuneesti koskea taskuunsa piilotettua asetta, kun taas Pelaaja C:n ohje on kysyä Pelaaja B:ltä mitä hän piilottelee. Tämä luo upean koordinoidun draaman!`;

    const userPrompt = `Luo peliin seuraava kohtaus (Kohtaus ${currentSceneNumber}/${totalScenes}) huomioiden pelin asetukset, tähänastinen pelihistoria ja pelinjohtajan tuoreet reaaliaikaiset huomiot.

Pelin perustiedot:
Teema: "${config.theme}"
Idea/Premissi: "${config.initialIdea}"
Pelaajahahmot (nimi, rooli, salaisuus, onko kuollut):
${config.players.map((p: any) => `- ${p.name} (Rooli: ${p.role}, Salaisuus: ${p.secret}, Kuollut: ${p.isDead ? 'Kyllä' : 'Ei'})`).join("\n")}

Pelitilanteen reaaliaikaiset PJ-huomiot tältä hetkeltä:
"${humanGmNotes || 'Ei uusia huomioita ihmis-pelinjohtajalta.'}"

Tähänastinen pelihistoria:
${historyPrompt}

Luo nyt KOHTAUS ${currentSceneNumber} ja palauta se täsmällisessä JSON-muodossa.`;

    const playerTaskSchema = {
      type: Type.OBJECT,
      properties: {
        characterName: { type: Type.STRING, description: "Pelaajan tarkka nimi" },
        socialActionCategory: { 
          type: Type.STRING, 
          description: "Minkä tyyppinen sosiaalinen asenne otetaan: 'Kysyvä', 'Toteava', 'Selvittävä', 'Tavoitteleva'" 
        },
        concreteActionCategory: { 
          type: Type.STRING, 
          description: "Miten se tehdään konkreettisesti: 'Monologi', 'Matkiminen', 'Dialogi', 'Fyysinen ele', 'Siirtyminen', 'Esineen kanssa toimiminen'" 
        },
        targetCharacter: { 
          type: Type.STRING, 
          description: "Kehen toiminta kohdistuu (toinen pelaaja tai 'Kaikki')" 
        },
        instructionPrompt: { 
          type: Type.STRING, 
          description: "Yksityiskohtainen ja todella selkeä ohje pelaajalle, mitä hänen pitää sanoa tai tehdä realielämässä juuri nyt." 
        },
        gamePurpose: { 
          type: Type.STRING, 
          description: "Miksi tämä ohje annetaan, mikä on draamallinen jännite tässä takana." 
        }
      },
      required: ["characterName", "socialActionCategory", "concreteActionCategory", "targetCharacter", "instructionPrompt", "gamePurpose"]
    };

    const sceneSchema = {
      type: Type.OBJECT,
      properties: {
        sceneNumber: { type: Type.INTEGER },
        sceneTitle: { type: Type.STRING },
        narrativeIntroduction: { type: Type.STRING, description: "Lyhyt ja ytimekäs pelinjohtajan juonellinen alustus (1-3 lausetta) luettavaksi ääneen." },
        dramaticArcPhase: { type: Type.STRING, description: "Esittely, Konfliktin herääminen, Käännekohta/Kliimaksi, Kuulustelu, tai Ratkaisu" },
        playerTasks: {
          type: Type.ARRAY,
          items: playerTaskSchema,
          description: "Tehtävä JOKAISELLE pelissä mukana olevalle hahmolle."
        }
      },
      required: ["sceneNumber", "sceneTitle", "narrativeIntroduction", "dramaticArcPhase", "playerTasks"]
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: sceneSchema
      }
    });

    const parsedScene = JSON.parse(response.text || "{}");
    res.json({ scene: parsedScene });

  } catch (error: any) {
    console.error("Scene generation error:", error);
    res.status(500).json({ 
      error: error.message || "Tapahtui virhe uuden kohtauksen generoinnissa." 
    });
  }
});

// 4. End Game Story Wrap Up
app.post("/api/generate-epilogue", async (req, res) => {
  try {
    const { config, history, humanGmNotes } = req.body;

    if (!config || !config.players) {
      return res.status(400).json({ error: "Pelin tiedot puuttuvat." });
    }

    const ai = getGeminiClient();

    let historyPrompt = history.map((scene: any) => {
      return `Kohtaus ${scene.sceneNumber}: "${scene.sceneTitle}"
- Alustus: ${scene.narrativeIntroduction}
- PJ:n huomiot lopputuloksesta: ${scene.humanGmNotesFeedback || "Ei huomioita"}`;
    }).join("\n\n");

    const userPrompt = `Kirjoita upea loppuepilogi / loppuratkaisu pelillemme!
Pelin teema: "${config.theme}"
Idea/Premissi: "${config.initialIdea}"
Pelaajahahmot:
${config.players.map((p: any) => `- ${p.name} (Rooli: ${p.role}, Salaisuus: ${p.secret}, Kuollut: ${p.isDead ? 'Kyllä' : 'Ei'})`).join("\n")}

Reaaliaikaiset viimeisen kohtauksen tapahtumat ja loppuhuomiot ihmis-pelinjohtajalta:
"${humanGmNotes || 'Ei uusia loppuhuomioita.'}"

Pelin kulku tähän saakka:
${historyPrompt}

Säännöt loppuratkaisun luomiselle:
- Kirjoita 2-3 erittäin iskevää ja dramaattista kappaletta suomeksi, jotka vetävät yhteen kuka selvisi voittajana, kuka paljastui tai epäonnistui, miten mysteeri/konflikti ratkesi, ja mikä oli kunkin hahmon lopullinen kohtalo tarinan kannalta.
- Pidä sävy peliteemaan sopivana (esim. synkkä murhamysteereissä, sankarillinen fantasiassa, kylmä ja teknologinen avaruusseikkailuissa).
- Palauta tulos JSON-objektina, jossa on kenttä 'epilogue' (string) ja 'wasCorrectlySolved' (boolean tai string, joka kuvailee ratkaisun tilannetta lyhyesti).`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction: "Olet arvostettu tarinankertoja ja roolipelien kirjoittaja. Luot upean lineaarisen tiiviin loppuepilogin suomeksi, joka kunnioittaa kaikkea pelattua historiaa.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            epilogue: { type: Type.STRING, description: "Pelin lopullinen tarinallinen yhteenveto ja loppuratkaisu" },
            wasCorrectlySolved: { type: Type.STRING, description: "Lyhyt (1 lause) yhteenveto siitä, miten ryhmä suoriutui sosiaalisesta päättelystään" }
          },
          required: ["epilogue", "wasCorrectlySolved"]
        }
      }
    });

    const parsedData = JSON.parse(response.text || "{}");
    res.json(parsedData);

  } catch (error: any) {
    console.error("Epilogue generation error:", error);
    res.status(500).json({ 
      error: error.message || "Tapahtui virhe loppuepilogin generoinnissa." 
    });
  }
});


// Serve static files in production / development setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static frontend assets from /dist
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Rautatie Server] running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
