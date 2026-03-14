import msal
from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse, JSONResponse
from config import settings

router = APIRouter()

SCOPES = ["Files.Read", "Files.ReadWrite", "User.Read"]
REDIRECT_URI = "http://localhost:8000/auth/callback"

# In-memory token cache — never written to disk.
# Tokens persist for the lifetime of the running server process only.
_token_cache = msal.SerializableTokenCache()

# In-memory store for the OAuth flow state (single user, local app)
_auth_flow: dict = {}


def _get_msal_app() -> msal.PublicClientApplication:
    return msal.PublicClientApplication(
        settings.azure_client_id,
        authority="https://login.microsoftonline.com/consumers",
        token_cache=_token_cache,
    )


def get_access_token() -> str:
    """Get a valid access token, refreshing silently if needed."""
    app = _get_msal_app()
    accounts = app.get_accounts()
    if not accounts:
        raise Exception("Not authenticated")
    result = app.acquire_token_silent(SCOPES, account=accounts[0])
    if not result or "access_token" not in result:
        raise Exception("Could not acquire token silently — user may need to re-authenticate")
    return result["access_token"]


@router.get("/login")
def login():
    """Initiate the OAuth authorization code flow."""
    app = _get_msal_app()
    flow = app.initiate_auth_code_flow(SCOPES, redirect_uri=REDIRECT_URI)
    _auth_flow.update(flow)
    return RedirectResponse(flow["auth_uri"])


@router.get("/callback")
async def callback(request: Request):
    """Handle the OAuth redirect from Microsoft."""
    params = dict(request.query_params)

    if "error" in params:
        return JSONResponse(
            {"error": params.get("error"), "description": params.get("error_description")},
            status_code=400,
        )

    app = _get_msal_app()
    result = app.acquire_token_by_auth_code_flow(_auth_flow, params)

    if "error" in result:
        return JSONResponse(result, status_code=400)

    _auth_flow.clear()
    return RedirectResponse("http://localhost:5173")


@router.get("/status")
def status():
    """Check whether the user is authenticated."""
    app = _get_msal_app()
    accounts = app.get_accounts()
    if accounts:
        result = app.acquire_token_silent(SCOPES, account=accounts[0])
        if result and "access_token" in result:
            return {"authenticated": True, "account": accounts[0].get("username")}
    return {"authenticated": False}


@router.post("/logout")
def logout():
    """Clear stored tokens and log out."""
    global _token_cache
    _token_cache = msal.SerializableTokenCache()
    _auth_flow.clear()
    return {"success": True}
