#!/usr/bin/env python3
import os, sys, json, re, urllib.request, urllib.parse

GITHUB_REPOSITORY = os.environ.get("GITHUB_REPOSITORY")  # owner/repo
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")            # provided by Actions
YOUTUBE_API_KEY = os.environ.get("YOUTUBE_API_KEY")

API_GH = "https://api.github.com"
API_YT = "https://www.googleapis.com/youtube/v3"

LABEL_OK  = "Verified ✅"
LABEL_BAD = "Needs verification ❌"

HDRS = {
    "Authorization": f"token {GITHUB_TOKEN}",
    "Accept": "application/vnd.github+json",
    "User-Agent": "aigc-verify-token-bot"
}

def gh(url, method="GET", data=None):
    body = None
    if data is not None:
        body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, headers=HDRS, method=method)
    with urllib.request.urlopen(req) as r:
        txt = r.read().decode()
        return r.getcode(), json.loads(txt) if txt.strip() else None

def get_issue(num):
    code, j = gh(f"{API_GH}/repos/{GITHUB_REPOSITORY}/issues/{num}")
    return j

def list_open_registration_issues():
    q = urllib.parse.quote(f"repo:{GITHUB_REPOSITORY} is:issue is:open label:registration")
    code, j = gh(f"{API_GH}/search/issues?q={q}")
    return [item["number"] for item in j.get("items", [])]

def ensure_labels():
    # ensure both labels exist (idempotent)
    for name, color, desc in [
        (LABEL_OK,  "2ea043", "Token found in playlist description"),
        (LABEL_BAD, "d1242f", "Token not found yet in playlist description"),
    ]:
        try:
            gh(f"{API_GH}/repos/{GITHUB_REPOSITORY}/labels/{urllib.parse.quote(name)}")
        except Exception:
            pass  # GET may throw for 404; we'll try create anyway
        try:
            gh(f"{API_GH}/repos/{GITHUB_REPOSITORY}/labels", "POST",
               {"name": name, "color": color, "description": desc})
        except Exception:
            pass  # already exists

def add_labels(num, labels):
    gh(f"{API_GH}/repos/{GITHUB_REPOSITORY}/issues/{num}/labels", "POST", {"labels": labels})

def replace_label(num, new_label):
    issue = get_issue(num)
    existing = [l["name"] for l in issue.get("labels", []) if l and "name" in l]
    # remove opposite label
    if new_label == LABEL_OK and LABEL_BAD in existing:
        try: gh(f"{API_GH}/repos/{GITHUB_REPOSITORY}/issues/{num}/labels/{urllib.parse.quote(LABEL_BAD)}", "DELETE")
        except Exception: pass
    if new_label == LABEL_BAD and LABEL_OK in existing:
        try: gh(f"{API_GH}/repos/{GITHUB_REPOSITORY}/issues/{num}/labels/{urllib.parse.quote(LABEL_OK)}", "DELETE")
        except Exception: pass
    if new_label not in existing:
        add_labels(num, [new_label])

def comment(num, body):
    gh(f"{API_GH}/repos/{GITHUB_REPOSITORY}/issues/{num}/comments", "POST", {"body": body})

def extract_fields(md):
    # Грубый парсер по нашим секциям Issue Form
    def get_after(header):
        # ищем "### Header" и берём следующую непустую строку
        rx = re.compile(rf"^### {re.escape(header)}\s*\n([^#][\s\S]*?)(?:\n### |\Z)", re.M)
        m = rx.search(md)
        if not m: return ""
        val = m.group(1).strip()
        # берём первую строку/URL
        return val.splitlines()[0].strip()
    playlist = get_after("Season playlist URL")
    token    = get_after("Verification token")
    return playlist, token

def extract_playlist_id(url):
    try:
        u = urllib.parse.urlparse(url)
        qs = urllib.parse.parse_qs(u.query)
        if "list" in qs:
            return qs["list"][0]
        # иногда дают короткую форму без query — попробуем из пути
        # /playlist?list=... — основной кейс
        # запасной: если передали сам ID, примем его
        if re.fullmatch(r"PL[\w-]{10,}", url):
            return url
    except Exception:
        pass
    return None

def get_playlist_description(pl_id):
    url = f"{API_YT}/playlists?part=snippet&id={urllib.parse.quote(pl_id)}&key={YOUTUBE_API_KEY}"
    with urllib.request.urlopen(url) as r:
        j = json.loads(r.read().decode())
    items = j.get("items", [])
    if not items: return None
    return items[0]["snippet"].get("description", "") or ""

def verify_issue(num):
    issue = get_issue(num)
    body  = issue.get("body", "") or ""
    playlist_url, token = extract_fields(body)
    if not playlist_url or not token:
        replace_label(num, LABEL_BAD)
        comment(num, "❌ Could not find playlist URL or verification token in the issue body. Please ensure both are present.")
        return False

    pl_id = extract_playlist_id(playlist_url)
    if not pl_id:
        replace_label(num, LABEL_BAD)
        comment(num, f"❌ Could not parse playlist ID from URL:\n```\n{playlist_url}\n```")
        return False

    desc = get_playlist_description(pl_id)
    if desc is None:
        replace_label(num, LABEL_BAD)
        comment(num, f"❌ Playlist not found or not public. Make sure it’s public and correct: `{playlist_url}`")
        return False

    if token in desc:
        replace_label(num, LABEL_OK)
        comment(num, f"✅ Verified: token `{token}` was found in the playlist description.")
        return True
    else:
        replace_label(num, LABEL_BAD)
        comment(num, f"❌ Token `{token}` not found in the playlist description. Please paste it into your YouTube playlist description and keep it public.")
        return False

def main():
    if not (GITHUB_REPOSITORY and GITHUB_TOKEN and YOUTUBE_API_KEY):
        print("Missing configuration (GITHUB_REPOSITORY/GITHUB_TOKEN/YOUTUBE_API_KEY)", file=sys.stderr)
        sys.exit(1)

    ensure_labels()

    issue_num = os.environ.get("ISSUE_NUMBER")
    if issue_num:
        verify_issue(int(issue_num))
        return

    # fallback: проверить все открытые регистрации по расписанию
    for n in list_open_registration_issues():
        try:
            verify_issue(int(n))
        except Exception as e:
            print(f"Error verifying issue #{n}: {e}", file=sys.stderr)

if __name__ == "__main__":
    main()
