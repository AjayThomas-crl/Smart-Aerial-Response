"""Internal similarity self-check for the submission documents (a local stand-in for Turnitin / iThenticate).

For every submission document that exists, reports the share of its word 6-grams that also occur in each
comparison source (the A.D.A.P.T. journal manuscript, the earlier course reports, and the other submission
documents), and lists the longest shared passages. Reference lists are cut from every text before comparing.
Writes out/Similarity_SelfCheck.pdf (HTML printed by headless Chromium) and out/similarity.json.

    python3 submission_tools/similarity_report.py

Missing files are skipped, so the script can be re-run once the course report exists.
"""
import datetime
import html
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
OUT = HERE / "out"
N = 6

SUBMISSION = {
    "IEEE research paper": ROOT / "research/paper/Flood_Resilient_Drone_Docks.docx",
    "Course project report": ROOT / "report/Smart_Aerial_Response_Course_Report.docx",
}
SOURCES = {
    "A.D.A.P.T. journal manuscript (under review)": Path(
        "/home/ajay/.config/Claude/scratch-workspaces/991aeb63-563f-4803-9682-3507c3cef72c/"
        "28cc45c8-c30b-47bc-8303-2ab4c451bcb9/scratch-2026-10-27-99a7a3/ADAPT_paper.docx"),
    "Earlier course report (deliverables/)": ROOT / "deliverables/Smart_Aerial_Response_Report.docx",
}
# a heading line that is only "References" (optionally numbered, e.g. "9. REFERENCES", "CHAPTER 9 REFERENCES")
REF_HEADING = re.compile(r"\n\s*(?:chapter\s*\d+\s*)?(?:\d+\.?\s*)?references\s*\n", re.I)


def words(path):
    text = subprocess.run(["pandoc", "-t", "plain", "--wrap=none", str(path)], capture_output=True, text=True,
                          check=True).stdout
    cut = list(REF_HEADING.finditer(text))
    if cut:                                     # last match: a table of contents may name the heading too
        text = text[:cut[-1].start()]
    return re.findall(r"[a-z0-9]+", text.lower())


def grams(ws):
    return [" ".join(ws[i:i + N]) for i in range(len(ws) - N + 1)]


def compare(new, old):
    g_new, g_old = grams(new), set(grams(old))
    shared = [i for i, g in enumerate(g_new) if g in g_old]
    runs, start, prev = [], None, None
    for i in shared:                            # merge consecutive shared grams into passages
        if prev is not None and i == prev + 1:
            prev = i
            continue
        if start is not None:
            runs.append((start, prev))
        start = prev = i
    if start is not None:
        runs.append((start, prev))
    runs.sort(key=lambda r: r[0] - r[1])
    return {"percent": round(100 * len(shared) / max(1, len(g_new)), 2), "shared": len(shared), "grams": len(g_new),
            "passages": [{"words": b - a + N, "text": " ".join(new[a:b + N])} for a, b in runs[:8]]}


