"""Syllabus desktop app: shows the web app in its own Windows window.

Run for testing:   .venv\\Scripts\\python desktop\\main.py
Build the .exe:    desktop\\build.bat        (on Windows)
Build the .app:    bash desktop/build-mac.sh (on a Mac)
"""
import os
import sys

import webview

# Fixed port so the app keeps the same address between launches.
# Saved data in the window belongs to this address, so don't change it.
PORT = 47821


def app_dir() -> str:
    """Folder that holds index.html, both when run from source and inside the .exe."""
    if getattr(sys, "frozen", False):
        return os.path.join(sys._MEIPASS, "syllabus-app")  # unpacked by PyInstaller
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "syllabus-app")


def data_dir() -> str:
    """Where the window keeps tasks, sign-in and the offline cache.
    Windows: %LOCALAPPDATA%\\Syllabus   macOS: ~/Library/Application Support/Syllabus"""
    if sys.platform == "darwin":
        base = os.path.expanduser("~/Library/Application Support")
    else:
        base = os.environ.get("LOCALAPPDATA") or os.path.expanduser("~")
    path = os.path.join(base, "Syllabus")
    os.makedirs(path, exist_ok=True)
    return path


def main() -> None:
    webview.settings["ALLOW_DOWNLOADS"] = True                  # "Back up" saves a file
    webview.settings["OPEN_EXTERNAL_LINKS_IN_BROWSER"] = True   # links open in your browser

    webview.create_window(
        "Syllabus",
        os.path.join(app_dir(), "index.html"),
        width=1280,
        height=820,
        min_size=(380, 560),
        text_select=True,
        background_color="#F2F4F8",
    )
    webview.start(
        http_server=True,
        http_port=PORT,
        private_mode=False,        # keep data after the window closes
        storage_path=data_dir(),
        # Windows uses this for the title bar; macOS takes the icon from the .app bundle.
        icon=os.path.join(app_dir(), "icons", "app.ico") if sys.platform == "win32" else None,
    )


if __name__ == "__main__":
    main()
