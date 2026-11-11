# SonicVisual Studio

Editor di **visualizer musicali audio-reattivi** che gira interamente nel browser.
Carichi un brano, scegli uno stile, personalizzi testi ed effetti ed esporti un video fino a 4K.
Audio e immagini restano sul tuo computer: nessun file viene caricato su server.

---

## Funzionalità

**10 layout di visualizzazione**, ognuno con le proprie opzioni:

| Layout | Descrizione |
| --- | --- |
| Cerchio | Spettro radiale attorno al logo con 5 forme d'onda: barre, curva fluida, doppio anello, punti neon, picchi a stella |
| Equalizer | Barre dal basso con picchi in caduta, riflesso e modalità LED a segmenti |
| Specchio | Barre simmetriche dal centro, bassi nel mezzo |
| Onda | Oscilloscopio reale (forma d'onda nel tempo) con trigger stabile e tre strati luminosi |
| Laterali | Barre sui bordi sinistro e destro |
| Orizzonte | Spettro liquido a tutta larghezza su due livelli |
| Vinile | Giradischi con solchi, riflessi rotanti, braccio e anello spettrale |
| Cover | Copertina che pulsa con striscia di spettro |
| Minimal | Costellazione discreta per brani acustici |
| Particelle | Nucleo di energia con raggi di luce |

**12 preset integrati** più i tuoi preset personali, salvati nel browser.

**Effetti**: bagliore, ciclo automatico dei colori, flash sul kick, onde d'urto sul beat, aberrazione cromatica sui bassi, grana pellicola, zoom e scossa di camera, parallasse dello sfondo.

**Logo**: cerchio, anello, quadrato o esagono, pulsazione sui bassi, rotazione continua, immagine personalizzabile.

**Particelle**: radiali, verso l'alto o fluttuanti, con spinta sui kick, scintillio e bagliore additivo.

**Testi**: livelli illimitati da trascinare direttamente sull'anteprima, con aggancio al centro. Ognuno ha 6 font, peso, corsivo, maiuscolo, spaziatura, contorno, bagliore neon, ombra e riquadro di sfondo. Animazioni d'ingresso (dissolvenza, scorrimento, ingrandimento) e animazioni durante il brano (pulsazione, fluttuazione, respiro luminoso). Ogni livello si può bloccare, nascondere, duplicare e riordinare.

**Editor**
- Annulla/ripeti con cronologia (Ctrl+Z / Ctrl+Shift+Z).
- Salvataggio automatico nel browser, più salvataggio e apertura di progetti `.sonic`.
- Timeline con forma d'onda del brano, trascinabile per spostarsi.
- Trascina sulla finestra un file audio o un progetto `.sonic` per aprirlo.
- Guide dell'area sicura, vista pulita, anteprima a schermo intero.
- Interfaccia responsive: su schermi piccoli i pannelli diventano cassetti laterali.

**Export video**
- 720p, 1080p, 4K, quadrato 1:1 e verticale 9:16 (Reels/TikTok/Shorts). L'anteprima assume le proporzioni scelte.
- 30 o 60 fps, bitrate regolabile, durata intera / 15s / 30s / 60s / personalizzata, partenza dall'inizio o dalla testina.
- MP4 (H.264) quando il browser lo supporta, altrimenti WebM (VP9).
- Ogni frame è disegnato seguendo il clock dell'audio, quindi immagine e suono restano sincronizzati.

### Scorciatoie da tastiera

| Tasto | Azione |
| --- | --- |
| Spazio | Play / pausa |
| ← / → | Indietro / avanti 5 secondi |
| Home | Torna all'inizio |
| M / L | Muto / ripeti |
| H | Vista pulita |
| F | Anteprima a schermo intero |
| Ctrl+Z / Ctrl+Shift+Z | Annulla / ripeti |
| Canc | Elimina il testo selezionato |
| Ctrl+S / Ctrl+O / Ctrl+E | Salva progetto / apri progetto / esporta video |

---

## Avvio in locale

Requisiti: Node.js 20.19 o superiore, browser recente (Chrome, Edge, Firefox o Safari).

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # controllo dei tipi + build di produzione in dist/
npm run preview  # serve la build
```

## Pubblicazione su GitHub Pages

Il workflow `.github/workflows/deploy.yml` compila e pubblica il sito a ogni push su `main`.
Per attivarlo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
Il sito sarà disponibile su `https://<utente>.github.io/<nome-repository>/`.

## Struttura del codice

```
src/
  audio/          motore Web Audio, analisi a bande con rilevamento dei kick, brani demo sintetizzati
  visualizer/     renderer canvas (indipendente da risoluzione e frame rate), preset, export video
  components/     TopBar, LeftPanel, Stage, Inspector, Transport, ExportDialog
  ui/             controlli condivisi, notifiche, utilità per le immagini
  state/          cronologia annulla/ripeti
```

## Stack

React 19 · TypeScript · Vite 8 · Tailwind CSS 4 · Web Audio API · Canvas 2D · MediaRecorder · Lucide

## Licenza

MIT
