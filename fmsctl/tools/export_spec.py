"""Export the register map V1.2 and the device list as CSV files for machine suppliers (purchase specification).

    python -m fmsctl.tools.export_spec      -> fmsctl/spec/out/regmap_<TYPE>.csv, devices.csv
Open the CSV files in Excel; attach the file of the machine's type to the purchase order together with guide 53.
"""
import csv
import os

from fmsctl.spec import plant, regmap as R

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'spec', 'out')


def main():
    os.makedirs(OUT, exist_ok=True)
    for t in R.TYPE_BLOCKS:
        with open(os.path.join(OUT, f'regmap_{t}.csv'), 'w', newline='', encoding='utf-8-sig') as f:
            w = csv.writer(f)
            w.writerow(['address (0-based)', 'Modbus 4xxxx', 'registers', 'name', 'type', 'unit', 'access', 'meaning'])
            for a, name, typ, unit, rw, mean in R.fields(t):
                w.writerow([a, 40001 + a, R.NREG[typ], name, typ, unit, rw, mean])
    with open(os.path.join(OUT, 'devices.csv'), 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.writer(f)
        w.writerow(['device', 'type', 'IP address', 'port', 'unit id', 'register map', 'description'])
        for d in plant.device_table(virtual=False):
            w.writerow([d['id'], d['type'], d['ip'], 502, d['unit'], f'V1.2 regmap_{d["type"]}.csv', d['desc']])
    print('written to', os.path.abspath(OUT), sorted(os.listdir(OUT)))


if __name__ == '__main__':
    main()
