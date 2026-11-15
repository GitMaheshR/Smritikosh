# Smritikosh on iPhone

The iPhone app is the same app as on Android (Capacitor, project in `apps/mobile/ios`). There is no Mac, so it is built
on a GitHub-hosted Mac by the workflow `.github/workflows/ios.yml` and installed through **TestFlight**.

## 1. Check that it builds (no Apple account needed)
1. On GitHub open the repository, then **Actions** → **iPhone build** → **Run workflow**.
2. Leave **Sign and upload to TestFlight** unticked and press **Run workflow**.
3. A green tick means the iPhone app compiles. Mac minutes count 10× on a private repository, so run it only when needed.

## Free install from Windows with Sideloadly (no paid account, works 7 days)
Good for trying the app. The app stops opening after 7 days and must be installed again from the PC (installing over it keeps
the data and the activation). A free Apple ID can have at most 3 such apps at a time.

**Once, on the PC**
1. Install Apple's **Apple Devices** app (Microsoft Store) or **iTunes** from apple.com (not the Store version if Sideloadly
   asks for the other one). It provides the USB driver.
2. Install **Sideloadly** from sideloadly.io (free, third-party, not made by Apple).

**Get the app file**
3. GitHub → Actions → **iPhone build** → Run workflow, **Sign and upload to TestFlight** unticked.
4. When it is green, open the run, scroll to **Artifacts**, download `Smritikosh-iPhone-unsigned-<number>` and unzip it.
   Inside is `Smritikosh-0.1.0-<number>-unsigned.ipa`. (Artifacts are kept 14 days.)

**Install**
5. Connect the iPhone with a cable, unlock it and tap **Trust** on the phone.
6. Open Sideloadly, drag the `.ipa` onto it, choose the iPhone, type your Apple ID and press **Start**. Type the Apple ID
   password into Sideloadly yourself when it asks. Sideloadly is a third-party tool, so a separate Apple ID made just for
   this is the safer choice.
7. On the iPhone: Settings → Privacy & Security → **Developer Mode** → on, and restart when asked (iOS 16 and later).
8. Settings → General → **VPN & Device Management** → your Apple ID → **Trust**.
9. Open Smritikosh and activate it with the Device ID, as on Android.

**Every 7 days:** run step 6 again with the same file (or a newer build). Sideloadly can also refresh it automatically when the
iPhone is on the same Wi-Fi as the PC (its "Automatic refresh" option).

## 2. One-time Apple setup (only you can do this)
1. **Join the Apple Developer Program** (USD 99 a year) at developer.apple.com/programs with your Apple ID.
   Note your **Team ID**: developer.apple.com → Account → Membership details.
2. **Register the app ID**: developer.apple.com → Certificates, Identifiers & Profiles → Identifiers → **+** →
   App IDs → App. Description `Smritikosh`, Bundle ID **Explicit** `app.smritikosh.mobile`. No extra capabilities. Register.
3. **Create the app in App Store Connect**: appstoreconnect.apple.com → Apps → **+** → New App. Platform iOS, name
   `Smritikosh` (any free name if taken), language English, bundle ID `app.smritikosh.mobile`, SKU `smritikosh`,
   access Full. The app does not have to be published; TestFlight is enough.
4. **Create an API key**: App Store Connect → Users and Access → **Integrations** → App Store Connect API → Team Keys → **+**.
   Name `GitHub build`, access **Admin** (needed so Apple's cloud signing may create the signing certificate).
   Download the `.p8` file (it can be downloaded only once). Note the **Key ID** and the **Issuer ID** shown above the list.
5. **Add four secrets on GitHub**: repository → Settings → Secrets and variables → Actions → **New repository secret**:

   | Name | Value |
   |---|---|
   | `APPLE_TEAM_ID` | the Team ID from step 1 |
   | `ASC_KEY_ID` | the Key ID from step 4 |
   | `ASC_ISSUER_ID` | the Issuer ID from step 4 |
   | `ASC_PRIVATE_KEY` | open the `.p8` file in Notepad and paste all of it, including the BEGIN and END lines |

   Then delete the downloaded `.p8` file or keep it with the other release keys in `Documents\Smritikosh-license\`.
   Never commit it.
6. **TestFlight testers**: App Store Connect → your app → TestFlight → Internal Testing → **+** group → add yourself.

## 3. Build and install
1. Actions → **iPhone build** → Run workflow, tick **Sign and upload to TestFlight**.
2. When it finishes, wait for Apple to process the build (usually 5–30 minutes; you get an email).
3. On the iPhone install **TestFlight** from the App Store, sign in with the same Apple ID, open Smritikosh, **Install**.
4. Open the app, send the Device ID shown on the activation screen, and enter the activation code you get back
   (`node scripts/issue-code.mjs <Device ID>`).

Each TestFlight build works for 90 days. Running the workflow again uploads a newer build, and TestFlight offers the update.

## Differences from Android
- **No tamper check:** Apple checks the app's signature itself; the Android signing-certificate check is skipped on iPhone.
- **Device ID:** comes from the iPhone's identifier for this app's maker. It changes only if every app from that maker is
  removed from the phone, and then a new activation code is needed.
- **Reminders:** an iPhone app may have at most 64 reminders booked, so the nearest 60 are booked; the rest follow as these
  ring (the list is booked again whenever something changes or the app starts). Done / Snooze 1h / Tomorrow 9am are on
  the notification (press and hold it).
- **No Back button:** use the app's Back arrow.
- **Screenshots** are allowed, as on Android.
- Location and notifications are asked for the first time they are needed.

## Not tested yet
Nothing of the iPhone app has run on a real iPhone or in the simulator yet; the first cloud build will show whether it compiles.
