<div align="center">

# 🖼️ PastePort

**Paste images directly into any upload field — without saving files to your computer.**

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Chrome](https://img.shields.io/badge/Chrome-109%2B-4285F4?logo=googlechrome&logoColor=white)]()
[![Edge](https://img.shields.io/badge/Edge-109%2B-0078D7?logo=microsoftedge&logoColor=white)]()
[![No backend](https://img.shields.io/badge/Backend-None-success)]()
[![No telemetry](https://img.shields.io/badge/Telemetry-None-success)]()

</div>

---

## ✨ What is it?

**PastePort** is a Chromium browser extension that turns recent clipboard images into real files for image upload fields.

Copied an image? Just click the upload field and select it from the clipboard gallery. The extension converts the image into a valid `File` object and delivers it to the site through `input` and `change` events — exactly as if you had selected the file manually.

> No temporary downloads. No manual pasting. No hassle.

---

## 🚀 Features

- 📋 **Clipboard gallery** — up to 10 recent images available instantly.
- 🌑 **Shadow DOM support** — works with open components and compatible frames.
- 🎯 **Smart detection** — labels, dropzones, custom buttons, and dynamic inputs are recognized.
- 🖱️ **Drag-and-drop** — drag one or many images straight into the modal.
- ⚙️ **Configurable** — theme, file limit, ignored domains, filename prefix, and more.
- 🔒 **100% local** — no image ever leaves your browser.
- 🪶 **Lightweight** — no dependencies, no remote libraries, no `eval`.

---

## 📦 Installation

### From the Chrome Web Store

PastePort is officially published on the Chrome Web Store:

https://chromewebstore.google.com/detail/pasteport/cjopgpdaajiblomfhjcdjegionhdliph

Official published version: **1.1.1**.

### Locally

1. Download this repository.
2. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the `pasteport` folder containing the `manifest.json`.
6. Reload any pages that were open before installation.

The browser will ask for permission to read copied and pasted data. This is only needed to build the local recent images gallery.

---

## 🖐️ How to use

1. **Copy** an image (screenshot, web image, image editor…).
2. **Click** an upload field, label, button, or image drop area.
3. The **PastePort** balloon appears next to your click.
4. Choose an image from the clipboard gallery.
5. Done — the site receives the file normally.

> **`Escape`**, the close button, or clicking outside the modal closes it. The **Select from computer** button opens the browser's native file picker.

---

## 🔐 Privacy

- Everything is processed locally in your browser.
- No images are sent to servers.
- Only image items from the clipboard are observed.
- Text, passwords, and unrelated content are ignored.
- Recent images are stored in local IndexedDB and can be cleared anytime.
- No telemetry, tracking, or remote scripts.

---

## 🛠️ Development

```bash
# Clone the repository
git clone https://github.com/your-username/pasteport.git
cd pasteport

# Run the manual test page
python -m http.server 8080 --directory pasteport/tests
```

Then open `http://localhost:8080/manual-test.html` with the extension loaded.

To apply code changes, reload the extension in the manager and refresh the tested page.

---

## 🧪 Manual tests

The `pasteport/tests/manual-test.html` page covers scenarios such as:

- simple, hidden, and dynamic inputs
- labels, dropzones, and custom buttons
- `accept`, `multiple`, and format validation
- iframes and open Shadow DOM
- recent gallery, removal, and history cleanup

---

## ⚠️ Known limitations

- **Closed** Shadow DOM cannot be accessed; the site's native behavior is preserved.
- Chrome does not expose the system's native clipboard history. The gallery is built only from images copied while the extension is active.
- Restricted-origin frames, internal browser pages, and the Chrome Web Store remain unchanged.
- Firefox is not supported in this version.

---

## 🤝 Contributing

Suggestions, bug reports, and pull requests are welcome! Open an issue describing the scenario you found — especially if it's a specific site where PastePort doesn't work.

---

## 📄 License

This project does not yet have a defined license. Please get in touch before using the code in other projects.

---

<div align="center">

Made with 💙 for people who hate saving screenshots to the desktop.

</div>
