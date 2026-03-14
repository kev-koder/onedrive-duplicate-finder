# OneDrive Duplicate Finder — Project Plan

## Goal

A local web application to help manage a large personal collection of photos and videos stored in OneDrive. The primary purpose is to find duplicate files across folders, review them, and safely delete the unwanted copies while keeping the organized ones.

---

## Background & Problem Statement

Over many years of managing photos and videos across cameras, SD cards, iPhones, and OneDrive, the collection has accumulated:

- **Duplicate files:** The exact same file (same name, size, and contents) existing in two or more different folders — caused by copying files multiple times during SD card transfers
- **Cross-name duplicates:** Files with identical contents but different filenames
- **Cloud-only files:** Files that exist in OneDrive but are not downloaded to the local computer (OneDrive placeholder files), due to limited local disk space

The app must handle cloud-only files intelligently — using the OneDrive API to get file hashes and thumbnails without downloading files unnecessarily.

---

## Use Cases

### UC1: Scan folders for media files
The user selects one or more OneDrive root folders to scan. The program indexes all media files found, recording metadata: file path, name, size, hash, modification date, MIME type, and whether each file is local or cloud-only. No files are downloaded at this stage — all metadata comes from the OneDrive API.

### UC2: Detect duplicates
After scanning, the program identifies duplicate groups in two passes:
- **Pass 1 (fast):** Group files by filename + file size. Files matching on both are flagged as probable duplicates.
- **Pass 2 (confirm):** Compare file hashes (provided by OneDrive API — no downloading required). This also catches cross-name duplicates where contents are identical but filenames differ.

The user can choose to skip Pass 2 if they only want obvious filename+size matches.

### UC3: Review duplicate groups
The program presents duplicate groups one at a time. For each group the user sees:
- All copies of the file, each showing its full path, folder, size, date, and cloud status
- A thumbnail preview (photo or video first frame)
- Whether each copy is local or cloud-only

### UC4: Choose which copy to keep and which to delete
Within each duplicate group, the user marks copies as **keep** or **delete**. Nothing is deleted yet — decisions are just recorded. The user can also skip a group or mark it as a false positive (not actually a duplicate).

### UC5: Apply deletions
After reviewing, the user triggers deletion. The program shows a full summary of all files marked for deletion. After confirmation, files are sent to the Windows Recycle Bin (recoverable). Files marked to keep are untouched.

### UC6: Preview cloud-only files without downloading
When the user requests a full-size preview or video playback of any file (local or cloud-only), the app retrieves a temporary pre-authenticated streaming URL from the OneDrive API and sets it as the media source directly in the browser. The file streams from OneDrive's servers to the browser — nothing is written to local disk. Video seeking works natively via HTTP range requests. No disk space management is required.

### UC7: Save and resume a session
The user can save their progress (scan results, duplicate groups, decisions made) and resume later without re-scanning. Useful for large collections that take multiple sittings to review.

### UC8: Filter and sort duplicate groups
The user can filter duplicate groups by:
- Folder
- File type (photo vs video)
- Date range
- Review status (unreviewed, skipped, decided)

And sort by file size (largest first to recover the most space quickly).

---

## Key Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| App type | Local web app | Polished UI via React; no installation complexity |
| Backend | Python + FastAPI | Familiar language; great libraries for Windows file ops and MSAL |
| Frontend | React + Vite | Modern, fast dev experience; rich interactive UI |
| OneDrive access | Microsoft Graph API | Provides hashes + thumbnails for cloud-only files without downloading |
| Duplicate hashing | OneDrive-provided `quickXorHash` | No file download needed for hash comparison |
| Local file access | File system only for deletion | Reading goes through API; deletion goes through Windows shell |
| Deletion safety | Windows Recycle Bin (`send2trash`) | Recoverable; never permanent without user action |
| Video preview | Thumbnail by default; full playback via streaming URL | Browser streams directly from OneDrive — nothing written to local disk |
| Database | SQLite + SQLAlchemy | Local, no server, lightweight, perfect for session persistence |
| Auth | MSAL (Microsoft Auth Library) | Official Microsoft OAuth library for Python |
| UI styling | Tailwind CSS + shadcn/ui | Polished components without heavy design work |
| Cost | Free | All components are open source or free for personal use |

