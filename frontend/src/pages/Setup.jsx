import { useState } from "react";
import api from "../api/client";

const STEPS = [
  {
    number: 1,
    title: "Sign in to the Azure portal",
    body: (
      <>
        If you are new to Azure, go to{" "}
        <a href="https://portal.azure.com/" target="_blank" rel="noreferrer"
          className="text-blue-600 hover:underline">
          portal.azure.com
        </a>{" "}
        where you can start with a free account. If you previously had an Azure account that has
        since expired or been deactivated, go to{" "}
        <a href="https://entra.microsoft.com/" target="_blank" rel="noreferrer"
          className="text-blue-600 hover:underline">
          entra.microsoft.com
        </a>{" "}
        instead — it works with any active Microsoft account and does not require an Azure
        subscription. Sign in with the same Microsoft account you use for OneDrive.
      </>
    ),
  },
  {
    number: 2,
    title: "Register a new application",
    body: (
      <>
        In the left sidebar, go to <strong>Applications → App registrations</strong>, then click{" "}
        <strong>+ New registration</strong>. Enter any name you like (e.g. <em>OneDrive Duplicate Finder</em>).
        Under <strong>Supported account types</strong> choose{" "}
        <strong>Personal Microsoft accounts only</strong>. Leave the Redirect URI blank and click{" "}
        <strong>Register</strong>.{" "}
        <a href="https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app"
          target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
          Learn more
        </a>
      </>
    ),
  },
  {
    number: 3,
    title: "Add API permissions",
    body: (
      <>
        In your new app, go to <strong>API permissions → + Add a permission → Microsoft Graph →
        Delegated permissions</strong>. Search for and add <strong>Files.Read</strong> and{" "}
        <strong>Files.ReadWrite</strong>, then click <strong>Add permissions</strong>.{" "}
        <a href="https://learn.microsoft.com/en-us/graph/permissions-reference"
          target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
          Learn more
        </a>
      </>
    ),
  },
  {
    number: 4,
    title: "Configure the authentication platform",
    body: (
      <>
        Go to <strong>Authentication → + Add a platform → Mobile and desktop applications</strong>.
        In the custom redirect URI field enter exactly:{" "}
        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">
          http://localhost:8000/auth/callback
        </code>
        . Click <strong>Configure</strong>. Then scroll down and enable{" "}
        <strong>Allow public client flows</strong>, and click <strong>Save</strong>.
      </>
    ),
  },
  {
    number: 5,
    title: "Copy your Application (client) ID",
    body: (
      <>
        Go to <strong>Overview</strong>. You will see <strong>Application (client) ID</strong> — a
        long code that looks like <em>xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx</em>. Copy it and paste
        it into the field below.
      </>
    ),
  },
];

export default function Setup({ onConfigured }) {
  const [clientId, setClientId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  async function handleSave() {
    if (!clientId.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.post("/setup/configure", { client_id: clientId.trim() });
      setSaved(true);
    } catch {
      setError("Could not save the Client ID. Make sure the backend is running.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-2xl p-8">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-xl mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Welcome to OneDrive Duplicate Finder</h1>
          <p className="text-sm text-gray-500 mt-2">
            This is a one-time setup. You need to register a free app in Microsoft Azure so this
            tool can access your OneDrive on your behalf.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-5 mb-8">
          {STEPS.map((step) => (
            <div key={step.number} className="flex gap-4">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-semibold flex items-center justify-center mt-0.5">
                {step.number}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 mb-0.5">{step.title}</p>
                <p className="text-sm text-gray-600 leading-relaxed">{step.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Client ID input */}
        {!saved ? (
          <div>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Paste your Application (client) ID
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Your Client ID will be saved to a configuration file on your local computer. It is
              not a password or secret, but it is personal to your Azure app registration — so
              treat it like you would any personal account detail: fine to keep on your own machine,
              but no need to share it with others.
            </p>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-blue-400 mb-4"
            />
            <button
              onClick={handleSave}
              disabled={!clientId.trim() || saving}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium py-3 rounded-xl transition-colors"
            >
              {saving ? "Saving…" : "Save and continue"}
            </button>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
            <svg className="w-8 h-8 text-green-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm font-semibold text-gray-900 mb-1">Setup complete!</p>
            <p className="text-sm text-gray-600">
              Please close the app and run <strong>start.bat</strong> again to apply the changes.
              After restarting you will be taken directly to the sign-in screen.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
