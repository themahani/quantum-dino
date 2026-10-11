"""Local development only. Qollab runs main.js directly, without this server."""

import argparse
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from urllib.parse import parse_qs, urlsplit

from local.quantum_backend import run_experiment

ROOT = Path(__file__).resolve().parent
PUBLIC_FILES = {
    "main.css": "text/css",
    "app.js": "text/javascript",
    "game.js": "text/javascript",
    "renderer.js": "text/javascript",
    "quantum.js": "text/javascript",
    "local/entry.js": "text/javascript",
    "local/circuit-recorder.js": "text/javascript",
}


def make_handler(simulator):
    lock = Lock()

    class Handler(BaseHTTPRequestHandler):
        def respond(self, status, content, content_type):
            data = content.encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", f"{content_type}; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            url = urlsplit(self.path)
            if url.path == "/":
                content = (ROOT / "index.html").read_text()
                page = (
                    '<!doctype html><html lang="en"><head><meta charset="utf-8">'
                    '<meta name="viewport" content="width=device-width, initial-scale=1">'
                    '<title>Coherence Runner — Jump higher. Lose coherence.</title>'
                    '<link rel="icon" href="data:,"><link rel="stylesheet" href="/main.css">'
                    f'</head><body>{content}<script type="module" src="/local/entry.js"></script>'
                    '</body></html>'
                )
                self.respond(200, page, "text/html")
            elif url.path == "/api/run":
                try:
                    if len(url.query) > 12000:
                        raise ValueError("Circuit specification too large.")
                    params = parse_qs(url.query)
                    spec = json.loads(params.get("circuit", [""])[0])
                    shots = int(params.get("shots", ["1024"])[0])
                    with lock:
                        result = run_experiment(spec, shots, simulator)
                    self.respond(200, json.dumps(result), "application/json")
                except (ValueError, TypeError, KeyError) as error:
                    self.respond(400, json.dumps({"error": str(error)}), "application/json")
                except Exception as error:
                    self.log_error("Simulation failed: %s", error)
                    self.respond(500, json.dumps({"error": "Local simulation failed. See server output."}), "application/json")
            elif url.path.lstrip("/") in PUBLIC_FILES:
                name = url.path.lstrip("/")
                self.respond(200, (ROOT / name).read_text(), PUBLIC_FILES[name])
            else:
                self.respond(404, "Not found", "text/plain")

    return Handler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--simulator", choices=["aer", "basic"], default="aer")
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), make_handler(args.simulator))
    print(f"Coherence Runner: http://{args.host}:{args.port} ({args.simulator})", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
