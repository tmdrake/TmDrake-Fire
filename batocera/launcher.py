#!/usr/bin/env python3
"""Fullscreen WebKit2 host for TmDrake Fire on Batocera (no Chrome/Firefox)."""
import os

os.environ.setdefault("WEBKIT_DISABLE_DMABUF_RENDERER", "1")
os.environ.setdefault("WEBKIT_DISABLE_COMPOSITING_MODE", "0")

import gi

gi.require_version("Gtk", "3.0")
gi.require_version("WebKit2", "4.1")
from gi.repository import Gtk, WebKit2, Gdk

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, "index.html")


class FireWindow(Gtk.Window):
    def __init__(self):
        Gtk.Window.__init__(self, title="TmDrake Fire")
        self.fullscreen()
        self.set_decorated(False)
        web = WebKit2.WebView()
        s = web.get_settings()
        s.set_enable_javascript(True)
        try:
            s.set_hardware_acceleration_policy(WebKit2.HardwareAccelerationPolicy.ALWAYS)
        except Exception:
            pass
        try:
            s.set_enable_smooth_scrolling(False)
            s.set_media_playback_requires_user_gesture(False)
        except Exception:
            pass
        web.connect("load-changed", self.on_load)
        web.load_uri("file://" + INDEX)
        self.add(web)
        self.connect("destroy", Gtk.main_quit)
        self.connect("key-press-event", self.on_key)
        self.show_all()

    def on_load(self, web, event):
        if event == WebKit2.LoadEvent.FINISHED:
            web.run_javascript(
                "document.documentElement.classList.add('kiosk');",
                None,
                None,
                None,
            )

    def on_key(self, _w, event):
        if event.keyval == Gdk.KEY_Escape:
            Gtk.main_quit()
            return True
        if event.keyval == Gdk.KEY_F4 and (event.state & Gdk.ModifierType.MOD1_MASK):
            Gtk.main_quit()
            return True
        return False


if __name__ == "__main__":
    FireWindow()
    Gtk.main()