---

## Architecture

```
┌─────────────────────────────────────────────┐
│                React Frontend               │
│  (Auth → Scan → Review → Confirm → Done)   │
└──────────────────┬──────────────────────────┘
                   │ HTTP (REST API)
┌──────────────────▼──────────────────────────┐
│              FastAPI Backend                │
│                                             │
│  ┌─────────┐  ┌──────────┐  ┌───────────┐  │
│  │  Auth   │  │ Indexer  │  │  Deleter  │  │
│  │  Layer  │  │          │  │(send2trash│  │
│  └────┬────┘  └────┬─────┘  └───────────┘  │
│       │            │                        │
│  ┌────▼────────────▼─────────────────────┐  │
│  │         OneDrive API Layer            │  │
│  │    (Microsoft Graph API wrapper)      │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │            SQLite Database            │  │
│  │  sessions │ files │ groups │ decisions│  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
                   │
        ┌──────────▼──────────┐
        │  Microsoft Graph API │
        │  (OneDrive in cloud) │
        └─────────────────────┘
```

### Backend Modules

- **Auth Layer** — MSAL OAuth flow, token storage and refresh
- **OneDrive API Layer** — wrapper around Microsoft Graph API (list files, get metadata, get hashes, get thumbnails, get temporary streaming URLs)
- **Indexer** — paginated folder scan via Graph API, stores results in SQLite
- **Duplicate Detector** — pure database logic comparing hashes and filenames across indexed files
- **Session Manager** — save/restore scan sessions and review progress
- **Deleter** — sends files to Windows Recycle Bin via `send2trash`
- **FastAPI Server** — exposes REST endpoints consumed by the React frontend

---

## Database Schema

### `sessions`
Tracks a scan session.
```
id, created_at, updated_at, folders_scanned (JSON), status, total_files, total_groups
```

### `files`
Every file found during a scan.
```
id, session_id, onedrive_id, name, path, size, hash (quickXorHash),
is_cloud_only, modified_at, mime_type, thumbnail_url
```

### `duplicate_groups`
One row per set of duplicate files.
```
id, session_id, match_type (name_size | content_hash | cross_name), status (open | resolved | skipped)
```

### `group_files`
Links files to duplicate groups with the user's decision.
```
id, group_id, file_id, decision (pending | keep | delete | skip)
```

---

## UI Screens

### 1. Connect
- Sign in with Microsoft account (OAuth in browser)
- Shows connected account and OneDrive quota once authenticated

### 2. Configure Scan
- Select OneDrive folders to scan
- Option to skip Pass 2 (hash comparison) — faster but may miss cross-name duplicates
- Option to load a previously saved session

### 3. Scan Progress
- Live progress: files indexed, duplicate groups found
- Cancel button

### 4. Review Groups (main screen)
- List of duplicate groups with filters and sort controls
- Per-group review:
  - File cards showing: path, folder name, size, date, cloud status badge
  - Thumbnail (photo) or first-frame thumbnail (video)
  - KEEP / DELETE toggle on each card
  - "Play video" button for on-demand video playback
  - Skip group / Mark as not duplicate

### 5. Summary
- Full list of files marked for deletion
- Total space that will be recovered
- Edit decisions before committing

### 6. Apply & Results
- Progress as files are sent to Recycle Bin
- Success/failure count
- Link to open Recycle Bin

---

## Build Phases

### Phase 1 — Foundation
- [ ] Project scaffolding: Python + FastAPI backend, React + Vite frontend
- [ ] Microsoft Azure app registration (one-time manual setup)
- [ ] MSAL OAuth login flow (backend) + Connect screen (frontend)
- [ ] Basic Graph API connection: list files in a folder

### Phase 2 — Indexing & Detection
- [ ] SQLite database setup with SQLAlchemy models
- [ ] Paginated folder scan via Graph API (handles large collections)
- [ ] Store file metadata and hashes in database
- [ ] Duplicate detection logic (Pass 1: name+size, Pass 2: hash)
- [ ] Session save and resume

