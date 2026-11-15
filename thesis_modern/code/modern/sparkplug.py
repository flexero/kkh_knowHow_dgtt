"""Sparkplug B payloads encoded BY HAND with the standard library (no protobuf package available offline).

Implements the subset of the Sparkplug B protobuf schema (Eclipse Sparkplug 3.0, sparkplug_b.proto) needed by the
edge gateway and the twin:
    Payload { uint64 timestamp = 1; repeated Metric metrics = 2; uint64 seq = 3; }
    Metric  { string name = 1; uint64 alias = 2; uint64 timestamp = 3; uint32 datatype = 4; bool is_historical = 5;
              bool is_null = 7; oneof value { uint32 int_value = 10; uint64 long_value = 11; float float_value = 12;
              double double_value = 13; bool boolean_value = 14; string string_value = 15; } }
Protobuf wire format: key = (field << 3) | wire type; varint (0), 64-bit (1), length-delimited (2), 32-bit (5).
Not implemented (not needed here): metadata, property sets, data sets, templates, uuid / body fields.

Topic namespace: spBv1.0/<group>/<NBIRTH|NDEATH|NDATA|NCMD|DBIRTH|DDEATH|DDATA|DCMD>/<edge node>[/<device>]
Primary host state (Sparkplug 3.0): spBv1.0/STATE/<host id>, JSON {"online": bool, "timestamp": ms}, retained.
"""
from __future__ import annotations

import struct

# Sparkplug B data types
DT = {'Int8': 1, 'Int16': 2, 'Int32': 3, 'Int64': 4, 'UInt8': 5, 'UInt16': 6, 'UInt32': 7, 'UInt64': 8, 'Float': 9,
      'Double': 10, 'Boolean': 11, 'String': 12, 'DateTime': 13, 'Text': 14}
DT_NAME = {v: k for k, v in DT.items()}
_INT32 = {1, 2, 3, 5, 6, 7}
_INT64 = {4, 8, 13}


# ------------------------------------------------------------------ protobuf primitives
def varint(n):
    n &= 0xFFFFFFFFFFFFFFFF
    out = bytearray()
    while True:
        b = n & 0x7F
        n >>= 7
        if n:
            out.append(b | 0x80)
        else:
            out.append(b)
            return bytes(out)


def key(field, wt):
    return varint((field << 3) | wt)


def read_varint(buf, i):
    shift = n = 0
    while True:
        b = buf[i]
        i += 1
        n |= (b & 0x7F) << shift
        if not b & 0x80:
            return n, i
        shift += 7


def ld(field, data):
    return key(field, 2) + varint(len(data)) + data


# ------------------------------------------------------------------ encode
def encode_metric(m):
    """m: dict(name?, alias?, timestamp?, datatype (int or name), value, is_historical?, is_null?)"""
    dt = m['datatype'] if isinstance(m['datatype'], int) else DT[m['datatype']]
    out = bytearray()
    if m.get('name') is not None:
        out += ld(1, m['name'].encode('utf-8'))
    if m.get('alias') is not None:
        out += key(2, 0) + varint(m['alias'])
    if m.get('timestamp') is not None:
        out += key(3, 0) + varint(m['timestamp'])
    out += key(4, 0) + varint(dt)
    if m.get('is_historical'):
        out += key(5, 0) + b'\x01'
    v = m.get('value')
    if v is None:
        out += key(7, 0) + b'\x01'
        return bytes(out)
    if dt in _INT32:
        out += key(10, 0) + varint(int(v) & 0xFFFFFFFF)
    elif dt in _INT64:
        out += key(11, 0) + varint(int(v))
    elif dt == 9:
        out += key(12, 5) + struct.pack('<f', float(v))
    elif dt == 10:
        out += key(13, 1) + struct.pack('<d', float(v))
    elif dt == 11:
        out += key(14, 0) + (b'\x01' if v else b'\x00')
    elif dt in (12, 14):
        out += ld(15, str(v).encode('utf-8'))
    else:
        raise ValueError(f'datatype {dt} not supported')
    return bytes(out)


