import { useEffect, useState } from "react";
import api from "../api/client";

function fmtBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default function Summary({ sessionId, onBack, onConfirm }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    api.get("/summary", { params: { session_id: sessionId } })
      .then((res) => setData(res.data))
      .catch(() => setError("Could not load summary."))
      .finally(() => setLoading(false));
  }, [sessionId]);

  // Group files by folder for display
  const byFolder = data
    ? data.files.reduce((acc, file) => {
        const folder = file.path.includes("/")
          ? file.path.split("/").slice(0, -1).join("/")
          : "(root)";
        if (!acc[folder]) acc[folder] = [];
        acc[folder].push(file);
        return acc;
      }, {})
    : {};

  async function handleConfirm() {
    setStarting(true);
    try {
      await api.post("/apply", { session_id: sessionId });
      onConfirm();
    } catch {
      setError("Failed to start deletion. Please try again.");
      setStarting(false);
      setConfirming(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading summary…</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-500 text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <button onClick={onBack} className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-gray-900">Deletion Summary</h1>
            <p className="text-sm text-gray-500">Review everything before sending to the Recycle Bin</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6">

        {/* Totals card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Files to delete</p>
              <p className="text-3xl font-semibold text-gray-900">{data.total_count.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Space to recover</p>
              <p className="text-3xl font-semibold text-green-600">{data.total_size}</p>
            </div>
          </div>

          {/* Recycle Bin notice */}
          <div className="mt-5 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
            <p className="font-medium mb-1">Files go to OneDrive's Recycle Bin — not permanently deleted.</p>
            <p className="text-blue-700">
              You can recover them for up to 30 days at{" "}
              <span className="font-medium">onedrive.live.com</span> or through File Explorer
              under OneDrive → Recycle Bin.
            </p>
          </div>
        </div>

        {/* Files grouped by folder */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-6">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Files marked for deletion</p>
          </div>
          <div className="divide-y divide-gray-100">
            {Object.entries(byFolder).sort(([a], [b]) => a.localeCompare(b)).map(([folder, files]) => {
              const folderBytes = files.reduce((s, f) => s + (f.size || 0), 0);
              return (
                <div key={folder}>
                  {/* Folder header */}
                  <div className="flex items-center justify-between px-5 py-2.5 bg-gray-50 border-b border-gray-100">
                    <span className="text-xs font-semibold text-gray-700">{folder}</span>
                    <span className="text-xs text-gray-400">
                      {files.length} file{files.length !== 1 ? "s" : ""} · {fmtBytes(folderBytes)}
                    </span>
                  </div>
                  {/* Files */}
                  {files.map((file) => (
                    <div key={file.id} className="flex items-center justify-between px-5 py-2.5">
                      <span className="text-sm text-gray-800">{file.name}</span>
                      <span className="text-xs text-gray-400 ml-4 shrink-0">{file.size_display}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Confirmation step */}
        {!confirming ? (
          <div className="flex justify-between">
            <button
              onClick={onBack}
              className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2.5 rounded-xl transition-colors"
            >
              ← Back to Review
            </button>
            <button
              onClick={() => setConfirming(true)}
              disabled={data.total_count === 0}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium px-6 py-2.5 rounded-xl transition-colors"
            >
              Send to Recycle Bin →
            </button>
          </div>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
            <p className="text-sm font-semibold text-red-800 mb-1">
              Are you sure you want to delete {data.total_count.toLocaleString()} files?
            </p>
            <p className="text-sm text-red-700 mb-4">
              They will be moved to OneDrive's Recycle Bin. You can recover them from there if needed.
            </p>
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => setConfirming(false)}
                disabled={starting}
                className="flex-1 bg-white border border-gray-300 hover:border-gray-400 text-gray-700 text-sm font-medium py-2.5 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={starting}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
              >
                {starting ? "Starting…" : "Move them to OneDrive's Recycle Bin"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
