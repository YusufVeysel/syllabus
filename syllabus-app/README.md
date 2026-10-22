# Syllabus: study planner

A to-do app for university: courses, deadlines, exam countdowns, a calendar and a Pomodoro focus timer.
It installs on your phone and computer like a normal app, works offline, and syncs between devices once you connect Firebase (free).

## Files

| File | What it is |
|---|---|
| `index.html` | The app page |
| `app.js` | All the app logic |
| `styles.css` | The look (light and dark mode) |
| `firebase-config.js` | **Your sync settings go here** (step 2) |
| `firestore.rules` | Database security rules (step 4) |
| `sw.js` | Offline support |
| `manifest.webmanifest`, `icons/` | Makes it installable with its own icon |

Without step 1–4 the app still works, but tasks stay on the device you use.

---

## 1. Create a Firebase project (5 min, free)

1. Go to <https://console.firebase.google.com> and sign in with your Google account.
2. **Create a project** → name it `syllabus` → you can turn Google Analytics off → **Create**.

## 2. Add a web app and copy its settings

1. On the project home page, click the **`</>`** (Web) icon.
2. App nickname: `Syllabus`. Leave "Firebase Hosting" unticked. Click **Register app**.
3. Firebase shows a block of code with `const firebaseConfig = { apiKey: ..., ... }`.
4. Open `firebase-config.js` and replace `null` with that object, so it reads:

   ```js
   export const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "syllabus-xxxx.firebaseapp.com",
     projectId: "syllabus-xxxx",
     storageBucket: "syllabus-xxxx.appspot.com",
     messagingSenderId: "...",
     appId: "..."
   };
   ```

   These values are not secret. They only identify your project; the rules in step 4 protect the data.

## 3. Turn on sign-in

1. Open `https://console.firebase.google.com/project/YOUR-PROJECT-ID/authentication` (your project ID is shown under the project name), or search the console for **Authentication**. Click **Get started**.
2. **Sign-in method** tab → enable **Email/Password** → Save.
3. Click **Add new provider** → **Google** → enable → pick your support email → Save.

## 4. Create the database

1. Open `https://console.firebase.google.com/project/YOUR-PROJECT-ID/firestore`, or search the console for **Firestore**. Click **Create database**.
2. Pick a location close to you (e.g. `eur3 (europe-west)`), start in **production mode**.
3. Open the **Rules** tab, replace everything with the contents of `firestore.rules`, and click **Publish**.

## 5. Put it online

The app has to be on an `https://` address to install on a phone. The easiest free option:

**Netlify Drop (no tools needed)**
1. Go to <https://app.netlify.com/drop> and create a free account.
2. Drag the whole `syllabus-app` folder onto the page. You get an address like `https://cheerful-otter-123.netlify.app`.
3. Back in Firebase: **Authentication → Settings → Authorized domains → Add domain** → paste `cheerful-otter-123.netlify.app` (without `https://`).

To update the app later, drag the folder onto your site's **Deploys** page in Netlify again. If you changed files, also bump `VERSION` in `sw.js` (e.g. `syllabus-v2`) so installed copies pick up the new version.

Other free hosts work the same way (GitHub Pages, Cloudflare Pages, Firebase Hosting). Always add the new domain to Firebase's Authorized domains.

## 6. Install it

- **Android (Chrome):** open your address → menu **⋮** → **Install app** (or "Add to Home screen").
- **iPhone (Safari):** open your address → **Share** → **Add to Home Screen**.
- **Windows / Mac (Chrome or Edge):** open your address → click the install icon at the right end of the address bar.

Sign in with the same account on each device and your tasks sync automatically, including changes made offline.

---

## Windows app (.exe)

`dist\Syllabus.exe` (in the folder above this one) is the same app in its own window. Double-click it, or right-click it → **Send to → Desktop (create shortcut)**, or pin it to the taskbar while it's open.

- Your tasks are kept in `%LOCALAPPDATA%\Syllabus`, so deleting or rebuilding the .exe doesn't lose them.
- Sign-in in the .exe uses **email and password** (Google blocks its sign-in inside app windows). Use the same email account on your phone and tasks sync.
- After changing any app files, double-click `desktop\build.bat` to rebuild `dist\Syllabus.exe`.
- Windows SmartScreen may warn the first time because the .exe isn't signed: click **More info → Run anyway**.

## Mac app

A Mac app has to be built on a Mac. Pick whichever fits:

**A. Install the web version (easiest, no building).** After step 5, open your Netlify address on the Mac:
- Safari (macOS Sonoma or newer): **File → Add to Dock**.
- Chrome or Edge: click the install icon at the right end of the address bar.

It gets its own Dock icon and window and syncs like the others. Google sign-in works here too.

**B. Build Syllabus.app on a Mac.** Copy the whole `To-do APP` folder to the Mac (skip `.venv`, `build` and `dist`), open Terminal in it, and run:

```bash
bash desktop/build-mac.sh
```

Drag `dist-mac/Syllabus.app` into Applications. It's unsigned, so the first time **right-click it → Open → Open** (or allow it in System Settings → Privacy & Security). Tasks are kept in `~/Library/Application Support/Syllabus`. Like the .exe, it uses email sign-in.

**C. No Mac? Let GitHub build it for free.** Put the `To-do APP` folder in a GitHub repository (the `.gitignore` leaves out build leftovers). Open the repository's **Actions** tab → **Build desktop apps** → **Run workflow**. After about 5 minutes, download **Syllabus-mac** (and a fresh **Syllabus-windows**) from the finished run's Artifacts section.

## Using it

Type in the "Add a task" box and press Enter. It understands:

| Type | Meaning |
|---|---|
| `#MATH201` | file under a course (code or name) |
| `today`, `tomorrow`, `fri`, `14.11`, `2026-11-14` | due date |
| `in 3 days`, `next week` | relative due date |
| `23:59` | time |
| `!high`, `!med`, `!low` (or `!3` `!2` `!1`) | priority |
| `*exam`, `*reading`, `*lab`, `*project`, `*quiz` | type. Words like "midterm", "final", "vize" or "quiz" are detected automatically |

Press **N** anywhere to jump to the box. **Back up** in the sidebar saves everything to a `.json` file and **Restore** loads one back.
If you used the app before connecting sync, a **Copy tasks from this device** button appears after you sign in.

## Try it on your computer first

From inside this folder, run:

```bash
python -m http.server 8080
```

Then open <http://localhost:8080>. `localhost` is already an authorized domain in Firebase, so sign-in works here too.
