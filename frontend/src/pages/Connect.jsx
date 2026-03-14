import { useEffect, useState } from "react";
import api from "../api/client";

export default function Connect({ onAuthenticated }) {
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkStatus();
  }, []);

  async function checkStatus() {
    try {
      const res = await api.get("/auth/status");
      if (res.data.authenticated) {
        const meRes = await api.get("/me");
        setUser(meRes.data);
      }
    } catch {
      setError("Could not reach the backend. Make sure it is running on port 8000.");
    } finally {
      setChecking(false);
    }
  }

  async function handleSignIn() {
    window.location.href = "http://localhost:8000/auth/login";
  }

  async function handleSignOut() {
    await api.post("/auth/logout");
    setUser(null);
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500 text-sm">Checking authentication...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-md p-8">

        {/* Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-xl mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">OneDrive Duplicate Finder</h1>
          <p className="text-sm text-gray-500 mt-1">Find and remove duplicate photos &amp; videos</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {user ? (
          <div>
            {/* Connected account card */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-green-600 flex items-center justify-center text-white text-sm font-medium shrink-0">
                  {user.display_name?.charAt(0).toUpperCase() ?? "?"}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{user.display_name}</p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
                <span className="ml-auto text-xs text-green-700 font-medium shrink-0">Connected</span>
              </div>
            </div>

            {/* Storage quota */}
            <div className="bg-gray-50 rounded-xl p-4 mb-6 text-sm">
              <p className="text-gray-500 font-medium mb-2 text-xs uppercase tracking-wide">OneDrive Storage</p>
              <div className="flex justify-between text-gray-700">
                <span>Used</span><span className="font-medium">{user.quota.used}</span>
              </div>
              <div className="flex justify-between text-gray-700 mt-1">
                <span>Remaining</span><span className="font-medium">{user.quota.remaining}</span>
              </div>
              <div className="flex justify-between text-gray-700 mt-1">
                <span>Total</span><span className="font-medium">{user.quota.total}</span>
              </div>
            </div>

            <button
              onClick={() => onAuthenticated(user)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-3 rounded-xl transition-colors mb-3"
            >
              Continue to Scan Setup →
            </button>
            <button
              onClick={handleSignOut}
              className="w-full text-sm text-gray-500 hover:text-gray-700 py-2 transition-colors"
            >
              Sign out
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-600 text-center mb-6">
              Sign in with the Microsoft account linked to your OneDrive to get started.
            </p>
            <button
              onClick={handleSignIn}
              className="w-full flex items-center justify-center gap-3 border border-gray-300 hover:border-gray-400 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium py-3 rounded-xl transition-colors"
            >
              {/* Microsoft logo */}
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 21 21" fill="none">
                <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
              </svg>
              Sign in with Microsoft
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
