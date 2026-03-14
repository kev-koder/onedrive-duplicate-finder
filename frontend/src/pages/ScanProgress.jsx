import { useEffect, useRef, useState } from "react";
import api from "../api/client";

const STATUS_LABEL = {
  scanning: "Indexing files…",
  detecting: "Detecting duplicates…",
  complete: "Scan complete",
  cancelled: "Scan cancelled",
  error: "Scan error",
};

export default function ScanProgress({ sessionId, onBack, onComplete }) {
  const [status, setStatus] = useState("scanning");
  const [totalFiles, setTotalFiles] = useState(0);
  const [totalGroups, setTotalGroups] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    poll();
    intervalRef.current = setInterval(poll, 2000);
    return () => clearInterval(intervalRef.current);
  }, [sessionId]);

  async function poll() {
    try {
      const res = await api.get("/scan/status", { params: { session_id: sessionId } });
      const data = res.data;
      setStatus(data.status);
      setTotalFiles(data.total_files);
      setTotalGroups(data.total_groups);
      if (data.status === "complete" || data.status === "cancelled" || data.status === "error") {
        clearInterval(intervalRef.current);
      }
    } catch {
      // backend temporarily unreachable — keep polling
    }
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      await api.post("/scan/cancel");
    } catch {
      // ignore
    }
  }

  const isDone = status === "complete" || status === "cancelled" || status === "error";

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-md p-8">

        {/* Header */}
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-14 h-14 rounded-xl mb-4 ${
            status === "complete" ? "bg-green-600" :
            status === "error" ? "bg-red-500" :
            status === "cancelled" ? "bg-gray-400" :
            "bg-blue-600"
          }`}>
            {status === "complete" ? (
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : status === "error" ? (
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-7 h-7 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
          </div>
          <h1 className="text-xl font-semibold text-gray-900">{STATUS_LABEL[status] ?? status}</h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <p className="text-2xl font-semibold text-gray-900">{totalFiles.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">Files indexed</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <p className="text-2xl font-semibold text-gray-900">{totalGroups.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">Duplicate groups</p>
          </div>
        </div>

        {/* Actions */}
        {status === "complete" && (
          <button
            onClick={() => onComplete(sessionId)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-3 rounded-xl transition-colors mb-3"
          >
            Review duplicates →
          </button>
        )}

        {(status === "cancelled" || status === "error") && (
          <button
            onClick={onBack}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-3 rounded-xl transition-colors mb-3"
          >
            ← Back to setup
          </button>
        )}

        {!isDone && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="w-full text-sm text-gray-500 hover:text-gray-700 py-2 transition-colors disabled:opacity-50"
          >
            {cancelling ? "Cancelling…" : "Cancel scan"}
          </button>
        )}
      </div>
    </div>
  );
}
