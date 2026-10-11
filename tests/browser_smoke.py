"""Real Chromium smoke tests. Start serve.py first, then run this script."""

import argparse
import json
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]


def run(url, screenshot_dir=None):
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1100})
        errors = []
        jobs = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("request", lambda request: jobs.append(request.url) if "/api/run?" in request.url else None)
        page.goto(url)
        expect(page.locator("#experiment-status")).to_have_text("QUANTUM WORLD READY", timeout=30000)
        expect(page.locator("#play")).to_be_enabled()
        expect(page.locator("#histogram")).to_have_attribute("aria-label", "Noise p 0: 00, 100.0 percent; 01, 0.0 percent; 10, 0.0 percent; 11, 0.0 percent. Dashed bars show ideal channel reference.")
        assert len(jobs) == 1, "Startup must submit exactly one circuit."

        # Inspect all layers, without playing or submitting a new job.
        page.locator("#explore").fill("160")
        page.locator("#explore").dispatch_event("input")
        expect(page.locator("#level-name")).to_have_text("CHAOS")
        expect(page.locator("#noise-value")).to_have_text("p = 0.500")
        page.locator("#explore").fill("0")
        page.locator("#explore").dispatch_event("input")

        if screenshot_dir:
            path = Path(screenshot_dir)
            path.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=path / "coherence-runner-desktop.png", full_page=True)

        page.locator("#play").click()
        expect(page.locator("#game-overlay")).to_be_hidden()
        expect(page.locator("#explore")).to_be_disabled()
        page.wait_for_timeout(1400)
        page.keyboard.down("Space")
        page.wait_for_timeout(410)
        page.keyboard.up("Space")
        page.keyboard.press("p")
        expect(page.locator("#pause-hint")).to_be_visible()
        expect(page.locator("#event-log")).to_contain_text("CHAOS")
        if screenshot_dir:
            page.screenshot(path=Path(screenshot_dir) / "coherence-runner-experiment.png", full_page=True)
        frozen_score = page.locator("#score").inner_text()
        page.wait_for_timeout(250)
        assert page.locator("#score").inner_text() == frozen_score
        page.locator("#explore").fill("64")
        page.locator("#explore").dispatch_event("input")
        expect(page.locator("#level-name")).to_have_text("DRIFT")
        page.locator("#pause").click()
        expect(page.locator("#pause-hint")).to_be_hidden()

        # The first cactus ends an unattended run. Restart must not submit a job.
        expect(page.locator("#overlay-title")).to_have_text("Game over.", timeout=10000)
        assert int(page.locator("#score").inner_text()) > 0
        page.locator("#play").click()
        expect(page.locator("#game-overlay")).to_be_hidden()
        # Hold controls are also real keyboard controls, not pointer-only buttons.
        page.locator("#touch-jump").focus()
        page.keyboard.down("Enter")
        page.wait_for_timeout(410)
        page.keyboard.up("Enter")
        page.keyboard.press("p")
        expect(page.locator("#pause-hint")).to_be_visible()
        expect(page.locator("#event-log")).to_contain_text("CHAOS")
        assert len(jobs) == 1, "Replays and the explorer must never submit jobs."

        page.locator(".lab-details summary").click()
        with page.expect_download() as download_event:
            page.locator("#export").click()
        export = json.loads(Path(download_event.value.path()).read_text())
        assert export["table"]["shots"] == 1024
        assert len(export["table"]["levels"]) == 5
        assert export["table"]["qubits"] == 20
        assert not errors, f"Browser errors: {errors}"
        print("PASS: desktop startup, histograms, held jump, pause, game over, replay, JSON export, one job")

        # Check the actual Qollab entry with a narrow bridge-shaped adapter. This is
        # not a substitute for running Qollab itself; it tests the JS call contract.
        harness = browser.new_page(viewport={"width": 1280, "height": 1000})
        harness_errors = []
        harness.on("pageerror", lambda error: harness_errors.append(str(error)))
        markup = (ROOT / "index.html").read_text()
        adapter = """
          <script type="importmap">{"imports":{"qiskit":"/bridge-qiskit.js"}}</script>
          <script type="module">
            globalThis.jobCalls = 0;
            globalThis.backend = { async run(circuit, options) {
              globalThis.jobCalls++;
              const params = new URLSearchParams({circuit: JSON.stringify(circuit), shots: options.shots});
              const response = await fetch('/api/run?' + params);
              const result = await response.json();
              return { async result() { return { get_counts() {
                return { toJs() { return new Map(Object.entries(result.counts)); } };
              } }; } };
            } };
            await import('/main.js');
          </script>
        """
        harness.route("**/qollab-harness", lambda route: route.fulfill(
            content_type="text/html", body=f'<html><head><link rel="stylesheet" href="/main.css"></head><body>{markup}{adapter}</body></html>'
        ))
        harness.route("**/main.js", lambda route: route.fulfill(content_type="text/javascript", body=(ROOT / "main.js").read_text()))
        harness.route("**/bridge-qiskit.js", lambda route: route.fulfill(
            content_type="text/javascript", body="export {recordCircuit as QuantumCircuit} from '/local/circuit-recorder.js';"
        ))
        harness.goto(url + "/qollab-harness")
        expect(harness.locator("#experiment-status")).to_have_text("QUANTUM WORLD READY", timeout=30000)
        harness.locator("#play").click()
        harness.keyboard.press("p")
        assert harness.evaluate("globalThis.jobCalls") == 1
        assert not harness_errors, harness_errors
        print("PASS: main.js Qiskit bridge contract, Map counts, one backend.run call")

        mobile = browser.new_page(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True)
        mobile_errors = []
        mobile.on("pageerror", lambda error: mobile_errors.append(str(error)))
        mobile.goto(url)
        expect(mobile.locator("#experiment-status")).to_have_text("QUANTUM WORLD READY", timeout=30000)
        assert mobile.evaluate("document.documentElement.scrollWidth <= innerWidth"), "Mobile horizontal overflow"
        mobile.locator("#touch-jump").scroll_into_view_if_needed()
        box = mobile.locator("#touch-jump").bounding_box()
        session = mobile.context.new_cdp_session(mobile)
        session.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [
            {"x": box["x"] + box["width"] / 2, "y": box["y"] + box["height"] / 2}
        ]})
        mobile.wait_for_timeout(180)
        session.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        expect(mobile.locator("#game-overlay")).to_be_hidden()
        mobile.locator("#pause").tap()
        expect(mobile.locator("#pause-hint")).to_be_visible()
        if screenshot_dir:
            mobile.screenshot(path=Path(screenshot_dir) / "coherence-runner-mobile.png", full_page=True)
        assert not mobile_errors, mobile_errors
        print("PASS: mobile layout, touch start, pause")

        failed = browser.new_page()
        failed.route("**/api/run?*", lambda route: route.fulfill(
            status=503, content_type="application/json", body='{"error":"Test backend unavailable"}'
        ))
        failed.goto(url)
        expect(failed.locator("#experiment-status")).to_have_text("EXPERIMENT COULD NOT RUN")
        expect(failed.locator("#play")).to_be_disabled()
        expect(failed.locator("#experiment-detail")).to_have_text("Test backend unavailable")
        print("PASS: backend failure is explicit, no synthetic fallback")
        browser.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8000")
    parser.add_argument("--screenshots", help="Optional screenshot directory")
    args = parser.parse_args()
    run(args.url.rstrip("/"), args.screenshots)
