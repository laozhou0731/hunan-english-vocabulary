import json, os

BASE = os.path.dirname(os.path.abspath(__file__))
FILES = os.path.dirname(BASE)
DATA_DIR = os.path.join(FILES, "data")
ORDER = ["A", "B", "C", "DE", "FGH", "IJKL", "MNO", "PQR", "S", "TZ"]
TEMPLATE = os.path.join(BASE, "template.html")
OUT = os.path.join(BASE, "index.html")


def letter_of(word):
    c = word[:1].lower()
    return c if "a" <= c <= "z" else "#"


def load():
    roots = []
    for name in ORDER:
        path = os.path.join(DATA_DIR, f"{name}.txt")
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                parts = line.split("|")
                if len(parts) != 5:
                    raise SystemExit(f"bad line in {name}.txt: {line}")
                w, ipa, pos, en, zh = parts
                entry = {"ipa": ipa, "pos": pos, "en": en, "zh": zh}
                if w.startswith("↳"):
                    if not roots:
                        raise SystemExit(f"derived word without root: {line}")
                    entry["w"] = w.lstrip("↳ ").strip()
                    roots[-1]["d"].append(entry)
                else:
                    entry["w"] = w
                    entry["l"] = letter_of(w)
                    entry["d"] = []
                    roots.append(entry)
    return roots


def main():
    data = load()
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    payload = payload.replace("</", "<\\/")
    with open(TEMPLATE, encoding="utf-8") as f:
        tpl = f.read()
    if "/*__DATA__*/" not in tpl:
        raise SystemExit("placeholder missing")
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(tpl.replace("/*__DATA__*/", payload))
    print(f"{len(data)} 主词条, {sum(len(r['d']) for r in data)} 派生词 -> {OUT}")


if __name__ == "__main__":
    main()
