# Porting TmDrake Fire

This game is **HTML / CSS / JS**. It is not a console ROM. It will not run under Super Nintendo, NES, or any libretro core.

The working home for it on a living-room PC (Batocera) is **Ports**: a shell launcher plus a small WebKit window that loads `index.html`.

Tested on **Batocera 43.1** (x86_64), Intel HD Graphics 500, Xbox 360 pad.

## Why not a console folder?

| Target | Result |
|--------|--------|
| `roms/snes`, `roms/nes`, … | No — those folders only launch real dumps |
| `roms/pygame` | Would need a rewrite |
| `roms/windows` | Wine is overkill |
| **`roms/ports`** | Yes — local web game + pad-to-keyboard |

## Layout on Batocera

```
roms/ports/TmDrake Fire.sh              # what EmulationStation lists
roms/ports/TmDrake Fire.sh.keys         # Xbox pad → keyboard (evmapy)
roms/ports/tmdrake-fire/
  index.html
  style.css
  game.js
  launcher.py                           # GTK3 + WebKit2 fullscreen
  screenshots/menu.png                  # used as list art
roms/ports/images/TmDrake Fire.png
```

Copies of the launcher files live in [`batocera/`](batocera/) in this repo.

## Launcher

Batocera has no Chrome/Firefox. It **does** have Python 3 + `WebKit2` 4.1.

`launcher.py`:

- Fullscreen undecorated GTK window
- Loads `file:///.../index.html`
- Enables JS, Web Audio (no user-gesture block)
- Asks WebKit for GPU compositing
- Sets `WEBKIT_DISABLE_DMABUF_RENDERER=1` (old Intel GPUs stutter with the dma-buf path)
- Adds `html.kiosk` after load (hides footer, scales the canvas)
- Esc / Alt+F4 quits; Batocera **Back+Start** is still the system exit combo

`TmDrake Fire.sh` sets `DISPLAY`, `XDG_RUNTIME_DIR`, and `PULSE_SERVER` then `exec python3 ./launcher.py`.

## Controller mapping

`navigator.getGamepads()` did **not** work inside this WebKit2 window, so JS gamepad polling is unreliable here.

Batocera **evmapy** turns the pad into keys the game already understands. File name must be **`TmDrake Fire.sh.keys`** next to the `.sh` (evmapy looks for `{rom.name}.keys`).

| Pad | Key | Game action |
|-----|-----|-------------|
| D-pad / left stick | arrows | Move |
| A / RT | Space | Shoot; also starts from the menu |
| Start | Enter | Start / continue |
| B | P | Pause |
| Y | R | Restart on game over |
| X | M | Mute |
| Back + Start | (system hotkey) | Quit to EmulationStation |

Game.js on the Batocera copy also treats **Enter** and **Space** on the menu / pause / game-over screens so the pad Start/A buttons can leave those overlays.

## Performance (Intel HD 500)

WebKit + a 900×560 canvas scaled to 1080p is heavier than a native port. On this machine it ran, but felt slow until:

1. **Stop writing the HUD DOM every frame.** `updateHud()` in `update()` was changed to ~10 Hz.
2. **Fewer stars / clouds / particles** (particle cap ~60, burst size capped).
3. **Kiosk CSS** — hide the footer, don’t composite extra page chrome.
4. **WebKit GPU + disable dma-buf renderer** in `launcher.py`.

It still will not feel like a SNES core. A pygame/SDL rewrite would be the fast path if this needs 60 fps on Apollo Lake.

## Install sketch

```bash
# on the Batocera box (as root)
DEST=/userdata/roms/ports   # or the extended-disk roms/ports folder
mkdir -p "$DEST/tmdrake-fire" "$DEST/images"
# copy index.html style.css game.js launcher.py into tmdrake-fire/
# copy batocera/TmDrake\ Fire.sh and .keys next to it
chmod +x "$DEST/TmDrake Fire.sh" "$DEST/tmdrake-fire/launcher.py"
cp tmdrake-fire/screenshots/menu.png "$DEST/images/TmDrake Fire.png"
```

Then **Start → Game Settings → Update Games Lists**, or reopen **Ports**.

## Related: Godot SNES-style demo

`snes-platformer-demo` is a **Godot 4.3** project, not this repo. On the same Batocera PC it also belongs in **Ports**. Export Linux x86_64 with **GL Compatibility / opengl3** — Vulkan Forward+ died on Intel HD 500 after a few seconds. Launch with:

```text
--display-driver x11 --rendering-driver opengl3 --audio-driver PulseAudio --fullscreen
```
