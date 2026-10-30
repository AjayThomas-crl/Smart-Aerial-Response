"""Copy the final deliverables into Final_Submission/, one numbered folder per item the course asks for.

    python3 submission_tools/assemble_final.py

Word files are also exported to PDF with LibreOffice, so each document can be uploaded in either form.
"""
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "Final_Submission"

ITEMS = {
    "1_Project_Report": ["report/Smart_Aerial_Response_Course_Report.docx"],
    "2_Presentation": ["deliverables/Smart_Aerial_Response.pptx"],
    "3_Demo_Video": ["docs/demo_video_script.md"],
    "4_Plagiarism_Report": ["submission_tools/out/Similarity_SelfCheck.pdf"],
    "5_GitHub_Repository": [],
    "6_Research_Paper_IEEE": ["research/paper/Flood_Resilient_Drone_Docks.docx"],
    "7_Test_and_IoT_Evidence": ["tests/results/summary.json", "tests/results/junit.xml"]
        + [str(p.relative_to(ROOT)) for p in sorted((ROOT / "iot" / "runs").glob("*/summary.json"))[-2:]],
}
PDF = {"1_Project_Report", "2_Presentation", "6_Research_Paper_IEEE"}

NOTES = {
    "3_Demo_Video": "Record the demo with the script in this folder (10 minutes max) and save the MP4 here.\n",
    "4_Plagiarism_Report": ("Similarity_SelfCheck.pdf is our own 6-word overlap check against the related journal "
                            "manuscript and the earlier course report.\nThe official plagiarism report must come from "
                            "the VIT library (Turnitin / iThenticate); save it here when you receive it.\n"
                            "Ask for the check to be run WITHOUT adding the files to the Turnitin repository (\"no "
                            "repository\"): the related journal manuscript is still under review, and a stored course "
                            "report could later be matched against it.\n"),
    "5_GitHub_Repository": "Repository link: <add the GitHub URL here once the repository is pushed>\n",
}


def main():
    OUT.mkdir(exist_ok=True)
    for folder, files in ITEMS.items():
        d = OUT / folder
        d.mkdir(exist_ok=True)
        for f in files:
            src = ROOT / f
            if not src.exists():
                print(f"missing: {f}")
                continue
            dest = d / (f"iot_{src.parent.name}_summary.json" if "iot/runs" in f else src.name)
            shutil.copy2(src, dest)
            if folder in PDF:
                subprocess.run(["soffice", "--headless", "--convert-to", "pdf", "--outdir", str(d), str(d / src.name)],
                               capture_output=True)
        if folder in NOTES and not (d / "README.txt").exists():
            (d / "README.txt").write_text(NOTES[folder])
    for p in sorted(OUT.rglob("*")):
        if p.is_file():
            print(f"{p.relative_to(ROOT)}  ({p.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
