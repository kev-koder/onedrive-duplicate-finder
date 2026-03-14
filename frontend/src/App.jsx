import { useEffect, useState } from "react";
import api from "./api/client";
import Setup from "./pages/Setup";
import Connect from "./pages/Connect";
import Configure from "./pages/Configure";
import ScanProgress from "./pages/ScanProgress";
import Review from "./pages/Review";
import Summary from "./pages/Summary";
import ApplyProgress from "./pages/ApplyProgress";

export default function App() {
  const [page, setPage] = useState("loading");
  const [user, setUser] = useState(null);
  const [sessionId, setSessionId] = useState(null);

  useEffect(() => {
    api.get("/setup/status")
      .then((res) => setPage(res.data.configured ? "connect" : "setup"))
      .catch(() => setPage("connect")); // if backend unreachable, let Connect handle the error
  }, []);

  function handleAuthenticated(userData) {
    setUser(userData);
    setPage("configure");
  }

  function handleScanStarted(sid) {
    setSessionId(sid);
    setPage("scan");
  }

  function handleScanComplete(sid) {
    setSessionId(sid);
    setPage("review");
  }

  if (page === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Starting…</div>
      </div>
    );
  }

  return (
    <>
      {page === "setup" && (
        <Setup onConfigured={() => setPage("connect")} />
      )}
      {page === "connect" && (
        <Connect onAuthenticated={handleAuthenticated} />
      )}
      {page === "configure" && (
        <Configure
          user={user}
          onBack={() => setPage("connect")}
          onScanStarted={handleScanStarted}
        />
      )}
      {page === "scan" && (
        <ScanProgress
          sessionId={sessionId}
          onBack={() => setPage("configure")}
          onComplete={handleScanComplete}
        />
      )}
      {page === "review" && (
        <Review
          sessionId={sessionId}
          onBack={() => setPage("configure")}
          onSummary={() => setPage("summary")}
        />
      )}
      {page === "summary" && (
        <Summary
          sessionId={sessionId}
          onBack={() => setPage("review")}
          onConfirm={() => setPage("applying")}
        />
      )}
      {page === "applying" && (
        <ApplyProgress
          onDone={() => setPage("configure")}
        />
      )}
    </>
  );
}
