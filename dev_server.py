"""Serve the static frontend locally and proxy /api to the hosted backend."""

from __future__ import annotations

import argparse
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


DEFAULT_BACKEND = "https://api-medoptionstraining.overturegroup.com"
HOP_BY_HOP_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
}


class FrontendDevelopmentHandler(SimpleHTTPRequestHandler):
    backend_url = os.environ.get("MEDOPTIONS_REMOTE_API", DEFAULT_BACKEND).rstrip("/")

    def do_GET(self) -> None:
        self._dispatch()

    def do_POST(self) -> None:
        self._dispatch()

    def do_PUT(self) -> None:
        self._dispatch()

    def do_DELETE(self) -> None:
        self._dispatch()

    def do_OPTIONS(self) -> None:
        self._dispatch()

    def _dispatch(self) -> None:
        if self.path == "/api" or self.path.startswith("/api/"):
            self._proxy_api_request()
            return
        if self.command != "GET":
            self.send_error(405, "Method not allowed")
            return
        super().do_GET()

    def _proxy_api_request(self) -> None:
        target_path = self.path[4:] or "/"
        content_length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(content_length) if content_length else None
        headers: dict[str, str] = {}
        for header_name in ("Accept", "Content-Type", "Cookie"):
            if self.headers.get(header_name):
                headers[header_name] = self.headers[header_name]
        request = Request(
            f"{self.backend_url}{target_path}",
            data=body,
            headers=headers,
            method=self.command,
        )
        try:
            with urlopen(request, timeout=20) as response:
                self._send_proxy_response(response.status, response.headers, response.read())
        except HTTPError as error:
            self._send_proxy_response(error.code, error.headers, error.read())
        except (URLError, TimeoutError):
            payload = b'{"detail":"Could not reach the hosted backend"}'
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

    def _send_proxy_response(self, status_code: int, headers, body: bytes) -> None:
        self.send_response(status_code)
        for name, value in headers.items():
            lowered = name.lower()
            if lowered in HOP_BY_HOP_HEADERS or lowered in {"content-length", "access-control-allow-origin"}:
                continue
            if lowered == "set-cookie":
                value = value.replace("; Secure", "").replace("SameSite=None", "SameSite=Lax")
            self.send_header(name, value)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=5173)
    arguments = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", arguments.port), FrontendDevelopmentHandler)
    print(f"Med Options Training frontend: http://localhost:{arguments.port}/?api=proxy", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
