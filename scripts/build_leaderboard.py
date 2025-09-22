#!/usr/bin/env python3
import os, json, time, urllib.request, urllib.parse, datetime

YOUTUBE_API_KEY = os.environ.get("YOUTUBE_API_KEY")

def http_json(url):
  with urllib.request.urlopen(url) as r:
    return json.loads(r.read().decode())

def playlist_id_from_url(url):
  try:
    u = urllib.parse.urlparse(url)
    qs = urllib.parse.parse_qs(u.query)
    if "list" in qs: return qs["list"][0]
    # если прислали прямой ID
    if url and url.startswith("PL") and len(url) > 10: return url
  except Exception:
    pass
  return None

def list_playlist_items(pl_id, max_items=200):
  out, pageToken = [], None
  while True:
    qs = {
      "part": "contentDetails",
      "playlistId": pl_id,
      "maxResults": 50,
      "key": YOUTUBE_API_KEY
    }
    if pageToken: qs["pageToken"] = pageToken
    url = "https://www.googleapis.com/youtube/v3/playlistItems?" + urllib.parse.urlencode(qs)
    data = http_json(url)
    for it in data.get("items", []):
      out.append(it["contentDetails"]["videoId"])
    pageToken = data.get("nextPageToken")
    if not pageToken or len(out) >= max_items: break
  return out[:max_items]

def chunk(lst, n):
  for i in range(0, len(lst), n):
    yield lst[i:i+n]

def get_videos_stats(video_ids):
  # snippet (publishedAt) + statistics
  res = {}
  for batch in chunk(video_ids, 50):
    qs = {
      "part": "snippet,statistics",
      "id": ",".join(batch),
      "key": YOUTUBE_API_KEY
    }
    url = "https://www.googleapis.com/youtube/v3/videos?" + urllib.parse.urlencode(qs)
    data = http_json(url)
    for it in data.get("items", []):
      vid = it["id"]
      sn = it.get("snippet", {})
      st = it.get("statistics", {})
      res[vid] = {
        "publishedAt": sn.get("publishedAt"),
        "views": int(st.get("viewCount","0") or 0),
        "likes": int(st.get("likeCount","0") or 0),
        "comments": int(st.get("commentCount","0") or 0),
      }
  return res

def within_30d(iso):
  if not iso: return False
  try:
    dt = datetime.datetime.fromisoformat(iso.replace("Z","+00:00")).replace(tzinfo=None)
  except Exception:
    return False
  return (datetime.datetime.utcnow() - dt).days <= 30

def compute_metrics(stats):
  views30d = sum(v["views"] for v in stats.values() if within_30d(v["publishedAt"]))
  likes30d = sum(v["likes"] for v in stats.values() if within_30d(v["publishedAt"]))
  comments30d = sum(v["comments"] for v in stats.values() if within_30d(v["publishedAt"]))
  er = 0.0
  if views30d > 0:
    er = (likes30d + comments30d) / views30d
  return {"views30d": views30d, "likes30d": likes30d, "er": round(er, 5)}

def main():
  # читаем реестр участников
  with open("site/public/participants.json","r") as f:
    reg = json.load(f)
  entries = []
  for p in reg.get("participants", []):
    if p.get("status") != "verified":  # считаем только Verified ✅
      continue
    title = p.get("team") or "Team"
    pl_url = (p.get("youtube") or {}).get("playlist") or ""
    pl_id = playlist_id_from_url(pl_url)
    if not pl_id:  # пропускаем, если непонятный URL
      continue
    vids = list_playlist_items(pl_id)
    stats = get_videos_stats(vids) if vids else {}
    m = compute_metrics(stats)
    entries.append({
      "id": f"issue-{p['issue']}",
      "title": title,
      "youtube": { "playlist": pl_url },
      "metrics": m,
      "score": 0.0  # заполним после нормализации
    })

  # нормализация score (топ = 1.0)
  if entries:
    max_views = max(e["metrics"]["views30d"] for e in entries) or 1
    for e in entries:
      # простая формула: 70% — views, 30% — engagement rate (умноженный на 1e2 для масштаба)
      score_raw = 0.7 * (e["metrics"]["views30d"] / max_views) + 0.3 * min(e["metrics"]["er"] * 100, 1.0)
      e["score"] = round(float(score_raw), 3)

  leaderboard = {
    "season": reg.get("season","Season 1"),
    "updated_at": datetime.datetime.utcnow().replace(microsecond=0).isoformat()+"Z",
    "entries": sorted(entries, key=lambda x: x["score"], reverse=True)
  }
  with open("site/public/leaderboard.json","w") as f:
    json.dump(leaderboard, f, indent=2)
  print(f"Wrote site/public/leaderboard.json with {len(entries)} verified entries.")

if __name__ == "__main__":
  if not YOUTUBE_API_KEY:
    raise SystemExit("YOUTUBE_API_KEY is missing")
  main()
