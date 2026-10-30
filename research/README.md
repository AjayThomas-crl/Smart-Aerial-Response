# Research paper: Flood-Resilient Siting of IoT Drone Docks

Paper for the *Design of Smart Cities* (IoT) course by Dharani I S (23BCT0222) and Sukant G (23BCT0184):
**`paper/Flood_Resilient_Drone_Docks.docx`** (IEEE two-column, 7 pages).

It asks a different question from the A.D.A.P.T. journal manuscript: not how to turn a flood map into
verified missions, but **where a smart city should permanently install IoT drone docks so they keep
working as the flood rises**. The planner is used unchanged as an evaluator and is credited in the
acknowledgment and reference [5].

## Before submitting

- Fill the placeholders: the two authors' email addresses, and the faculty guide's name in the acknowledgment.
- The acknowledgment discloses that a manuscript describing the planner is under review elsewhere. Keep
  that sentence, and mention the related submission to the venue if it asks about prior or concurrent work.
- `paper/overlap_check.py` compares the paper with any .docx (6-word sequences). Against the journal
  manuscript the only shared text is the affiliation block.

## Reproducing the study

```bash
cd research/hub_study
python3 run_batch.py adaptive          # 30 runs: planner chooses bases freely (about 5 min, 10 parallel)
../../.venv/bin/python select_hubs.py  # robust / event-sited / uniform dock sets -> hubs/
python3 run_batch.py fixed             # 150 runs: bases restricted to each dock set (about 30 min)
../../.venv/bin/python analyze.py      # results.json, Fig. 3 and Fig. 5
../../.venv/bin/python fig_docks_map.py   # Fig. 4 (dock maps)
python3 iot_messages.py                # IoT message sizes and data-rate budget (Table II)
cd .. && NODE_PATH=<node_modules with docx> node paper/make_paper.js
```

| File | What it does |
|---|---|
| `hub_study/run_scenario.py` | One planner run with a grown flood mask, given weather, and optional fixed dock sites |
| `hub_study/run_batch.py` | Runs all scenarios in parallel; already-finished runs are skipped |
| `hub_study/select_hubs.py` | Scores and picks dock sites; train stages 0, 6, 12, test stages 3, 9 |
| `hub_study/analyze.py` | Coverage, regret, docks lost, 30-min service level, base displacement, latency |
| `paper/build_paper.js`, `paper/make_paper.js`, `paper/references.js` | Build the .docx from the results files |
| `paper/fig_src/*.html` | Sources of Fig. 1 (IoT architecture) and Fig. 2 (study design) |
