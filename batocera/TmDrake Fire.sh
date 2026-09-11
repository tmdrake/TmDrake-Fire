#!/bin/bash
# Batocera Ports launcher — put this next to a tmdrake-fire/ folder.
GAMEDIR="$(dirname "$0")/tmdrake-fire"
cd "$GAMEDIR" || exit 1
export DISPLAY="${DISPLAY:-:0}"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/var/run}"
export PULSE_SERVER="${PULSE_SERVER:-unix:/var/run/pulse/native}"
exec python3 ./launcher.py
