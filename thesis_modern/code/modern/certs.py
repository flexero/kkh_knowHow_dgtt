"""Offline PKI for the laboratory (cryptography package, no internet, no external CA).

OPC UA (application instance certificates, OPC 10000-4 / -6 profile: RSA 2048, SHA-256, SubjectAltName URI = ApplicationUri):
  pki/ua/plant_cert.der + plant_key.pem       server (virtual plant)    urn:compressor-fms:plant
  pki/ua/gateway_cert.der + gateway_key.pem   client (edge gateway)     urn:compressor-fms:gateway
  pki/ua/trusted/gateway_cert.der             the server's trust list: only this client may open a secure channel
  pki/ua/rogue_cert.der + rogue_key.pem       an untrusted client (negative test)
MQTT over TLS: pki/mqtt/ca_cert.pem (self-made factory CA), broker_cert.pem + broker_key.pem signed by it (SAN localhost,
127.0.0.1). Private keys are unencrypted because this is a laboratory; in the factory they are protected (thesis 5.6).
"""
from __future__ import annotations

import datetime
import ipaddress
import os

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID

from common import PKI
from asyncua.crypto import cert_gen

UA = os.path.join(PKI, 'ua')
MQ = os.path.join(PKI, 'mqtt')
URI = {'plant': 'urn:compressor-fms:plant', 'gateway': 'urn:compressor-fms:gateway', 'rogue': 'urn:compressor-fms:rogue'}


def _w(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(data)


def ua_app(name, server):
    key = cert_gen.generate_private_key()
    import socket
    sans = [x509.UniformResourceIdentifier(URI[name]), x509.DNSName('localhost'), x509.DNSName(socket.gethostname()),
            x509.IPAddress(ipaddress.ip_address('127.0.0.1'))]
    eku = [ExtendedKeyUsageOID.SERVER_AUTH] if server else [ExtendedKeyUsageOID.CLIENT_AUTH]
    cert = cert_gen.generate_self_signed_app_certificate(key, f'compressor-fms {name}', {'organizationName': 'Case factory (lab)'},
                                                         sans, eku, days=3650)
    _w(os.path.join(UA, f'{name}_cert.der'), cert.public_bytes(serialization.Encoding.DER))
    _w(os.path.join(UA, f'{name}_key.pem'), cert_gen.dump_private_key_as_pem(key))
    return cert


def mqtt_pki():
    now = datetime.datetime.now(datetime.timezone.utc)
    ca_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    ca_name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'Case factory offline CA (lab)')])
    ca = (x509.CertificateBuilder().subject_name(ca_name).issuer_name(ca_name).public_key(ca_key.public_key())
          .serial_number(x509.random_serial_number()).not_valid_before(now).not_valid_after(now + datetime.timedelta(days=3650))
          .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
          .add_extension(x509.KeyUsage(False, False, False, False, False, True, True, False, False), critical=True)
          .sign(ca_key, hashes.SHA256()))
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    cert = (x509.CertificateBuilder().subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'localhost')]))
            .issuer_name(ca_name).public_key(key.public_key()).serial_number(x509.random_serial_number())
            .not_valid_before(now).not_valid_after(now + datetime.timedelta(days=825))
            .add_extension(x509.SubjectAlternativeName([x509.DNSName('localhost'), x509.IPAddress(ipaddress.ip_address('127.0.0.1'))]), critical=False)
            .add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]), critical=False)
            .sign(ca_key, hashes.SHA256()))
    pem = serialization.Encoding.PEM
    nok = serialization.NoEncryption()
    _w(os.path.join(MQ, 'ca_cert.pem'), ca.public_bytes(pem))
    _w(os.path.join(MQ, 'broker_cert.pem'), cert.public_bytes(pem))
    _w(os.path.join(MQ, 'broker_key.pem'), key.private_bytes(pem, serialization.PrivateFormat.TraditionalOpenSSL, nok))


def ensure():
    if os.path.exists(os.path.join(MQ, 'broker_key.pem')) and os.path.exists(os.path.join(UA, 'trusted', 'gateway_cert.der')):
        return
    ua_app('plant', True)
    gw = ua_app('gateway', False)
    ua_app('rogue', False)
    _w(os.path.join(UA, 'trusted', 'gateway_cert.der'), gw.public_bytes(serialization.Encoding.DER))
    mqtt_pki()


if __name__ == '__main__':
    ensure()
    print('PKI in', PKI)
