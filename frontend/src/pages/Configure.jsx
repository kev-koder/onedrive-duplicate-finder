import { useEffect, useState } from "react";
import api from "../api/client";

function FolderRow({ folder, depth, fullPath, selected, onToggle }) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState(null); // null = not loaded yet
  const [loadingChildren, setLoadingChildren] = useState(false);
  const hasChildren = (folder.folder?.childCount ?? 0) > 0;

  async function handleExpand() {
    if (!expanded && children === null) {
      setLoadingChildren(true);
      try {
        const res = await api.get(`/folders/${folder.id}/children`);
        setChildren(res.data.folders);
      } catch {
        setChildren([]);
      } finally {
        setLoadingChildren(false);
      }
    }
    setExpanded((v) => !v);
  }

  return (
    <div>
      <div
        className="flex items-center gap-2 py-2.5 pr-4 hover:bg-gray-50"
        style={{ paddingLeft: `${16 + depth * 20}px` }}
      >
        {/* Expand toggle */}
        <button
          type="button"
          onClick={handleExpand}
          className="w-5 h-5 flex items-center justify-center shrink-0 text-gray-400 hover:text-gray-600"
          style={{ visibility: hasChildren ? "visible" : "hidden" }}
        >
          {loadingChildren ? (
            <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg
              className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </button>

        {/* Checkbox + folder icon + name */}
        <label className="flex items-center gap-2 flex-1 cursor-pointer min-w-0">
          <input
            type="checkbox"
            className="w-4 h-4 rounded text-blue-600 shrink-0"
            checked={selected.has(folder.id)}
            onChange={() => onToggle(folder, fullPath)}
          />
          <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
          </svg>
          <span className="text-sm text-gray-800 truncate">{folder.name}</span>
        </label>

        {folder.folder?.childCount != null && (
          <span className="text-xs text-gray-400 shrink-0 ml-1">{folder.folder.childCount} items</span>
        )}
      </div>

      {/* Children */}
      {expanded && children && children.length > 0 && (
        <div className="border-l border-gray-100 ml-6">
          {children.map((child) => (
            <FolderRow
              key={child.id}
              folder={child}
              depth={depth + 1}
              fullPath={`${fullPath}/${child.name}`}
              selected={selected}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
      {expanded && children && children.length === 0 && (
        <div
          className="py-2 text-xs text-gray-400 italic"
          style={{ paddingLeft: `${16 + (depth + 1) * 20 + 28}px` }}
        >
          No subfolders
        </div>
      )}
    </div>
  );
}

export default function Configure({ user, onBack, onScanStarted }) {
  const [folders, setFolders] = useState([]);
  // selected: Map of id -> { id, name } for all checked folders
  const [selected, setSelected] = useState(new Map());
  const [thoroughScan, setThoroughScan] = useState(true);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);
  const [pastSessions, setPastSessions] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get("/folders"),
      api.get("/sessions"),
    ]).then(([fRes, sRes]) => {
      setFolders(fRes.data.folders);
      setPastSessions(
        sRes.data.sessions.filter((s) => s.status === "complete")
      );
    }).catch(() => {
      setError("Could not load folders. Make sure the backend is running.");
    }).finally(() => setLoading(false));
  }, []);

  function toggleFolder(folder, fullPath) {
    setSelected((prev) => {
      const next = new Map(prev);
      next.has(folder.id) ? next.delete(folder.id) : next.set(folder.id, fullPath);
      return next;
    });
  }

  async function handleStart() {
    if (selected.size === 0) return;
    setStarting(true);
    setError(null);
    try {
      const res = await api.post("/scan/start", {
        folder_ids: [...selected.keys()],
        folder_names: [...selected.values()],
        skip_hash_check: !thoroughScan,
      });
      onScanStarted(res.data.session_id);
    } catch {
      setError("Failed to start scan. Please try again.");
      setStarting(false);
    }
  }

  function handleResume(session) {
    onScanStarted(session.id, true);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading folders...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-2xl p-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button onClick={onBack} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Configure Scan</h1>
            <p className="text-sm text-gray-500">Choose which OneDrive folders to scan for duplicates</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Folder picker */}
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-700 mb-3">Select folders to scan</p>
          {folders.length === 0 ? (
            <p className="text-sm text-gray-500">No folders found in your OneDrive root.</p>
          ) : (
            <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
              {folders.map((folder) => (
                <FolderRow
                  key={folder.id}
                  folder={folder}
                  depth={0}
                  fullPath={folder.name}
                  selected={selected}
                  onToggle={toggleFolder}
                />
              ))}
            </div>
          )}
        </div>

        {/* Options */}
        <div className="mb-8">
          <p className="text-sm font-medium text-gray-700 mb-3">Options</p>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 rounded text-blue-600 mt-0.5"
              checked={thoroughScan}
              onChange={(e) => setThoroughScan(e.target.checked)}
            />
            <div>
              <p className="text-sm text-gray-800">Find all duplicates, even renamed ones (recommended)</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Without this, only files with the exact same name and size are matched.
              </p>
            </div>
          </label>
        </div>

        {/* Start button */}
        <button
          onClick={handleStart}
          disabled={selected.size === 0 || starting}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium py-3 rounded-xl transition-colors"
        >
          {starting
            ? "Starting..."
            : selected.size === 0
            ? "Select at least one folder"
            : `Scan ${selected.size} folder${selected.size > 1 ? "s" : ""}`}
        </button>

        {/* Resume a past session */}
        {pastSessions.length > 0 && (
          <div className="mt-8">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
              Resume a previous scan
            </p>
            <div className="space-y-2">
              {pastSessions.slice(0, 3).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3"
                >
                  <div>
                    <p className="text-sm text-gray-800">
                      {s.folders.map((f) => f.name).join(", ")}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {s.total_files.toLocaleString()} files · {s.total_groups.toLocaleString()} duplicate groups ·{" "}
                      {new Date(s.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleResume(s)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium ml-4 shrink-0"
                  >
                    Resume →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
