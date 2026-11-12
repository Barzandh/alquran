AlQuran — installable dev build (20261112.231500)
=================================================

What this is
  A complete offline web app. Host this folder on any HTTPS address, open it once
  on your iPhone, "Add to Home Screen", and it works without internet from then on.

Files
  index.html            the whole app (Quran text, translations, font, timetables built in)
  sw.js                 service worker — keeps the app available offline, handles updates
  manifest.webmanifest  app name, icons, colours for the Home Screen
  icons/                app icons (iPhone, Android, maskable)
  _headers              cache rules for Netlify / Cloudflare Pages (other hosts ignore it)

Host it (pick one, all free)
  A) Netlify Drop (easiest, from a computer): open https://app.netlify.com/drop and drag
     the alquran-pwa folder onto the page. You get an https://….netlify.app address.
  B) GitHub Pages: create a repository, upload the CONTENTS of this folder, then
     Settings → Pages → Deploy from branch → main / root.
  C) Cloudflare Pages: Create project → Direct upload → choose this folder.
  It must be https:// — iPhone only installs offline web apps from secure addresses.

Install on iPhone
  1. Open the https address in Safari.
  2. Wait until the toast "AlQuran is ready to work offline" appears (first load).
  3. Share button → Add to Home Screen → Add.
  4. Open AlQuran from the Home Screen → More → Phone & offline:
       • Allow notifications (only possible inside the installed app, iOS 16.4+)
       • Allow location (or pick your city), allow motion for the Qibla compass
       • Download surahs for offline recitation
  5. More → Reminders → turn on reminders → "Add to Calendar" for alarms that ring
     when the app is closed.
  6. More → Developer → "Run all checks" to verify everything on the phone itself.

Updating
  Upload a new build to the same address. The app shows "A new version is ready —
  Update" the next time it is opened online. Your data stays on the phone.

Your data
  Stays on the phone only (nothing is sent anywhere). Backups: More → Backups.
  Deleting the Home Screen app deletes its data — keep a backup in Files / iCloud.
