"""Local web server for the HMC digital twin.

Usage (from a terminal in this folder):
    python serve.py            -> http://localhost:8080
    python serve.py 9000       -> custom port
    python serve.py --no-open  -> do not open the browser
"""
import http.server
import socketserver
import sys
import threading
import webbrowser
from functools import partial
from pathlib import Path

ROOT = Path(__file__).resolve().parent
args = [a for a in sys.argv[1:] if not a.startswith("--")]
PORT = int(args[0]) if args else 8080
OPEN = "--no-open" not in sys.argv


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".js": "text/javascript"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *a):
        sys.stdout.write("  %s  %s\n" % (self.log_date_time_string(), fmt % a))


handler = partial(NoCacheHandler, directory=str(ROOT))
httpd = None
for port in range(PORT, PORT + 20):  # if the port is taken by another app, try the next one
    try:
        httpd = socketserver.ThreadingTCPServer(("127.0.0.1", port), handler)
        break
    except OSError:
        print(f"Port {port} is busy, trying {port + 1}...")
if httpd is None:
    sys.exit(f"No free port between {PORT} and {PORT + 19}.")

with httpd:
    url = f"http://localhost:{port}/index.html"
    print(f"HMC digital twin running at {url}   (Ctrl+C to stop)")
    if OPEN:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
