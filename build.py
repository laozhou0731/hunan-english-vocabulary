import glob, html, os, subprocess, sys

BASE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(BASE, "data")
ORDER = ["A", "B", "C", "DE", "FGH", "IJKL", "MNO", "PQR", "S", "TZ"]
OUT_HTML = os.path.join(BASE, "vocab-3500.html")
OUT_PDF = os.path.join(BASE, "vocab-3500.pdf")

CSS = """
@page { size: A4; margin: 14mm 11mm; }
body { font-family: "Noto Sans CJK SC", "Noto Sans", "Microsoft YaHei", Arial, sans-serif; font-size: 9.5pt; color: #111; margin: 0; }
h1 { font-size: 15pt; text-align: center; margin: 0 0 3px; }
.note { font-size: 8.5pt; color: #555; text-align: center; margin-bottom: 8px; }
h2 { font-size: 11pt; background: #2f4a6d; color: #fff; padding: 3px 8px; margin: 14px 0 4px; page-break-after: avoid; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
thead { display: table-header-group; }
tr { page-break-inside: avoid; }
th, td { border: 1px solid #aaa; padding: 2.5px 5px; vertical-align: middle; text-align: left; word-wrap: break-word; }
th { background: #e8eef6; font-weight: bold; }
th:nth-child(1) { width: 16%; } th:nth-child(2) { width: 19%; } th:nth-child(3) { width: 8%; }
th:nth-child(4) { width: 31%; } th:nth-child(5) { width: 26%; }
td.word { font-weight: bold; }
tr.root td { border-top: 1.5px solid #556; }
.ipa { font-family: "Doulos SIL", "DejaVu Sans", "Segoe UI Symbol", serif; }
"""


def load_rows(name):
    path = os.path.join(DATA, f"{name}.txt")
    rows = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split("|")
            if len(parts) != 5:
                print(f"WARN {name}: bad line -> {line}", file=sys.stderr)
                continue
            rows.append(parts)
    return rows


def esc(s):
    return html.escape(s, quote=False)


def build():
    out = [
        '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">',
        "<title>高中英语课标核心词汇 3500</title>",
        f"<style>{CSS}</style></head><body>",
        "<h1>高中英语课标核心词汇 3500</h1>",
        '<div class="note">同一词根的派生词紧跟主词条，以「↳」标注 ｜ 音标为英式（RP）音标</div>',
    ]
    total = 0
    for name in ORDER:
        if not os.path.exists(os.path.join(DATA, f"{name}.txt")):
            print(f"MISSING {name}", file=sys.stderr)
            continue
        rows = load_rows(name)
        total += sum(1 for r in rows if not r[0].startswith("↳"))
        label = "・".join(list(name))
        out.append(f"<h2>{esc(label)}</h2>")
        out.append("<table><thead><tr><th>单词</th><th>音标</th><th>词性</th>"
                   "<th>英文释义</th><th>中文释义</th></tr></thead><tbody>")
        for w, ipa, pos, en, zh in rows:
            cls = ' class="root"' if not w.startswith("↳") else ""
            wcls = ' class="word"' if not w.startswith("↳") else ""
            out.append(f"<tr{cls}><td{wcls}>{esc(w)}</td><td class=\"ipa\">{esc(ipa)}</td>"
                       f"<td>{esc(pos)}</td><td>{esc(en)}</td><td>{esc(zh)}</td></tr>")
        out.append("</tbody></table>")
    out.append('<div style="font-size:8pt;color:#666;margin-top:8px">说明：音标依据常用英式词典标注，发给学生前建议用牛津或朗文词典抽查。</div>')
    out.append("</body></html>")
    with open(OUT_HTML, "w", encoding="utf-8") as f:
        f.write("\n".join(out))
    print(f"主词条约 {total} 个 -> {OUT_HTML}")


if __name__ == "__main__":
    build()
    subprocess.run(
        ["google-chrome", "--headless", "--no-sandbox", "--disable-gpu",
         "--no-pdf-header-footer", f"--print-to-pdf={OUT_PDF}", f"file://{OUT_HTML}"],
        check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=300,
    )
    print(f"PDF -> {OUT_PDF}")
