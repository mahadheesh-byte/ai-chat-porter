# 🔧 Installation Troubleshooting

## Error: "Manifest file is missing or unreadable"

This is a common error! Here's how to fix it:

### ✅ Correct Way to Install

1. **Extract the ZIP file** to a folder
2. **Open the extracted folder** - you should see these files:
   ```
   chat-exporter-extension/
   ├── manifest.json          ← This file must be visible!
   ├── popup.html
   ├── popup.css
   ├── popup.js
   ├── icons/
   ├── content-scripts/
   └── README.md
   ```
3. In Chrome, go to `chrome://extensions/`
4. Enable **Developer mode**
5. Click **Load unpacked**
6. **Select the folder that contains manifest.json** ← Very important!

### ❌ Common Mistakes

**Mistake 1:** Selecting the outer folder instead of the inner one
- When you extract `chat-exporter-extension.zip`, it creates a folder
- Inside that folder is ANOTHER folder with the actual files
- You need to select the INNER folder (the one with manifest.json)

**Mistake 2:** Selecting a ZIP file instead of a folder
- You must extract the ZIP first
- Chrome needs an unzipped folder

**Mistake 3:** Wrong folder selected
- Make sure the folder you select has `manifest.json` directly inside it
- Not in a subfolder

### 🔍 How to Verify You Have the Right Folder

Open the folder in File Explorer/Finder. You should see:
- ✅ manifest.json (file)
- ✅ popup.html (file)
- ✅ popup.js (file)
- ✅ popup.css (file)
- ✅ icons (folder)
- ✅ content-scripts (folder)

If you see these files, this is the correct folder to load!

### 📹 Step-by-Step Visual Guide

1. **Extract the ZIP:**
   - Right-click `chat-exporter-extension.zip`
   - Click "Extract All" or "Extract Here"

2. **Navigate to the folder:**
   - Open the extracted folder
   - You should see `manifest.json` in the file list

3. **Load in Chrome:**
   - Go to `chrome://extensions/`
   - Turn on Developer mode (toggle top-right)
   - Click "Load unpacked"
   - Select THIS folder (the one with manifest.json)

4. **Success!**
   - You should see "AI Chat Exporter" in your extensions list
   - The icon will appear in your toolbar

### Still Having Issues?

Check these:
- ✅ You're using Chrome, Brave, or Edge (not Firefox)
- ✅ Developer mode is enabled
- ✅ The manifest.json file isn't corrupted (should be readable text)
- ✅ You extracted the full ZIP, not just viewing it

### 💡 Pro Tip

The easiest way: After extracting, open the folder in your file browser, then just drag and drop the folder (the one with manifest.json) directly onto the `chrome://extensions/` page!
