from playwright.sync_api import sync_playwright
import time

def verify_app():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto("http://localhost:3000/")
        # wait a bit for react rendering
        time.sleep(2)
        page.screenshot(path="verification.png")
        browser.close()

if __name__ == "__main__":
    verify_app()