### Phase 3 — Review UI
- [ ] Scan progress screen
- [ ] Duplicate groups list with filtering and sorting
- [ ] Per-group review screen with file cards
- [ ] Thumbnail display (via OneDrive API)
- [ ] Keep/delete decision recording

### Phase 4 — Actions & Polish
- [ ] Summary screen with decisions review
- [ ] Apply deletions via Recycle Bin (`send2trash`)
- [ ] On-demand video playback (streaming URL from Graph API)
- [ ] Filtering and sorting of duplicate groups

---

## Project Structure (planned)

```
media-manager/
├── backend/
│   ├── main.py               # FastAPI app entry point
│   ├── auth.py               # MSAL OAuth logic
│   ├── onedrive.py           # Microsoft Graph API wrapper
│   ├── indexer.py            # Folder scanning logic
│   ├── detector.py           # Duplicate detection logic
│   ├── database.py           # SQLAlchemy models and session
│   ├── deleter.py            # Recycle Bin operations
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/
│   │   │   ├── Connect.jsx
│   │   │   ├── Configure.jsx
│   │   │   ├── ScanProgress.jsx
│   │   │   ├── Review.jsx
│   │   │   ├── Summary.jsx
│   │   │   └── Results.jsx
│   │   └── components/
│   │       ├── FileCard.jsx
│   │       ├── ThumbnailViewer.jsx
│   │       └── VideoPlayer.jsx
│   ├── package.json
│   └── vite.config.js
├── data/
│   └── media_manager.db      # SQLite database (created at runtime)
└── PLAN.md
```

---

## Setup Steps (Before Writing Code)

### 1. Register the app in Microsoft Azure (one-time, ~10 minutes, free)
1. Go to [portal.azure.com](https://portal.azure.com) and sign in with your Microsoft account
2. Search for "App registrations" and click "New registration"
3. Name: `OneDrive Duplicate Finder` — Account type: "Personal Microsoft accounts only"
4. Do **not** set a Redirect URI during initial registration — leave it blank and click Register
5. After registering, copy the **Application (client) ID**
6. Under "API permissions" add: `Files.Read`, `Files.ReadWrite` (Microsoft Graph, Delegated)
7. Under "Authentication" click **+ Add a platform**, choose **Mobile and desktop applications**, and enter `http://localhost:8000/auth/callback` as a custom redirect URI
8. Under "Authentication" enable "Allow public client flows"

### 2. Install prerequisites
- Python 3.11+
- Node.js 20+ (for React/Vite tooling)

### 3. Create a `.env` file in `backend/`
```
AZURE_CLIENT_ID=your-client-id-here
```

---

## API Endpoints (Backend)

| Method | Path | Description |
|---|---|---|
| `GET` | `/auth/status` | Check if authenticated |
| `GET` | `/auth/login` | Initiate OAuth flow |
| `GET` | `/auth/callback` | OAuth redirect handler |
| `POST` | `/auth/logout` | Clear stored tokens |
| `POST` | `/scan/start` | Start a new scan |
| `GET` | `/scan/status` | Poll scan progress |
| `POST` | `/scan/cancel` | Cancel in-progress scan |
| `GET` | `/sessions` | List saved sessions |
| `GET` | `/sessions/{id}` | Load a saved session |
| `GET` | `/groups` | List duplicate groups (with filters) |
| `GET` | `/groups/{id}` | Get a single duplicate group |
| `PATCH` | `/groups/{id}/files/{file_id}` | Update keep/delete decision |
| `GET` | `/files/{id}/thumbnail` | Get thumbnail image |
| `GET` | `/files/{id}/stream-url` | Get temporary streaming URL for video/image playback |
| `GET` | `/summary` | Get deletion summary |
| `POST` | `/apply` | Execute all pending deletions |

---

## Notes & Constraints

- All file indexing goes through the Microsoft Graph API — the local file system is never read for scanning
- `quickXorHash` is provided by OneDrive for all files (local+synced and cloud-only) — no file content is read for duplicate detection
- Full-size previews and video playback use temporary streaming URLs from the Graph API — the browser streams directly from OneDrive, nothing is written to local disk
- Deletion always goes to the Windows Recycle Bin, never permanently deleted in one step
- The app runs locally — no data is sent to any third party other than Microsoft Graph API calls for the user's own OneDrive
