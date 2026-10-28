# PHANTOM S23 — Interaktives holografisches Smartphone

[🇬🇧 English](README.md) · 🇩🇪 Deutsch

![three.js](https://img.shields.io/badge/three.js-0.169-000?logo=threedotjs)
![MediaPipe](https://img.shields.io/badge/MediaPipe-Hand--Tracking-0097A7?logo=google&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Tests](https://img.shields.io/badge/Tests-60%20Unit%20%2B%2028%20E2E-2ea44f)

Ein holografisches Handy in Echtzeit, **ins Kamerabild eingeblendet**, für die Aufnahme eines Tech-Werbespots: Live-Webcam-Bild + gepunktetes Three.js-Hologramm + MediaPipe-Hand-Tracking + simulierte Apps im Android-Stil + eingebaute Aufnahmefunktion. Alles läuft lokal im Browser: kein Backend, keine API-Schlüssel, keine Cloud-KI, keine Analytics.

> Das ist ein visueller Effekt, der ins Kamerabild eingeblendet wird, kein optisches Hologramm. Das Hologramm steht an einer festen, einstellbaren Bildschirmposition und ist **nicht** an deine Hand oder das echte Handy gekoppelt.

## Voraussetzungen (Windows 10/11)
- Node.js 18+ (LTS empfohlen): `winget install OpenJS.NodeJS.LTS`
- Aktuelles Chrome oder Edge, eine Webcam, Hardwarebeschleunigung im Browser aktiviert.

## Installieren & starten
```powershell
cd mobile
npm install          # kopiert auch die MediaPipe-WASM-Runtime nach public/mediapipe/wasm
npm run setup        # lädt einmalig das Handmodell (7,8 MB) nach public/models/
npm run dev          # öffnet http://localhost:5173
```
Produktion: `npm run build`, dann `npm run preview` (http://localhost:4173). Immer `localhost` verwenden, denn über `file://` funktioniert die Kamera nicht.

| Skript | Zweck |
|---|---|
| `npm test` | Unit-Tests (Vitest): Gesten, Navigation, Tastatur, Nachrichten, Auswahl des Aufnahme-MIME-Typs |
| `npm run build` | Produktions-Build nach `dist/` |
| `npm run test:smoke` | End-to-End-Test im Headless-Browser mit der Fake-Kamera von Chrome (Chrome/Edge muss installiert sein, vorher `build` ausführen) |
| `npm run test:all` | Alles oben zusammen |

## Kameraberechtigung
Auf dem Startbildschirm auf **Enable camera** klicken. Erst dann fragt der Browser nach der Berechtigung. Wurde sie verweigert: auf das Kamerasymbol in der Adressleiste klicken → *Zulassen* → **Retry**. Außerdem *Windows-Einstellungen → Datenschutz → Kamera → Desktop-Apps den Zugriff auf die Kamera erlauben* prüfen. Teams/Zoom/Kamera-App schließen, falls das Gerät belegt ist. Über die Auswahlliste lässt sich die Kamera wechseln.

## Hand-Tracking-Modell (Offline-Nutzung)
- Modell: MediaPipe Hand Landmarker float16 (Apache-2.0), von `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`
- Lokal gespeichert unter `public/models/hand_landmarker.task` (durch `npm run setup`), ausgeliefert als `/models/hand_landmarker.task`.
- WASM-Runtime: kopiert von `node_modules/@mediapipe/tasks-vision/wasm` nach `public/mediapipe/wasm`.
- Nach dem Setup funktioniert die App komplett offline. Fehlt das lokale Modell, wird die Google-URL oben verwendet. Die URL lässt sich unter *Settings → Tracking → Model URL* ändern (danach *Reload tracking model*).
- Kann das Tracking nicht geladen werden, sagt die App das. Sie täuscht nie ein Tracking vor. Der **Demo-Modus** (Startbildschirm) ist deutlich als „simulated input“ gekennzeichnet: Die Maus ersetzt deinen Finger.

## Gesten
| Geste | Aktion |
|---|---|
| Offene Handfläche, ca. 0,7 s ruhig halten | Hologramm aufrufen (wiederholbar) |
| Faust, ca. 1 s halten | Hologramm ausblenden |
| Zeigefinger | Cursor bewegen / Hover |
| Kurzer Pinch mit Daumen und Zeigefinger | Tippen (einmal pro Pinch, entprellt) |
| Pinch und nach oben/unten bewegen | Scrollen (der Inhalt folgt der Hand) |
| Zeige- + Mittelfinger als „V“, nach oben/unten bewegen | Scrollen (optional) |
| Pinch ca. 1,1 s ruhig halten (Ring füllt sich) | App schließen → Startbildschirm |
| Schnelles seitliches Wischen mit offener Hand | Zurück |
| Pinch auf Tastaturtasten | Tippen |

Maus als Ersatz: bewegen = Cursor, Klick = Tippen, Ziehen/Mausrad = Scrollen, langes Drücken = App schließen, Rechtsklick = Zurück.
Tastatur: **H** Hologramm · **P** Präsentation · **R** Aufnahme · **F** Vollbild · **S** Einstellungen · **D** Debug-Overlay · **C** Kalibrierung · **Esc** zurück · **Pos1/Home** App schließen. Ersatz-Buttons (✕ ○ ‹) liegen in der Navigationsleiste des Hologramms.

## Kalibrierung
**C** drücken: eine offene Hand aufnehmen (2 s), dann einen Pinch (2 s), dann *Apply*. Das setzt die Schwellwerte für Pinch-Beginn und -Ende mit Hysterese. **D** zeigt das Hand-Skelett, die Grenzen des Hologramms, eine Pinch-Anzeige, FPS und die Inferenzzeit. Weitere nützliche Einstellungen: *Cursor mapping = zone* (ein bequemer Handbereich wird auf das ganze Hologramm abgebildet), Glättung, Trefferfläche der Tasten, Scroll-Empfindlichkeit.

## Den Werbespot aufnehmen
1. Hologramm platzieren (*Settings → Hologram* oder eine Positionsvorlage). *Recording → Output resolution* einstellen (z. B. 1920×1080).
2. **P** für den Präsentationsmodus (blendet alle Bedienelemente aus; optional kinoartiges Einblenden/Letterbox).
3. **R** → Countdown → Aufnahme. Erneut **R** zum Stoppen (Pause ist über die REC-Anzeige möglich).
4. Vorschau → **Save** lädt die Datei herunter. Ohne diesen Klick wird nichts gespeichert.

Aufgenommen wird das eine WebGL-Canvas, also Kamera + Hologramm + Cursor (der Cursor lässt sich in den Einstellungen ausblenden). Entwickler-Oberfläche und Hinweis-Labels sind HTML und werden nie mit aufgenommen. Den Tab während der Aufnahme sichtbar lassen.

**Formate:** standardmäßig WebM (VP9/VP8, + Opus bei Mikrofonton), läuft in Chrome, Edge, Firefox und VLC. MP4 (H.264) nur, wenn ausgewählt und vom Browser unterstützt. Der Dialog zeigt das tatsächliche Format. Umwandeln mit:
```
ffmpeg -i recording.webm -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac recording.mp4
```

## Facebook
Das eingestellte Profil `https://www.facebook.com/mahmoud.hasan.428535` öffnet sich in einem **normalen Browser-Tab** (Button „Open live profile“ oder *Settings → Open Facebook profile*). Facebook verbietet das Einbetten, deshalb wird es nie eingebettet oder ausgelesen. Im Hologramm wird eine lokale **Präsentationssimulation** gezeigt, deren Name, Bio und Beiträge in `src/config/demoContent.js` bearbeitet werden können. Beiträge tragen eine Markierung „SAMPLE“ (einstellbar). Wird ein per Pinch geöffneter Tab vom Popup-Blocker blockiert, den Link im Einstellungs-Panel nutzen (ein echter Klick) oder Popups für localhost erlauben.

## Fehlerbehebung
- **Schwarzer Bildschirm / „camera in use“**: andere Kamera-Apps schließen, Retry; eine andere Kamera oder geringere Aufnahmeauflösung versuchen.
- **Hand wird nicht erkannt**: mehr Licht von vorn, Gegenlicht vermeiden, Hand 40–80 cm vor der Kamera, Handfläche zur Kamera.
- **Klicks unzuverlässig**: Kalibrierung ausführen; *Max click duration* erhöhen; Zonen-Mapping ausprobieren.
- **Niedrige FPS**: Qualität *low*, Render-Auflösung 0,75, Tracking 20 Hz. Die automatische Qualität regelt selbst herunter.
- **Modell lädt nicht**: `npm run setup`, dann *Reload tracking model*.
- **Spulen in WebM ist in manchen Playern langsam**: `ffmpeg -i in.webm -c copy out.webm` oder in MP4 umwandeln.

## Bekannte Einschränkungen
- Das Hologramm ist an den Bildschirm gebunden, nicht an das echte Handy; keine Verdeckung zwischen Hand und Hologramm.
- Die Gestengenauigkeit hängt von Licht, Kamera und Handhaltung ab; pro Aufbau kalibrieren.
- Die Apps sind Simulationen: keine echten Nachrichten, Anrufe, Facebook-/YouTube-Inhalte oder Videowiedergabe im Hologramm.
- `npm audit` meldet Hinweise nur in den **Entwicklungswerkzeugen** (Vite-Dev-Server/esbuild, Vitest, Proxy-Abhängigkeiten von puppeteer-core); die Produktionsabhängigkeiten melden 0. Der Dev-Server lauscht nur auf localhost.

## Datenschutz & Lizenzen
- Kamerabilder, Hand-Landmarken, Ton und Nachrichten verlassen nie den Browser. Keine Telemetrie. Einstellungen und Demo-Chats liegen im `localStorage`; Aufnahmen der Kamera-App nur im Arbeitsspeicher.
- Kamera und Mikrofon werden erst angefordert, wenn du die Kamera startest bzw. die Tonaufnahme aktivierst.
- Drittanbieter: Three.js (MIT), MediaPipe Tasks Vision + Hand-Landmarker-Modell (Apache-2.0). Alle Icons und Bilder sind eigene, prozedural im Code gezeichnet. App-Namen bezeichnen nur Simulationen; keine Verbindung zu Samsung, Meta, WhatsApp, Google/YouTube oder Instagram.

## Architektur
```
src/app          AppController (Steuerung, Render-Schleife), AppState, Router, HologramStateMachine
src/camera       CameraManager, CameraCompositor (Video → WebGL), videoTransform (gemeinsame Mathematik)
src/tracking     HandTracker (eigene Timer-Schleife), handGeometry, OneEuroFilter, GestureRecognizer, GestureCalibration
src/hologram     HologramScene, HologramScreen, ParticleSystem, HologramShaders, HologramAnimations, CursorOverlay
src/interactions InteractionController, VirtualCursor, ScrollPhysics, HitTesting
src/uicanvas     UIRenderer (Immediate-Mode-Canvas-UI), PhoneUI-Rahmen, Hilfsfunktionen draw/icons/images/chrome
src/apps         Home, Facebook, WhatsApp, YouTube, Instagram, Phone, Messages, Camera, Gallery, Settings, ChatStore
src/keyboard     KeyboardModel (rein), VirtualKeyboard
src/recording    RecordingController, mimeTypes · src/audio SoundEngine · src/ui DOM-Panels · src/config
```
Die Handy-Oberfläche wird auf ein Offscreen-Canvas gezeichnet, das als Textur des Hologramms dient. Deshalb sind die Apps Teil des aufgenommenen Bildes.