def encode_payload(timestamp, metrics, seq=None):
    out = bytearray(key(1, 0) + varint(timestamp))
    for m in metrics:
        out += ld(2, encode_metric(m))
    if seq is not None:
        out += key(3, 0) + varint(seq)
    return bytes(out)


# ------------------------------------------------------------------ decode
def _fields(buf):
    i, n = 0, len(buf)
    while i < n:
        k, i = read_varint(buf, i)
        f, wt = k >> 3, k & 7
        if wt == 0:
            v, i = read_varint(buf, i)
        elif wt == 1:
            v, i = buf[i:i + 8], i + 8
        elif wt == 5:
            v, i = buf[i:i + 4], i + 4
        elif wt == 2:
            ln, i = read_varint(buf, i)
            v, i = buf[i:i + ln], i + ln
        else:
            raise ValueError(f'wire type {wt}')
        yield f, wt, v


def decode_metric(buf):
    m = {}
    for f, wt, v in _fields(buf):
        if f == 1:
            m['name'] = bytes(v).decode('utf-8')
        elif f == 2:
            m['alias'] = v
        elif f == 3:
            m['timestamp'] = v
        elif f == 4:
            m['datatype'] = v
        elif f == 5:
            m['is_historical'] = bool(v)
        elif f == 7:
            m['is_null'] = bool(v)
            m['value'] = None
        elif f == 10:
            m['value'] = v
        elif f == 11:
            m['value'] = v
        elif f == 12:
            m['value'] = struct.unpack('<f', v)[0]
        elif f == 13:
            m['value'] = struct.unpack('<d', v)[0]
        elif f == 14:
            m['value'] = bool(v)
        elif f == 15:
            m['value'] = bytes(v).decode('utf-8')
    dt = m.get('datatype')
    if dt in (1, 2, 3) and m.get('value') is not None and m['value'] >= 2 ** 31:   # signed ints: two's complement
        m['value'] -= 2 ** 32
    return m


def decode_payload(buf):
    p = {'metrics': []}
    for f, wt, v in _fields(memoryview(buf)):
        if f == 1:
            p['timestamp'] = v
        elif f == 2:
            p['metrics'].append(decode_metric(bytes(v)))
        elif f == 3:
            p['seq'] = v
    return p


def topic(kind, device=None, group='fms', edge='gw1'):
    return f'spBv1.0/{group}/{kind}/{edge}' + (f'/{device}' if device else '')


def parse_topic(t):
    p = t.split('/')
    if len(p) >= 4 and p[0] == 'spBv1.0' and p[1] != 'STATE':
        return {'group': p[1], 'kind': p[2], 'edge': p[3], 'device': p[4] if len(p) > 4 else None}
    if len(p) == 3 and p[1] == 'STATE':
        return {'kind': 'STATE', 'host': p[2]}
    return None


if __name__ == '__main__':
    # self-check: varints and a round trip
    assert varint(1) == b'\x01' and varint(300) == b'\xac\x02' and varint(2 ** 63) == b'\x80' * 9 + b'\x01'
    ms = [{'name': 'Monitoring/FmsState', 'alias': 3, 'timestamp': 1767225600123, 'datatype': 'UInt16', 'value': 2},
          {'alias': 4, 'datatype': 'Float', 'value': 3.5}, {'alias': 5, 'datatype': 'Double', 'value': 341.25},
          {'alias': 6, 'datatype': 'String', 'value': 'JOB1000123'}, {'alias': 7, 'datatype': 'Boolean', 'value': True},
          {'alias': 8, 'datatype': 'Int32', 'value': -5}, {'alias': 9, 'datatype': 'UInt64', 'value': 2 ** 40},
          {'alias': 10, 'datatype': 'UInt32', 'value': None}]
    b = encode_payload(1767225600999, ms, seq=255)
    d = decode_payload(b)
    assert d['seq'] == 255 and d['timestamp'] == 1767225600999 and len(d['metrics']) == len(ms)
    for a, c in zip(ms, d['metrics']):
        assert a['value'] == c['value'], (a, c)
    print('sparkplug self-check OK,', len(b), 'bytes for', len(ms), 'metrics')
