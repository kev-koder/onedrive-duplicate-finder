import { useEffect, useRef, useState } from "react";
import api from "../api/client";

export default function ApplyProgress({ onDone }) {
  const [progress, setProgress] = useState({
    status: "deleting",
    total: 0,
    succeeded: 0,
    failed: 0,
    failures: [],
  });
  const intervalRef = useRef(null);

  useEffect(() => {
    poll();
    intervalRef.current = setInterval(poll, 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  async function poll() {
    try {
      const res = await api.get("/apply/status");
      setProgress(res.data);
      if (res.data.status === "complete") {
        clearInterval(intervalRef.current);
      }
    } catch {
      // keep polling
    }
  }

  const { status, total, succeeded, failed, failures } = progress;
  const processed = succeeded + failed;
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
  const isComplete = status === "complete";

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm w-full max-w-lg p-8">

        {/* Icon */}
        <div className="text-center mb-6">
          <div className={`inline-flex items-center justify-center w-14 h-14 rounded-xl mb-4 ${
            isComplete && failed === 0 ? "bg-green-600" :
            isComplete && failed > 0   ? "bg-yellow-500" :
            "bg-blue-600"
          }`}>
            {isComplete && failed === 0 ? (
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : isComplete ? (
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
              </svg>
            ) : (
              <svg className="w-7 h-7 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
          </div>
          <h1 className="text-xl font-semibold text-gray-900">
            {!isComplete
              ? "Sending to Recycle Bin…"
              : failed === 0
              ? "All done!"
              : "Completed with some errors"}
          </h1>
          {!isComplete && (
            <p className="text-sm text-gray-500 mt-1">Do not close this window.</p>
          )}
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>{processed.toLocaleString()} of {total.toLocaleString()} files</span>
            <span>{pct}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
            <p className="text-2xl font-semibold text-green-700">{succeeded.toLocaleString()}</p>
            <p className="text-xs text-green-600 mt-0.5">Moved to Recycle Bin</p>
          </div>
          <div className={`border rounded-xl p-4 text-center ${
            failed > 0 ? "bg-red-50 border-red-100" : "bg-gray-50 border-gray-100"
          }`}>
            <p className={`text-2xl font-semibold ${failed > 0 ? "text-red-600" : "text-gray-400"}`}>
              {failed.toLocaleString()}
            </p>
            <p className={`text-xs mt-0.5 ${failed > 0 ? "text-red-500" : "text-gray-400"}`}>Failed</p>
          </div>
        </div>

        {/* Failure list */}
        {isComplete && failures.length > 0 && (
          <div className="mb-6 border border-red-200 rounded-xl overflow-hidden">
            <div className="bg-red-50 px-4 py-2.5 border-b border-red-200">
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">
                Files that could not be deleted
              </p>
            </div>
            <div className="divide-y divide-red-100 max-h-48 overflow-y-auto">
              {failures.map((f, i) => (
                <div key={i} className="px-4 py-2.5">
                  <p className="text-sm text-gray-800">{f.name}</p>
                  <p className="text-xs text-red-500 mt-0.5">{f.error}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Done button */}
        {isComplete && (
          <button
            onClick={onDone}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-3 rounded-xl transition-colors"
          >
            Start a new scan
          </button>
        )}
      </div>
    </div>
  );
}
