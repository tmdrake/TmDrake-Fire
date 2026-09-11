# TmDrake Fire 🟣🐉

A small browser shooter starring a **purple tmdrake-style dragon** vs a **sombrero squadron**.

Built as a first Mac game project — pure HTML / CSS / JavaScript. No install required.

## Play

**Online:** [tmdrake.github.io/TmDrake-Fire](https://tmdrake.github.io/TmDrake-Fire/)

**Local:** open `index.html` in Safari or Chrome:

```bash
open index.html
```

**Batocera:** this is **not** an SNES/NES ROM. On a Batocera PC it runs from **Ports** via a WebKit launcher. See [PORTING.md](PORTING.md) and the files in [`batocera/`](batocera/).

## Screenshots

### Main menu
![Main menu](screenshots/menu.png)

### Gameplay — sombrero squadron
![Gameplay with sombrero enemies](screenshots/play.png)

### Power-ups
![Power-ups: shield, rapid, triple, heal](screenshots/power.png)

### Boss — El Jefe
![Boss fight with El Jefe](screenshots/boss.png)

## Controls

| Action | Keys | Xbox pad (Batocera Ports) |
|--------|------|---------------------------|
| Move | WASD / Arrow keys | D-pad / left stick |
| Shoot | Space / Click (hold OK) | A or RT |
| Start / continue | Enter | Start |
| Pause | P | B |
| Mute | M | X |
| Restart (game over) | R | Y |
| Quit (Batocera) | Esc / Alt+F4 | Back + Start |

## Features

- Purple **tmdrake** dragon with gold-tipped horns and purple fire
- Enemies: **Mariachi**, **Bandito**, **Vaquero**, **El Jefe** (all with sombreros)
- Power-ups: Shield, Rapid Fire, Triple Shot, Heart
- Wave-based scoring + session best score
- Web Audio sound effects (no asset files)
- Main menu, how-to-play, pause, game over

## Project layout

```
index.html          # shell + menus
style.css           # purple theme UI
game.js             # game loop, entities, audio, drawing
screenshots/        # repo promo shots
PORTING.md          # Batocera / living-room PC notes
batocera/           # Ports launcher, pad map
```

## Recapture screenshots

With Google Chrome installed:

```bash
mkdir -p screenshots
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
BASE="file://$(pwd)/index.html"
for shot in menu play power boss; do
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars \
    --window-size=1000,780 --virtual-time-budget=3000 \
    --screenshot="screenshots/${shot}.png" "${BASE}?shot=${shot}"
done
```

## License

MIT — made for fun by tmdrake.
