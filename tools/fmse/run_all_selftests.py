#!/usr/bin/env python3
"""Run the --selftest of every FMS engineering tool and print a summary.

Usage:  python tools/fmse/run_all_selftests.py [--verbose]
Exit code 0 = all tools passed, 1 = at least one tool failed.
Offline, Python standard library only.
"""

import argparse
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
TOOLS = ["fms_economics.py", "cpm_schedule.py", "business_case.py", "acceptance.py",
         "urs_generator.py", "risk_register.py", "interface_matrix.py",
         # item 2: product -> process -> machines
         "abc_analysis.py", "pfa_cells.py", "gt_opitz.py", "tolerance_process.py", "process_time.py",
         "capacity_plan.py", "line_balance.py", "machine_select.py",
         # item 3: elements of an FMS
         "element_sizing.py", "tolerance_stack.py", "agv_fleet.py", "asrs_cycle.py", "robot_payload.py",
         "assembly_test.py", "transport_select.py", "conveyor_drive.py",
         # item 4: capacity, layout, simulation
         "oee_losses.py", "queueing.py", "mva_closed.py", "buffer_sim.py", "fms_sim.py", "layout_plan.py",
         # item 5: control architecture
         "packml_sim.py", "tag_namer.py", "cell_controller_sim.py", "arch_availability.py", "alarm_kpi.py",
         "isa95_msg.py",
         # item 6: communication
         "net_calc.py", "ip_plan.py", "modbus_codec.py", "datablock_map.py", "handshake_sim.py", "net_security.py",
         # item 7: electrical & safety
         "load_list.py", "cable_size.py", "control_power.py", "cabinet_thermal.py", "safety_pl.py",
         "safety_distance.py", "safety_zones.py",
         # item 8: module circuit library
         "circuit_library.py", "module_power.py", "circuit_svg.py", "library_check.py",
         # item 9: PLC programming principles
         "plc_timing.py", "iec_std_fb.py", "device_fb.py", "module_sequence.py", "alarm_isa182.py", "st_codegen.py",
         "plc_effort.py",
         # item 10A: PLC library (ST device FBs) + soft PLC
         "fb_library.py", "st_sim.py", "plc_lib_check.py"]


def run_one(tool, verbose):
    """Run one tool's self-test; return (ok, n_pass, n_fail, output)."""
    proc = subprocess.run([sys.executable, str(HERE / tool), "--selftest"], capture_output=True,
                          text=True, encoding="utf-8", errors="replace", cwd=str(HERE))
    out = proc.stdout + proc.stderr
    n_pass = out.count("  PASS  ")
    n_fail = out.count("  FAIL  ")
    if verbose or proc.returncode != 0:
        print(out.rstrip())
    return proc.returncode == 0, n_pass, n_fail, out


def main():
    for s in (sys.stdout, sys.stderr):
        try:
            s.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--verbose", action="store_true", help="show every PASS line")
    a = ap.parse_args()
    rows, all_ok = [], True
    for tool in TOOLS:
        ok, n_pass, n_fail, _ = run_one(tool, a.verbose)
        all_ok &= ok
        rows.append((tool, ok, n_pass, n_fail))
    print()
    print("SELF-TEST SUMMARY")
    w = max(len(t) for t in TOOLS)
    for tool, ok, n_pass, n_fail in rows:
        print(f"  {tool.ljust(w)}  {'PASS' if ok else 'FAIL'}  ({n_pass} checks passed, {n_fail} failed)")
    tp = sum(r[2] for r in rows)
    tf = sum(r[3] for r in rows)
    print(f"  {'TOTAL'.ljust(w)}  {'PASS' if all_ok else 'FAIL'}  ({tp} checks passed, {tf} failed)")
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
