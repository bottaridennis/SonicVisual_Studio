# SonicVusual Studio 🎵✨

> **Professional Web Audio Reactive Music Visualizer & Video Generator**  
> Ispirato ai video musicali in stile Trap Nation con 10 modalità di layout, editing tipografico avanzato, fisica particellare in tempo reale ed esportazione video Full HD & 4K sincronizzata.

---

## 🌟 Funzionalità Principali

- **10 Stili di Layout del Visualizzatore**:
  1. **Cerchio centrale classico**: spettro circolare attorno al logo centrale con protezione anti-deformazione.
  2. **Barre dal basso (Studio Equalizer)**: equalizzatore verticale che sale dal fondo dello schermo.
  3. **Barre specchiate**: barre simmetriche specchiate dall'asse orizzontale.
  4. **Waveform orizzontale**: onda audio continua lineare posizionabile in alto, al centro o in basso.
  5. **Barre laterali (Stereo Channels)**: visualizzatore disposto sui bordi laterali dello schermo.
  6. **Visualizzatore full width**: spettro fluido a tutta larghezza con picchi luminosi.
  7. **Modalità giradischi (Vinyl Turntable)**: disco in vinile realistico animato che ruota durante il playback con riflessi e rim glow.
  8. **Modalità album art pulse**: artwork quadrato fluttuante con drop shadow e pulsazione ritmica al basso.
  9. **Modalità minimal**: costellazione discreta e raffinata per brani acustici e chill.
  10. **Modalità solo particelle**: nucleo energetico e tempesta di particelle cosmiche senza barre invasive.

- **Contenimento Grafico & Anti-Deformazione**:
  - Blocco colature inferiori (*Prevent Downward Bleed*).
  - Limitatore altezza massima (*Clamp*) per evitare sovrapposizioni con testi.
  - Distanza regolabile dai margini dello schermo.

- **Editor Tipografico & Testi nel Video**:
  - Livelli illimitati: Titolo, Artista, Watermark, Sottotitoli.
  - **Trascina direttamente i testi sull'anteprima** (*Interactive Canvas Drag & Drop*).
  - Font professionali inclusi: *Outfit*, *Montserrat*, *Oswald*, *JetBrains Mono*, *Cinzel*, *Bricolage Grotesque*.
  - Dimensione, colore, opacità, allineamento, grassetto, corsivo e spaziatura (*letter spacing*).
  - Effetti neon glow, ombre profonde e box/sfondo di contrasto con bordi arrotondati.
  - Animazioni audio reattive: *Bass Pulse*, *Gentle Float*, *Glow Breath*.
  - Duplicazione, blocco posizione (*Lock*) e visibilità per ciascun testo.

- **Fisica Particellare Dinamica**:
  - Modalità di dispersione: Radiale (dal centro), Verso l'alto, Fluttuazione cosmica.
  - Reazione d'urto sui colpi di cassa sub-bass 808.
  - Effetto scintillio (*Sparkle twinkle*) e neon glow.

- **Preset & Salvataggio**:
  - 10 preset pronti all'uso per ogni stile di visualizzazione.
  - Salvataggio di **Preset Personalizzati** in memoria locale (*localStorage*).

- **Esportazione Video Broadcast (Full HD & 4K)**:
  - Risoluzioni: **1080p Full HD** ($1920\times1080$), **4K Ultra HD** ($3840\times2160$), **720p HD**, **1:1 Quadrato** ($1080\times1080$).
  - Frame rate a 60 FPS o 30 FPS.
  - Formati: **MP4** (H.264/AAC nativo) con alternativa **WebM** ad alto bitrate.
  - Traccia audio originale perfettamente sincronizzata frame-by-frame via Web Audio API.

- **100% Client-Side**:
  - Tutti i calcoli audio, rendering canvas ed esportazioni avvengono direttamente nel browser dell'utente.
  - Nessun dato o file audio viene inviato a server esterni (totale privacy e compatibilità istantanea con GitHub Pages).

---

## 🚀 Requisiti di Sistema

- **Node.js**: versione `20.x` o superiore
- **npm**: versione `10.x` o superiore
- Browser moderno con supporto Web Audio API e MediaRecorder (Chrome, Edge, Firefox, Safari)

---

## 💻 Installazione e Avvio in Locale

1. **Clona il repository**:
   ```bash
   git clone https://github.com/NOME-UTENTE/SonicVusual_Studio.git
   cd SonicVusual_Studio
   ```

2. **Installa le dipendenze**:
   ```bash
   npm install
   ```

3. **Avvia il server di sviluppo locale**:
   ```bash
   npm run dev
   ```
   L'applicazione sarà accessibile all'indirizzo `http://localhost:3000`.

4. **Compila per la produzione**:
   ```bash
   npm run build
   ```

---

## 📦 Pubblicazione su GitHub Pages (tramite GitHub Actions)

Il progetto include già il workflow ufficiale GitHub Actions configurato nel file:
`.github/workflows/deploy.yml`

### Istruzioni passo-passo per pubblicare:

1. **Crea un nuovo repository su GitHub**:
   - Accedi a GitHub e crea un repository pubblico chiamato esattamente:  
     `SonicVusual_Studio`

2. **Collega il repository locale e fai il push del codice**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit - SonicVusual Studio"
   git branch -M main
   git remote add origin https://github.com/NOME-UTENTE/SonicVusual_Studio.git
   git push -u origin main
   ```
   *(Sostituisci `NOME-UTENTE` con il tuo effettivo username GitHub)*

3. **Attiva GitHub Pages dalle impostazioni del repository**:
   - Sul tuo repository GitHub, vai su **Settings** > **Pages** (nel menu laterale).
   - Sotto la voce **Build and deployment**, nel menu a tendina **Source**, seleziona:  
     👉 **GitHub Actions**
   - Non serve selezionare branch o cartelle: l'azione farà tutto in automatico!

4. **Verifica il deploy automatico**:
   - Vai nella scheda **Actions** del tuo repository su GitHub.
   - Vedrai il workflow **Deploy to GitHub Pages** in esecuzione.
   - Al termine (circa 1 minuto), il tuo sito sarà online e accessibile all'indirizzo:  
     👉 `https://NOME-UTENTE.github.io/SonicVusual_Studio/`

---

## 🛠️ Stack Tecnologico

- **Frontend**: React 19, TypeScript
- **Bundler & Tooling**: Vite 8
- **Styling**: Tailwind CSS
- **Audio & Visual**: Web Audio API (`AudioContext`, `AnalyserNode`, `OfflineAudioContext`), Canvas 2D API
- **Video Rendering**: `MediaRecorder`, `canvas.captureStream`, `MediaStreamAudioDestinationNode`
- **Icone & Tipografia**: Lucide React, Google Fonts

---

## 📄 Licenza

Rilasciato sotto licenza MIT.
