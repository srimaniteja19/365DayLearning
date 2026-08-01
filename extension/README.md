# Refrainly Chrome Extension (Manifest V3)

A lightweight Manifest V3 Chrome extension for **Refrainly** that allows you to save any web page or article directly to your **Bookmarks board** or **Learned journal** without leaving your current tab.

---

## Features

- **Save to Bookmarks**:
  - Auto-detects URL, title, and link kind (`youtube`, `vimeo`, `repo`, `doc`, `article`, `link`).
  - Fetches rich OpenGraph / oEmbed metadata previews from your Refrainly app.
  - Option to append personal notes and comma-separated tags.
- **Save to Learned**:
  - Save key insights directly to your daily journal.
  - Category selector matching app schema (`talk`, `paper`, `tool`, `tip`, `course`, `other`).
  - Date selector defaulting to today (prevents future dates).
- **Context Menu Integration**:
  - Right-click any page or link and select **"Save to Refrainly Bookmarks"** to save instantly without opening the popup.
- **Seamless Auth Reuse**:
  - Automatically reuses your active Refrainly web app session cookie.

---

## How to Install & Use (Local Development)

### 1. Load Unpacked Extension in Chrome

1. Open Google Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** using the toggle in the top-right corner.
3. Click the **Load unpacked** button.
4. Select the `extension/` folder inside this repository.

### 2. Configure & Sign In

1. Start your local Refrainly app:
   ```bash
   npm run dev
   ```
2. Make sure you are signed into Refrainly at `http://localhost:3000`.
3. Click the Refrainly extension icon in your Chrome toolbar.
4. The extension popup will automatically detect your active login session and auto-fill the current tab's details!

> **Custom API Base URL**: If your Refrainly app runs on a different port or host (e.g. `https://refrainly.app`), click the ⚙️ **Settings** icon in the popup header to update the **App Base URL**.

---

## Extension Structure

```
extension/
├── manifest.json       # Manifest V3 configuration
├── popup.html          # Action popup user interface
├── popup.css           # Styling matching Refrainly design system
├── popup.js            # Popup controller logic & API calls
├── background.js       # Service worker for Context Menu right-click saving
├── lib/
│   └── bookmarks.js    # Client-side URL normalization & kind detection
└── icons/              # Extension icons (16x16, 48x48, 128x128)
```
