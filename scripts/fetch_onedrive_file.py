#!/usr/bin/env python3
"""
Download the roster workbook from an anonymous OneDrive/SharePoint share link.

Same technique proven to work in the sibling pga_simulator project's
tools/build_slate.py: plain `requests.get(url, allow_redirects=True)` succeeds
where curl doesn't, because requests carries cookies across the redirect
chain automatically. Reads the share URL from $BCIV_TRACKER and writes the
raw bytes to data/BCIV_Draft.xlsx.
"""
import base64
import os
import sys

import requests

OUT_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "BCIV_Draft.xlsx")


def onedrive_share_to_download(url: str) -> str:
    """Convert an anonymous OneDrive/SharePoint share link to a direct-content URL."""
    b64 = base64.urlsafe_b64encode(url.encode("utf-8")).decode("utf-8").rstrip("=")
    return "https://api.onedrive.com/v1.0/shares/u!" + b64 + "/root/content"


def fetch_workbook(url: str) -> bytes:
    for candidate in (url, url + ("&" if "?" in url else "?") + "download=1", onedrive_share_to_download(url)):
        try:
            r = requests.get(candidate, allow_redirects=True, timeout=60)
            if r.ok and r.content[:2] == b"PK":  # xlsx files are zip archives
                print(f"Downloaded workbook from {candidate[:60]}... ({len(r.content)} bytes)")
                return r.content
        except Exception as e:  # noqa: BLE001
            print(f"  fetch attempt failed: {e}")
    raise SystemExit(
        "ERROR: BCIV_TRACKER set but no valid workbook downloaded. "
        "Make sure the link is 'anyone with the link can view'."
    )


def main():
    url = os.environ.get("BCIV_TRACKER", "").strip()
    if not url:
        print("::error::BCIV_TRACKER secret is not set", file=sys.stderr)
        sys.exit(1)

    content = fetch_workbook(url)
    with open(OUT_PATH, "wb") as fh:
        fh.write(content)
    print(f"Wrote {OUT_PATH} ({len(content)} bytes)")


if __name__ == "__main__":
    main()
