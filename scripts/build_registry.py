#!/usr/bin/env python3
import os, json, re, urllib.request, urllib.parse, datetime

REPO = os.environ.get("GITHUB_REPOSITORY")   # owner/repo
TOKEN = os.environ.get("GITHUB_TOKEN")
API = "https://api.github.com"

HDRS = {
  "Authorization": f"token {TOKEN}",
  "Accept": "application/vnd.github+json",
  "User-Agent": "aigc-registry-bot"
}

def gh(url):
  req = urllib.request.Request(url, headers=HDRS)
  with urllib.request.urlopen(req) as r:
    return json.loads(r.read().decode())

def gh_paginated(url):
  items = []
  while True:
    req = urllib.request.Request(url, headers=HDRS)
    with urllib.request.urlopen(req) as r:
      items.extend(json.loads(r.read().decode()))
      link = r.headers.get("Link","")
    next_url = None
    for part in link.split(","):
      if 'rel="next"' in part:
        m = re.search(r'<([^>]+)>', part)
        if m: next_url = m.group(1)
    if not next_url: break
    url = next_url
  return items

def get_registration_issues():
  # все открытые+закрытые, чтобы не потерять участников
  url = f"{API}/repos/{REPO}/issues?state=all&labels={urllib.parse.quote('registration')}&per_page=100"
  return gh_paginated(url)

def extract_field(md, header):
  rx = re.compile(rf"^### {re.escape(header)}\s*\n([^#][\s\S]*?)(?:\n### |\Z)", re.M)
  m = rx.search(md or "")
  if not m: return ""
  return m.group(1).strip().splitlines()[0].strip()

def main():
  issues = get_registration_issues()
  out = []
  for it in issues:
    labels = [l["name"] for l in it.get("labels",[])]
    status = "verified" if "Verified ✅" in labels else ("needs_verification" if "Needs verification ❌" in labels else "pending")
    body = it.get("body") or ""
    team = extract_field(body, "Team name")
    country = extract_field(body, "Country/Region")
    contact = extract_field(body, "Contact")
    channel = extract_field(body, "YouTube channel URL")
    playlist = extract_field(body, "Season playlist URL")
    token = extract_field(body, "Verification token")
    updated = it.get("updated_at") or it.get("created_at")

    out.append({
      "issue": it["number"],
      "status": status,
      "team": team,
      "country": country,
      "contact_hint": contact,
      "youtube": { "channel": channel, "playlist": playlist },
      "token": token,
      "updated_at": updated
    })

  data = {
    "season": "Season 1",
    "updated_at": datetime.datetime.utcnow().replace(microsecond=0).isoformat()+"Z",
    "participants": out
  }
  os.makedirs("site/public", exist_ok=True)
  with open("site/public/participants.json","w") as f:
    json.dump(data, f, indent=2)
  print(f"Wrote site/public/participants.json with {len(out)} entries.")

if __name__ == "__main__":
  main()
