import { useState } from "react";
import Connect from "./pages/Connect";
import Configure from "./pages/Configure";
import ScanProgress from "./pages/ScanProgress";
import Review from "./pages/Review";
import Summary from "./pages/Summary";
import ApplyProgress from "./pages/ApplyProgress";

export default function App() {
  const [page, setPage] = useState("connect");
  const [user, setUser] = useState(null);
  const [sessionId, setSessionId] = useState(null);

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

  return (
    <>
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
