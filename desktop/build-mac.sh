#!/usr/bin/env bash
# Builds Syllabus.app for macOS. Run on a Mac from the To-do APP folder:
#   bash desktop/build-mac.sh
# Result: dist-mac/Syllabus.app (drag it into Applications) and dist-mac/Syllabus-mac.zip
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -x .venv-mac/bin/python ]; then
  echo "Setting up Python tools, first time only..."
  python3 -m venv .venv-mac
  .venv-mac/bin/python -m pip install --upgrade pip pywebview pyinstaller pillow
fi
PY=.venv-mac/bin/python

"$PY" -m PyInstaller --noconfirm --clean --windowed --onedir \
  --name Syllabus \
  --osx-bundle-identifier com.syllabus.planner \
  --icon "$PWD/syllabus-app/icons/icon-512.png" \
  --add-data "$PWD/syllabus-app:syllabus-app" \
  --distpath dist-mac --workpath build-mac --specpath build-mac \
  "$PWD/desktop/main.py"

# A zip keeps the .app intact when you copy or download it.
rm -f dist-mac/Syllabus-mac.zip
ditto -c -k --keepParent dist-mac/Syllabus.app dist-mac/Syllabus-mac.zip

echo
echo "Done: dist-mac/Syllabus.app"
