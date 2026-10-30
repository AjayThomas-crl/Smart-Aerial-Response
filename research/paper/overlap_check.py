"""Text overlap between the new paper and the journal manuscript (a local stand-in for similarity checkers).

Reports the share of the new paper's word 6-grams that also occur in the journal text, and lists the
longest shared passages so they can be rewritten. References are excluded on both sides.

    python overlap_check.py new.docx journal.docx
"""
import re
import subprocess
import sys

N = 6


def words(path):
    text = subprocess.run(["pandoc", "-t", "plain", "--wrap=none", path], capture_output=True, text=True).stdout
    cut = list(re.finditer(r"\n\s*(References|REFERENCES)\s*\n", text))
    if cut:                                            # last heading: a table of contents may name it too
        text = text[:cut[-1].start()]
    return re.findall(r"[a-z0-9]+", text.lower())


def grams(ws, n=N):
    return [" ".join(ws[i:i + n]) for i in range(len(ws) - n + 1)]


def main():
    new, old = words(sys.argv[1]), words(sys.argv[2])
    g_new, g_old = grams(new), set(grams(old))
    shared = [i for i, g in enumerate(g_new) if g in g_old]
    print(f"new paper: {len(new)} words, journal: {len(old)} words")
    print(f"shared {N}-grams: {len(shared)} of {len(g_new)} = {100 * len(shared) / max(1, len(g_new)):.2f}%")
    runs, start, prev = [], None, None
    for i in shared:                                   # merge consecutive shared grams into passages
        if prev is not None and i == prev + 1:
            prev = i
            continue
        if start is not None:
            runs.append((start, prev))
        start = prev = i
    if start is not None:
        runs.append((start, prev))
    runs.sort(key=lambda r: r[0] - r[1])
    for a, b in runs[:15]:
        print(f"  [{b - a + N} words] " + " ".join(new[a:b + N]))


if __name__ == "__main__":
    main()