def render(results, skipped, today):
    esc = html.escape
    rows, detail = [], []
    for doc, r in results.items():
        for src, c in r["against"].items():
            flag = "ok" if c["percent"] < 5 else "check" if c["percent"] < 15 else "high"
            rows.append(f"<tr><td>{esc(doc)}</td><td>{esc(src)}</td><td class=n>{c['percent']:.2f}%</td>"
                        f"<td class=n>{c['shared']} / {c['grams']}</td><td class='{flag}'>{flag}</td></tr>")
            ps = "".join(f"<li><b>{p['words']} words:</b> {esc(p['text'])}</li>" for p in c["passages"]) \
                or "<li>No shared 6-word sequence.</li>"
            detail.append(f"<h3>{esc(doc)} vs {esc(src)}</h3><ol>{ps}</ol>")
    rel = lambda p: str(p.relative_to(ROOT)) if p.is_relative_to(ROOT) else str(p)
    skip = "".join(f"<li>{esc(k)}: <code>{esc(rel(v))}</code></li>" for k, v in skipped.items())
    return f"""<!doctype html><html><head><meta charset=utf-8><title>Internal Similarity Self-Check</title>
<style>
@page{{size:A4;margin:18mm 16mm}}
body{{font-family:"Liberation Serif","Times New Roman",serif;font-size:11pt;color:#111;line-height:1.4}}
h1{{font-size:18pt;margin:0 0 2pt}} h2{{font-size:13pt;margin:16pt 0 4pt;border-bottom:1px solid #999}}
h3{{font-size:11pt;margin:10pt 0 2pt}} .sub{{color:#444;margin:0 0 10pt}}
table{{border-collapse:collapse;width:100%;font-size:10pt}} th,td{{border:1px solid #888;padding:4pt 6pt;text-align:left}}
th{{background:#eee}} .n{{text-align:right;white-space:nowrap}} .ok{{color:#0a6b2d}} .check{{color:#9a6100}} .high{{color:#b00020}}
.note{{border:1.5px solid #b00020;padding:8pt 10pt;margin:12pt 0;background:#fff5f5}}
ol{{margin:2pt 0 0 18pt;padding:0}} li{{margin:2pt 0;font-size:10pt}} code{{font-size:9pt}}
</style></head><body>
<h1>Internal Similarity Self-Check</h1>
<p class=sub>Smart Aerial Response &mdash; Design of Smart Cities course project &middot; generated {today}</p>
<div class=note><b>This is not the official plagiarism report.</b> It is a local pre-check run by the team. The
official similarity report for submission must be obtained from the VIT library's Turnitin / iThenticate check,
which also compares against the web and published literature.</div>
<h2>Method</h2>
<p>Each document is converted to plain text (pandoc), its reference list is removed, and the text is split into
overlapping sequences of {N} consecutive words (6-grams), ignoring case and punctuation. The overlap percentage is
the share of the document's 6-grams that also occur anywhere in the comparison source. Consecutive shared 6-grams
are merged into passages, and the longest passages are listed so they can be checked or rewritten. Shared author
names and affiliation lines (school, institute, city) are expected and are not a concern. Overlap with the team's own
earlier course deliverable is self-reuse within the same course project.</p>
<h2>Results</h2>
<table><tr><th>Document</th><th>Compared with</th><th class=n>Overlap</th><th class=n>Shared 6-grams</th><th>Flag</th></tr>
{''.join(rows)}</table>
<p style="font-size:9.5pt;color:#444">Flag: ok &lt; 5%, check 5&ndash;15%, high &ge; 15%.</p>
{f'<p>Skipped (file not found):</p><ul>{skip}</ul>' if skip else ''}
<h2>Longest shared passages</h2>
{''.join(detail)}
</body></html>"""


def main():
    OUT.mkdir(exist_ok=True)
    skipped = {k: v for k, v in {**SUBMISSION, **SOURCES}.items() if not v.exists()}
    docs = {k: v for k, v in SUBMISSION.items() if v.exists()}
    srcs = {k: v for k, v in SOURCES.items() if v.exists()}
    text = {k: words(v) for k, v in {**docs, **srcs}.items()}
    results = {}
    for doc in docs:
        against = {s: compare(text[doc], text[s]) for s in srcs}
        against.update({d: compare(text[doc], text[d]) for d in docs if d != doc})
        results[doc] = {"words": len(text[doc]), "against": against}
    today = datetime.date.today().isoformat()
    (OUT / "similarity.json").write_text(json.dumps({"date": today, "n": N, "results": results,
                                                     "skipped": {k: str(v) for k, v in skipped.items()}}, indent=1))
    browser = next((b for b in ("chromium", "chromium-browser", "google-chrome-stable") if shutil.which(b)), None)
    with tempfile.TemporaryDirectory() as tmp:
        page = Path(tmp) / "report.html"
        page.write_text(render(results, skipped, today))
        subprocess.run([browser, "--headless", "--disable-gpu", "--no-pdf-header-footer",
                        f"--print-to-pdf={OUT / 'Similarity_SelfCheck.pdf'}", page.as_uri()],
                       capture_output=True, check=True)
    for doc, r in results.items():
        for src, c in r["against"].items():
            print(f"{doc} vs {src}: {c['percent']:.2f}%")
    for k in skipped:
        print(f"skipped (missing): {k}")
    print(f"wrote {OUT / 'Similarity_SelfCheck.pdf'}")


if __name__ == "__main__":
    main()
