# OneDrive Duplicate Finder

Find and remove duplicate photos and videos from your OneDrive. Scans folders via the Microsoft Graph API, groups duplicates by content hash or filename, and lets you review and safely move copies to the OneDrive Recycle Bin.

## Prerequisites

- [Python 3.11+](https://www.python.org/downloads/)
- [Node.js 20+](https://nodejs.org/)

## Installation

**1. Install backend dependencies**
```bash
cd backend
pip install -r requirements.txt
```

**2. Install frontend dependencies**
```bash
cd frontend
npm install
```

## Running the app

Double-click **start.bat** in the project root, then open http://localhost:5173 in your browser.

The first time you run it, the app will guide you through a one-time setup to connect it to your OneDrive. This takes about 10 minutes and only needs to be done once.

## First-time setup (in the app)

When you open the app for the first time, the setup screen will walk you through registering a free app in Microsoft Azure. This is what allows the tool to access your OneDrive on your behalf.

The steps are:

1. Sign in to the Azure portal — use whichever applies to you:
   - **New to Azure?** Go to [portal.azure.com](https://portal.azure.com/) where you can start with a free account
   - **Previously had an Azure account that has since expired or been deactivated?** Go to [entra.microsoft.com](https://entra.microsoft.com/) instead — it works with any active Microsoft account and does not require an Azure subscription
2. Register a new app under **Applications → App registrations**
3. Add `Files.Read` and `Files.ReadWrite` permissions under **API permissions**
4. Add `http://localhost:8000/auth/callback` as a redirect URI under **Authentication → Mobile and desktop applications**
5. Enable **Allow public client flows** under **Authentication**
6. Copy the **Application (client) ID** from the Overview page and paste it into the app

Full instructions with exact steps are shown in the app — you do not need to refer back to this document for that part.

## How it works

- **No files are downloaded** — all scanning uses the Microsoft Graph API, which provides file hashes and thumbnails directly from OneDrive
- **Safe deletion** — files are moved to the OneDrive Recycle Bin, not permanently deleted
- **Cloud-only files supported** — works even if your files are not synced locally
- **Session saving** — scan results are saved so you can resume a review across multiple sittings

## Tech stack

- Backend: Python + FastAPI
- Frontend: React + Vite + Tailwind CSS
- Auth: Microsoft MSAL (OAuth)
- Database: SQLite
