# OneDrive Duplicate Finder

Find and remove duplicate photos and videos from your OneDrive.

## Prerequisites

- Python 3.11+
- Node.js 20+

## Setup

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env and add your Azure Client ID
```

### 2. Frontend

```bash
cd frontend
npm install
```

## Running

Open two terminals:

**Terminal 1 — Backend:**
```bash
cd backend
python main.py
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Then open http://localhost:5173 in your browser.
