# Rautatie Draamamoottori - local Ollama test

Tama on yhden ruudun Elopeli/Rautatie-testiversio. Tarkoitus on ajaa appi ja Ollama samalla koneella, jotta Raspberryn, selaimen ja eri koneella pyorivan Ollaman valinen verkkosaato ja instanssiepaily saadaan pois testista.

## Vaatimukset

- Node.js
- Ollama
- Vahintaan yksi ladattu Ollama-malli

Tarkista mallit:

```bash
ollama list
```

Jos mallia ei ole:

```bash
ollama pull gemma3:4b
```

## Kaynnistys

1. Pura zip.
2. Avaa terminaali puretussa kansiossa.
3. Asenna riippuvuudet:

```bash
npm install
```

4. Kaynnista appi:

```bash
npm run dev
```

5. Avaa selaimessa:

```text
http://localhost:3000
```

6. Appissa Ollama URL:

```text
http://localhost:11434
```

Jos mallilista ei nay, kirjoita mallin nimi kasin samassa muodossa kuin `ollama list` nayttaa, esimerkiksi:

```text
gemma3:4b
```

## Jos Ollama on jo kaynnissa vaaralla tavalla

Linuxissa systemd-palvelu:

```bash
sudo systemctl stop ollama
OLLAMA_ORIGINS="http://localhost:3000" ollama serve
```

Windowsissa sulje Ollama tray/app tai task managerista `ollama.exe`, sitten PowerShellissa:

```powershell
$env:OLLAMA_ORIGINS="http://localhost:3000"
ollama serve
```

Taman paikallisen testin pitaisi toimia ilman erillista origin-saatoa, jos Ollama sallii localhost-originin oletuksena. Jos selain antaa CORS-virheen, kaynnista Ollama ylla olevalla `OLLAMA_ORIGINS`-asetuksella.

## Build

Tarkistus:

```bash
npm run lint
npm run build
```

Buildin jalkeen tuotantokaynnistys:

```bash
NODE_ENV=production npm start
```
