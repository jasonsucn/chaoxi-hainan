import json
import urllib.error
import urllib.request

TOKEN_PATH = r"C:\Users\17600\.dsh\gh-token.txt"
API = "https://api.github.com"


def api(method, path, data=None):
    req = urllib.request.Request(
        API + path,
        method=method,
        data=json.dumps(data).encode("utf-8") if data is not None else None,
        headers={
            "Authorization": "Bearer " + TOKEN,
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "dsh-chaoxi",
        },
    )
    with urllib.request.urlopen(req) as r:
        return json.load(r)


with open(TOKEN_PATH, encoding="utf-8") as f:
    TOKEN = f.read().strip()

me = api("GET", "/user")
print("login:", me["login"])

payload = {
    "name": "chaoxi-hainan",
    "description": "《潮汐书·海南》——一本被海反复擦掉的书。五幕 H5：00 满潮 / 01 玄武 / 02 潮间带 / 03 珊瑚 / 04 航线 / 05 归潮。",
    "private": True,
    "has_issues": True,
    "has_wiki": False,
}
try:
    repo = api("POST", "/user/repos", payload)
    print("created:", repo["full_name"])
    print("ssh:", repo["ssh_url"])
except urllib.error.HTTPError as e:
    body = e.read().decode("utf-8", "replace")
    if e.code == 422 and "already exists" in body:
        repo = api("GET", "/repos/" + me["login"] + "/chaoxi-hainan")
        print("exists:", repo["full_name"])
        print("ssh:", repo["ssh_url"])
    else:
        print("HTTP", e.code, body[:400])
        raise
