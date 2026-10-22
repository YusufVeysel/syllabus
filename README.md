<p align="center">
  <img src="syllabus-app/icons/icon-192.png" width="96" alt="Syllabus icon">
</p>

<h1 align="center">Syllabus</h1>

<p align="center">A study planner for university students. Courses, deadlines, exam countdowns and a focus timer, synced across Windows, Mac and phone.</p>

---

## Features

- **Courses as lists.** Each course has a code (`MATH201`) and a colour, and its own page with open tasks, the next exam and study time.
- **Smart views:** Today, Next 7 days, Inbox, All tasks, Completed. Overdue tasks stand out in red.
- **Quick add that understands you:** `Problem set 5 #MATH201 fri 23:59 !high` is filed under the course, due Friday at 23:59, high priority.
- **Exam countdowns.** Exams and quizzes show "5 days" counters. Words like *midterm*, *final*, *quiz* or *vize* are detected automatically.
- **Task details:** due date and time, type, priority, subtasks and notes.
- **Calendar:** a month view, starting on Monday.
- **Focus timer (Pomodoro):** logs study minutes to each course, with a 7-day chart and a day streak.
- **Sync** through Firebase: sign in on any device and see the same tasks, live. Changes made offline upload when you reconnect.
- **Works offline**, has light and dark mode, and lets you back up to / restore from a file.

## Platforms

| Platform | How |
|---|---|
| **Windows** | `Syllabus.exe`, a native window. Built with `desktop\build.bat` or the GitHub action |
| **macOS** (Apple chip) | `Syllabus.app`, from the GitHub action or `desktop/build-mac.sh` on a Mac |
| **Android / iPhone** | Install the hosted web app from the browser ("Install app" / "Add to Home Screen") |
| **Any browser** | Open the hosted web app |

All of them run the same code in [`syllabus-app/`](syllabus-app).

## Getting started

1. **Set up Firebase (free)** so sign-in and sync work. Step-by-step guide: [`syllabus-app/README.md`](syllabus-app/README.md).
   In short: create a project, paste its web settings into [`syllabus-app/firebase-config.js`](syllabus-app/firebase-config.js), turn on Email/Password (and Google) sign-in, create a Firestore database, and publish [`syllabus-app/firestore.rules`](syllabus-app/firestore.rules).
2. **Get the desktop apps:** open the **Actions** tab → **Build desktop apps** → **Run workflow**. After a few minutes, download `Syllabus-windows` and `Syllabus-mac` from the run's *Artifacts*.
3. **For phones:** host the `syllabus-app` folder (for example by dragging it onto [Netlify Drop](https://app.netlify.com/drop)), add that domain under Firebase → Authentication → Settings → Authorized domains, then install it from the phone's browser.

Without Firebase settings the app still works and saves tasks on the device only.

### First launch warnings

The desktop apps aren't signed, so the system asks once:

- **Windows:** "Windows protected your PC" → **More info** → **Run anyway**.
- **macOS 15 and newer:** open the app once and let it be blocked, then go to **System Settings → Privacy & Security** → **Open Anyway**. Or run this in Terminal:
  ```bash
  xattr -dr com.apple.quarantine /Applications/Syllabus.app
  ```

The desktop apps use email and password sign-in, because Google doesn't allow its sign-in inside app windows. Use the same account on every device.

## Run it locally

```bash
cd syllabus-app
python -m http.server 8080
```

Open <http://localhost:8080>. To run the desktop window from source on Windows:

```bash
python -m venv .venv
.venv\Scripts\python -m pip install pywebview
.venv\Scripts\python desktop\main.py
```

## Project structure

```
syllabus-app/        The app: HTML, CSS and JavaScript, no build step
  app.js             App logic, quick-add parser, timer, Firebase sync
  firebase-config.js Your Firebase project settings
  firestore.rules    Database rules: each account can only access its own data
  sw.js              Offline cache
desktop/
  main.py            Opens the app in a native window (pywebview)
  build.bat          Builds Syllabus.exe (Windows)
  build-mac.sh       Builds Syllabus.app (macOS)
.github/workflows/   Cloud build for both desktop apps
syllabus.html        Earlier single-file version, made as a Claude artifact
```

## Data and privacy

Tasks are stored in your own Firebase project under `users/<your account id>/`. The rules only let a signed-in account read and write its own data. The values in `firebase-config.js` identify the project and aren't secret. Desktop apps keep their local copy in `%LOCALAPPDATA%\Syllabus` (Windows) or `~/Library/Application Support/Syllabus` (Mac).
