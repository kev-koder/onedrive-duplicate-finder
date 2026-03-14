import httpx
from auth import get_access_token

GRAPH_BASE = "https://graph.microsoft.com/v1.0"

# Fields fetched for every item during a folder scan
_SCAN_SELECT = "id,name,size,file,folder,fileSystemInfo"


def _headers() -> dict:
    return {"Authorization": f"Bearer {get_access_token()}"}


async def get_me() -> dict:
    """Get the signed-in user's profile."""
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{GRAPH_BASE}/me", headers=_headers())
        r.raise_for_status()
        return r.json()


async def get_drive_quota() -> dict:
    """Get the user's OneDrive storage quota."""
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{GRAPH_BASE}/me/drive", headers=_headers())
        r.raise_for_status()
        data = r.json()
        return data.get("quota", {})


async def list_root_folders() -> list:
    """List top-level folders in the user's OneDrive."""
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{GRAPH_BASE}/me/drive/root/children",
            headers=_headers(),
            params={"$filter": "folder ne null", "$select": "id,name,folder,size"},
        )
        r.raise_for_status()
        return r.json().get("value", [])


async def get_stream_url(onedrive_id: str) -> str:
    """Return a pre-authenticated streaming URL for a file (video or photo)."""
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{GRAPH_BASE}/me/drive/items/{onedrive_id}",
            headers=_headers(),
            params={"$select": "id,@microsoft.graph.downloadUrl"},
        )
        r.raise_for_status()
        return r.json().get("@microsoft.graph.downloadUrl", "")


async def get_thumbnail_url(onedrive_id: str) -> str | None:
    """Return a pre-authenticated thumbnail URL for a file, or None if unavailable."""
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{GRAPH_BASE}/me/drive/items/{onedrive_id}/thumbnails",
            headers=_headers(),
        )
        r.raise_for_status()
        sets = r.json().get("value", [])
        if not sets:
            return None
        sizes = sets[0]
        for size in ("medium", "small", "large"):
            url = sizes.get(size, {}).get("url")
            if url:
                return url
        return None


async def list_folder_items(folder_id: str) -> list:
    """List all direct children of a folder, following pagination automatically."""
    items = []
    url = f"{GRAPH_BASE}/me/drive/items/{folder_id}/children"
    params = {"$select": _SCAN_SELECT, "$top": 200}

    async with httpx.AsyncClient() as client:
        while url:
            r = await client.get(url, headers=_headers(), params=params)
            r.raise_for_status()
            data = r.json()
            items.extend(data.get("value", []))
            url = data.get("@odata.nextLink")
            params = None  # nextLink already encodes the query params

    return items
