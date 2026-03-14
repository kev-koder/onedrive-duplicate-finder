import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api/client";

const MATCH_TYPE_LABELS = {
  content_hash: "Exact duplicate",
  cross_name: "Renamed copy",
  name_size: "Same name & size",
};

const MATCH_TYPE_COLORS = {
  content_hash: "bg-blue-100 text-blue-700",
  cross_name: "bg-purple-100 text-purple-700",
  name_size: "bg-yellow-100 text-yellow-700",
};

function fmtBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

// ---------------------------------------------------------------------------
// Thumbnail
// ---------------------------------------------------------------------------
function ThumbnailImage({ fileId, lazy }) {
  const [status, setStatus] = useState("loading");
  const [shouldLoad, setShouldLoad] = useState(!lazy);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!lazy) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" } // start loading a little before the card is fully visible
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [lazy]);

  return (
    <div ref={containerRef} className="relative w-full h-56 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
      {!shouldLoad ? (
        <div className="absolute inset-0 bg-gray-200" />
      ) : status === "error" ? (
        <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ) : (
        <>
          {status === "loading" && (
            <div className="absolute inset-0 bg-gray-200 animate-pulse" />
          )}
          <img
            src={`http://localhost:8000/files/${fileId}/thumbnail`}
            className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-200 ${
              status === "loaded" ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => setStatus("loaded")}
            onError={() => setStatus("error")}
            alt=""
          />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// File card
// ---------------------------------------------------------------------------
function FileCard({ file, decision, onDecision, deleteDisabled, lazy }) {
  const isKeep = decision === "keep";
  const isDelete = decision === "delete";
  const isVideo = file.mime_type?.startsWith("video/");
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState(false);

  async function handlePlay() {
    setVideoLoading(true);
    setVideoError(false);
    try {
      const res = await api.get(`/files/${file.id}/stream-url`);
      setVideoUrl(res.data.url);
    } catch {
      setVideoError(true);
    } finally {
      setVideoLoading(false);
    }
  }

  function toggle(action) {
    onDecision(file.id, decision === action ? "pending" : action);
  }

  const folder = file.path.includes("/")
    ? file.path.split("/").slice(0, -1).join("/")
    : "/";

  return (
    <div className={`flex-shrink-0 w-96 border rounded-xl overflow-hidden transition-colors ${
      isDelete ? "border-red-300 bg-red-50"
      : isKeep  ? "border-green-300 bg-green-50"
      : "border-gray-200 bg-white"
    }`}>
      {videoUrl ? (
        <video
          src={videoUrl}
          controls
          autoPlay
          className="w-full rounded-lg bg-black"
        />
      ) : (
        <ThumbnailImage fileId={file.id} lazy={lazy} />
      )}

      {/* Video play button */}
      {isVideo && !videoUrl && (
        <div className="px-3 pt-2">
          <button
            onClick={handlePlay}
            disabled={videoLoading}
            className="w-full flex items-center justify-center gap-2 text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-400 bg-blue-50 hover:bg-blue-100 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {videoLoading ? (
              "Loading…"
            ) : videoError ? (
              "Could not load video"
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Play video
              </>
            )}
          </button>
        </div>
      )}

      <div className="p-3">
        <p className="text-xs font-medium text-gray-900 truncate" title={file.name}>
          {file.name}
        </p>
        <p className="text-xs text-gray-400 break-all mt-0.5">
          {folder}
        </p>
        <p className="text-xs text-gray-500 mt-1">{file.size_display}</p>
        {file.modified_at && (
          <p className="text-xs text-gray-400 mt-0.5">
            <span className="font-medium">File Last Modified:</span>{" "}
            {new Date(file.modified_at).toLocaleDateString()}
          </p>
        )}
        <div className="flex gap-1.5 mt-3">
          <button
            onClick={() => toggle("keep")}
            className={`flex-1 text-xs font-medium py-1.5 rounded-lg transition-colors ${
              isKeep
                ? "bg-green-600 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-700"
            }`}
          >
            Keep
          </button>
          <button
            onClick={() => toggle("delete")}
            disabled={deleteDisabled && !isDelete}
            className={`flex-1 text-xs font-medium py-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
              isDelete
                ? "bg-red-600 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:border-red-400 hover:text-red-700"
            }`}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Group card
// ---------------------------------------------------------------------------
function GroupCard({ group, decisions, onDecision, onSkip, lazy }) {
  const groupStatus = decisions[`group_${group.id}`] ?? group.status;
  const isSkipped = groupStatus === "skipped";
  const [manuallyExpanded, setManuallyExpanded] = useState(false);

  const filDecisions = group.files.map((f) => decisions[f.id] ?? f.decision);
  const keepCount = filDecisions.filter((d) => d === "keep").length;
  const deleteCount = filDecisions.filter((d) => d === "delete").length;

  const isDecided = isSkipped || filDecisions.every((d) => d !== "pending");
  const showCollapsed = isDecided && !manuallyExpanded;

  const markedDeleteCount = deleteCount;
  // Prevent deleting the last remaining copy
  const deleteDisabled = markedDeleteCount >= group.files.length - 1;

  // Collapsed single-line view
  if (showCollapsed) {
    const summary = isSkipped
      ? "Skipped"
      : [
          keepCount > 0 && `${keepCount} keep`,
          deleteCount > 0 && `${deleteCount} delete`,
        ]
          .filter(Boolean)
          .join(" · ");

    return (
      <div
        id={`group-${group.id}`}
        className="scroll-mt-64 border border-gray-200 rounded-2xl bg-white cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setManuallyExpanded(true)}
      >
        <div className="flex items-center gap-3 px-4 py-2.5">
          <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${MATCH_TYPE_COLORS[group.match_type]}`}>
            {MATCH_TYPE_LABELS[group.match_type]}
          </span>
          <span className="text-xs text-gray-400">{group.file_count} copies · {group.total_size}</span>
          <span className="text-xs text-gray-500 ml-auto">{summary}</span>
          <svg className="w-3.5 h-3.5 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div id={`group-${group.id}`} className={`scroll-mt-64 border rounded-2xl overflow-hidden transition-opacity ${
      isSkipped ? "opacity-40" : "border-gray-200"
    }`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${MATCH_TYPE_COLORS[group.match_type]}`}>
          {MATCH_TYPE_LABELS[group.match_type]}
        </span>
        <span className="text-xs text-gray-500">
          {group.file_count} copies · {group.total_size}
        </span>
        <div className="ml-auto flex items-center gap-3">
          {isDecided && (
            <button
              onClick={() => setManuallyExpanded(false)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Collapse
            </button>
          )}
          {isSkipped ? (
            <button
              onClick={() => onSkip(group.id, "open")}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              Undo skip
            </button>
          ) : (
            <button
              onClick={() => onSkip(group.id, "skipped")}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Skip
            </button>
          )}
        </div>
      </div>

      {/* File cards */}
      {!isSkipped && (
        <div className="p-4 flex gap-3 overflow-x-auto">
          {group.files.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              decision={decisions[file.id] ?? file.decision}
              onDecision={onDecision}
              deleteDisabled={deleteDisabled}
              lazy={lazy}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bulk decision panel
// ---------------------------------------------------------------------------
function BulkPanel({ groups, decisions, sessionId, onApplied }) {
  const [open, setOpen] = useState(false);
  const [keepFolder, setKeepFolder] = useState("");
  const [deleteFolder, setDeleteFolder] = useState("");
  const [applying, setApplying] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  function getFolder(path) {
    return path.includes("/") ? path.split("/").slice(0, -1).join("/") : "";
  }

  // Unique folders across all files in all groups, sorted
  const allFolders = [...new Set(
    groups.flatMap((g) => g.files.map((f) => getFolder(f.path)))
  )].sort();

  // Live preview: how many groups will be affected
  const affectedCount = groups.filter((g) => {
    const status = decisions[`group_${g.id}`] ?? g.status;
    if (status === "skipped") return false;
    if (!keepFolder || !deleteFolder) return false;
    const hasKeep = g.files.some((f) => getFolder(f.path) === keepFolder);
    const hasDel = g.files.some((f) => getFolder(f.path) === deleteFolder);
    return hasKeep && hasDel;
  });

  async function handleApply() {
    if (!keepFolder || !deleteFolder || keepFolder === deleteFolder) return;
    setApplying(true);
    setLastResult(null);
    try {
      const res = await api.post("/bulk-decision", {
        session_id: sessionId,
        keep_folder: keepFolder,
        delete_folder: deleteFolder,
      });

      // Update local decisions state to match what the backend just wrote
      const updated = {};
      groups.forEach((g) => {
        const status = decisions[`group_${g.id}`] ?? g.status;
        if (status === "skipped") return;
        const keepFiles = g.files.filter((f) => getFolder(f.path) === keepFolder);
        const deleteFiles = g.files.filter((f) => getFolder(f.path) === deleteFolder);
        if (keepFiles.length > 0 && deleteFiles.length > 0) {
          keepFiles.forEach((f) => { updated[f.id] = "keep"; });
          deleteFiles.forEach((f) => { updated[f.id] = "delete"; });
        }
      });

      onApplied(updated);
      setLastResult(res.data.groups_updated);
    } catch {
      setLastResult(-1); // error sentinel
    } finally {
      setApplying(false);
    }
  }

  const canApply = keepFolder && deleteFolder && keepFolder !== deleteFolder && affectedCount.length > 0;

  return (
    <div className="mt-4 border border-gray-200 rounded-2xl overflow-hidden bg-white">
      <button
        onClick={() => { setOpen((o) => !o); setLastResult(null); }}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 6h16M4 12h8m-8 6h16" />
          </svg>
          <span className="text-sm font-medium text-gray-800">Bulk decision by folder</span>
          <span className="text-xs text-gray-400">— decide many groups at once</span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 py-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Keep files in
              </label>
              <select
                value={keepFolder}
                onChange={(e) => setKeepFolder(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-green-400"
              >
                <option value="">Select a folder…</option>
                {allFolders.map((f) => (
                  <option key={f} value={f} disabled={f === deleteFolder}>
                    {f === "" ? "(root)" : f}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Delete files in
              </label>
              <select
                value={deleteFolder}
                onChange={(e) => setDeleteFolder(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-red-400"
              >
                <option value="">Select a folder…</option>
                {allFolders.map((f) => (
                  <option key={f} value={f} disabled={f === keepFolder}>
                    {f === "" ? "(root)" : f}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {!keepFolder || !deleteFolder ? (
                "Select both folders to see how many groups will be affected."
              ) : keepFolder === deleteFolder ? (
                <span className="text-red-500">Keep and delete folders must be different.</span>
              ) : (
                <>
                  <span className="font-medium text-gray-900">{affectedCount.length}</span>
                  {" "}group{affectedCount.length !== 1 ? "s" : ""} will be updated.
                </>
              )}
            </span>
            <div className="flex items-center gap-3">
              {lastResult === -1 && (
                <span className="text-xs text-red-500">Something went wrong. Try again.</span>
              )}
              {lastResult > 0 && (
                <span className="text-xs text-green-600">
                  ✓ Applied to {lastResult} group{lastResult !== 1 ? "s" : ""}.
                </span>
              )}
              {lastResult === 0 && (
                <span className="text-xs text-gray-400">No matching groups found.</span>
              )}
              <button
                onClick={handleApply}
                disabled={!canApply || applying}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
              >
                {applying ? "Applying…" : "Apply to all"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ---------------------------------------------------------------------------
// Review page
// ---------------------------------------------------------------------------
export default function Review({ sessionId, onBack, onSummary }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [decisions, setDecisions] = useState({});
  // Tracks which group cards are currently visible in the viewport
  const visibleGroupIds = useRef(new Set());

  useEffect(() => {
    api.get("/groups", { params: { session_id: sessionId } })
      .then((res) => {
        const gs = res.data.groups;
        setGroups(gs);
        // Seed decisions from saved DB state
        const init = {};
        gs.forEach((g) => {
          init[`group_${g.id}`] = g.status;
          g.files.forEach((f) => { init[f.id] = f.decision; });
        });
        setDecisions(init);
      })
      .catch(() => setError("Could not load duplicate groups."))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const handleDecision = useCallback(async (fileId, decision) => {
    const group = groups.find((g) => g.files.some((f) => f.id === fileId));
    if (!group) return;
    try {
      await api.patch(`/groups/${group.id}/files/${fileId}`, { decision });
      setDecisions((prev) => ({ ...prev, [fileId]: decision }));
    } catch {
      // silently ignore — a retry/toast can be added later
    }
  }, [groups]);

  const handleSkip = useCallback(async (groupId, status) => {
    try {
      await api.patch(`/groups/${groupId}`, { status });
      setDecisions((prev) => ({ ...prev, [`group_${groupId}`]: status }));
    } catch {
      // ignore
    }
  }, []);

  const handleBulkApplied = useCallback((updated) => {
    setDecisions((prev) => ({ ...prev, ...updated }));
  }, []);

  // ---------------------------------------------------------------------------
  // Derived stats
  // ---------------------------------------------------------------------------
  const allFiles = groups.flatMap((g) => g.files);

  const toDeleteFiles = allFiles.filter(
    (f) => (decisions[f.id] ?? f.decision) === "delete"
  );
  const recoverableBytes = toDeleteFiles.reduce((sum, f) => sum + f.size, 0);

  const reviewedCount = groups.filter((g) => {
    const s = decisions[`group_${g.id}`] ?? g.status;
    if (s === "skipped") return true;
    return g.files.some((f) => (decisions[f.id] ?? f.decision) !== "pending");
  }).length;

  // ---------------------------------------------------------------------------
  // Filtered + sorted groups (largest total size first)
  // ---------------------------------------------------------------------------
  const sorted = [...groups].sort((a, b) => {
    const aBytes = a.files.reduce((s, f) => s + f.size, 0);
    const bBytes = b.files.reduce((s, f) => s + f.size, 0);
    return bBytes - aBytes;
  });

  const filtered =
    filter === "all" ? sorted : sorted.filter((g) => g.match_type === filter);

  // ---------------------------------------------------------------------------
  // Uncategorized navigation
  // ---------------------------------------------------------------------------
  // A group is uncategorized if it isn't skipped and every file is still pending
  const uncategorized = filtered.filter((g) => {
    const status = decisions[`group_${g.id}`] ?? g.status;
    if (status === "skipped") return false;
    return g.files.every((f) => (decisions[f.id] ?? f.decision) === "pending");
  });

  // Watch which group cards enter/leave the viewport as the user scrolls
  useEffect(() => {
    if (filtered.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = parseInt(entry.target.id.replace("group-", ""));
          if (entry.isIntersecting) {
            visibleGroupIds.current.add(id);
          } else {
            visibleGroupIds.current.delete(id);
          }
        });
      },
      { threshold: 0.1 } // card counts as visible when 10% is on screen
    );
    filtered.forEach((g) => {
      const el = document.getElementById(`group-${g.id}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [filtered]);

  function scrollToGroup(groupId) {
    document.getElementById(`group-${groupId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function goToNext() {
    if (uncategorized.length === 0) return;
    // Build an index-lookup map so we can compare positions in O(1)
    const idxMap = new Map(filtered.map((g, i) => [g.id, i]));
    // Anchor = the bottommost group currently visible on screen
    let anchorIdx = -1;
    visibleGroupIds.current.forEach((id) => {
      const idx = idxMap.get(id) ?? -1;
      if (idx > anchorIdx) anchorIdx = idx;
    });
    // First uncategorized group that appears after the anchor
    const target = uncategorized.find((g) => (idxMap.get(g.id) ?? 0) > anchorIdx);
    if (target) scrollToGroup(target.id);
  }

  function goToPrev() {
    if (uncategorized.length === 0) return;
    const idxMap = new Map(filtered.map((g, i) => [g.id, i]));
    // Anchor = the topmost group currently visible on screen
    let anchorIdx = filtered.length;
    visibleGroupIds.current.forEach((id) => {
      const idx = idxMap.get(id) ?? filtered.length;
      if (idx < anchorIdx) anchorIdx = idx;
    });
    // Last uncategorized group that appears before the anchor
    const candidates = uncategorized.filter((g) => (idxMap.get(g.id) ?? 0) < anchorIdx);
    const target = candidates[candidates.length - 1];
    if (target) scrollToGroup(target.id);
  }

  const countByType = {
    content_hash: groups.filter((g) => g.match_type === "content_hash").length,
    cross_name: groups.filter((g) => g.match_type === "cross_name").length,
    name_size: groups.filter((g) => g.match_type === "name_size").length,
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading duplicate groups…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-500 text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="max-w-6xl mx-auto">

          {/* Title row */}
          <div className="flex items-center gap-4 mb-4">
            <button onClick={onBack} className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-gray-900 flex-1">Review Duplicates</h1>

            {/* Stats */}
            <div className="flex items-center gap-6 text-sm">
              <span className="text-gray-500">
                <span className="font-semibold text-gray-900">{reviewedCount}</span>
                <span> / {groups.length} reviewed</span>
              </span>
              <span className="text-gray-500">
                <span className="font-semibold text-red-600">{toDeleteFiles.length}</span>
                <span> to delete</span>
              </span>
              <span className="text-gray-500">
                <span className="font-semibold text-green-600">{fmtBytes(recoverableBytes)}</span>
                <span> recoverable</span>
              </span>
            </div>

            <button
              onClick={onSummary}
              disabled={toDeleteFiles.length === 0}
              title={toDeleteFiles.length === 0 ? "Mark at least one file for deletion first" : ""}
              className="ml-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors shrink-0"
            >
              View Summary →
            </button>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 flex-wrap">
            {[
              { key: "all", label: `All (${groups.length})` },
              { key: "content_hash", label: `Exact duplicates (${countByType.content_hash})` },
              { key: "cross_name", label: `Renamed copies (${countByType.cross_name})` },
              { key: "name_size", label: `Same name & size (${countByType.name_size})` },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                  filter === tab.key
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Uncategorized navigation */}
          <div className="flex items-center gap-3 mt-3">
            <span className="text-xs text-gray-500">
              {uncategorized.length === 0 ? (
                <span className="text-green-600 font-medium">All groups categorized</span>
              ) : (
                <>
                  <span className="font-medium text-gray-900">{uncategorized.length}</span>
                  {" "}uncategorized group{uncategorized.length !== 1 ? "s" : ""} remaining
                </>
              )}
            </span>
            <div className="flex gap-1.5">
              <button
                onClick={goToPrev}
                disabled={uncategorized.length === 0}
                className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
                Prev
              </button>
              <button
                onClick={goToNext}
                disabled={uncategorized.length === 0}
                className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          <BulkPanel
            groups={groups}
            decisions={decisions}
            sessionId={sessionId}
            onApplied={handleBulkApplied}
          />
        </div>
      </div>

      {/* Group list */}
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-4">
        {filtered.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-16">
            No groups match this filter.
          </div>
        ) : (
          filtered.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              decisions={decisions}
              onDecision={handleDecision}
              onSkip={handleSkip}
              lazy={groups.length >= 100}
            />
          ))
        )}
      </div>
    </div>
  );
}
