@echo off
rem Builds Syllabus.exe into the "dist" folder. Double-click this file, or run it from a terminal.
cd /d "%~dp0.."

if not exist ".venv\Scripts\python.exe" (
  echo Setting up Python tools, first time only...
  python -m venv .venv || goto :fail
  ".venv\Scripts\python" -m pip install --upgrade pip pywebview pyinstaller pillow || goto :fail
)

".venv\Scripts\python" -c "from PIL import Image; Image.open('syllabus-app/icons/icon-512.png').save('syllabus-app/icons/app.ico', sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])" || goto :fail

".venv\Scripts\python" -m PyInstaller --noconfirm --clean --onefile --windowed ^
  --name Syllabus ^
  --icon "%CD%\syllabus-app\icons\app.ico" ^
  --add-data "%CD%\syllabus-app;syllabus-app" ^
  --distpath dist --workpath build --specpath build ^
  "%CD%\desktop\main.py" || goto :fail

echo.
echo Done: dist\Syllabus.exe
exit /b 0

:fail
echo.
echo Build failed. Scroll up for the error.
exit /b 1
