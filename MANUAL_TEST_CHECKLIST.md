# Manual Hardware Test Checklist

- [ ] **Permissions**: Enable camera shows the prompt; deny → clear error; allow + Retry works.
- [ ] **Selection**: with 2 cameras, both selectable; switching keeps tracking running.
- [ ] **Busy camera**: open the Windows Camera app first → "in use" message; close it → Retry works.
- [ ] **Lighting**: debug overlay (D) shows a stable skeleton; confidence > 80 %.
- [ ] **Calibration**: C → open → pinch → Apply; meter crosses thresholds cleanly.
- [ ] **Summon/dismiss**: palm summons, fist dismisses; repeat 5×, never stuck.
- [ ] **Targeting**: tap each of the 9 icons 3×; ≥ 90 % correct.
- [ ] **Scrolling**: pinch-drag scrolls Facebook/YouTube/Instagram both ways; no accidental taps.
- [ ] **Close/back**: pinch-hold closes an app; swipe goes back; nav-bar buttons work.
- [ ] **Keyboard**: type "Hallo Welt" in WhatsApp; no double letters while resting on a key; Send adds it.
- [ ] **App switching**: open/close different apps 10×; no frozen UI.
- [ ] **Tracking loss**: move hand out of frame mid-pinch → "TRACKING LOST", no click; return → works.
- [ ] **Performance**: D shows ≥ 30 FPS, otherwise try quality low.
- [ ] **Recording**: P, R, 30 s, R, Save; file plays in VLC/Chrome with camera + hologram; mic audio in sync if enabled.
- [ ] **Recovery**: unplug the USB webcam during use → message + Retry; Reload tracking model after changing backend.
