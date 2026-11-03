import json, os

BASE = os.path.dirname(os.path.abspath(__file__))
FILES = os.path.dirname(BASE)
DATA_DIR = os.path.join(FILES, "data")
ORDER = ["A", "B", "C", "DE", "FGH", "IJKL", "MNO", "PQR", "S", "TZ"]
TEMPLATE = os.path.join(BASE, "template.html")
OUT = os.path.join(BASE, "index.html")
GRAMMAR = os.path.join(BASE, "grammar.json")
SUBJECT_DIR = os.path.join(BASE, "subjects")
SUBJECT_KEYS = ["math", "physics", "chemistry", "biology"]


def js_json(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


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
    with open(GRAMMAR, encoding="utf-8") as f:
        grammar = json.load(f)
    with open(TEMPLATE, encoding="utf-8") as f:
        tpl = f.read()
    for ph in ("/*__DATA__*/", "/*__GRAMMAR__*/", "/*__SUBJECTS__*/"):
        if ph not in tpl:
            raise SystemExit(f"placeholder missing: {ph}")
    subjects = {}
    for key in SUBJECT_KEYS:
        with open(os.path.join(SUBJECT_DIR, f"{key}.json"), encoding="utf-8") as f:
            subjects[key] = json.load(f)
    out = (tpl.replace("/*__DATA__*/", js_json(data))
              .replace("/*__GRAMMAR__*/", js_json(grammar))
              .replace("/*__SUBJECTS__*/", js_json(subjects)))
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(out)
    print(f"{len(data)} 主词条, {sum(len(r['d']) for r in data)} 派生词 -> {OUT}")


if __name__ == "__main__":
    main()
