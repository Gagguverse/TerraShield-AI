import asyncio
import json
from playwright.async_api import async_playwright

async def verify():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 900})
        
        requests_log = []
        page.on("response", lambda resp: requests_log.append({
            "url": resp.url[:120],
            "status": resp.status,
            "contentType": resp.headers.get("content-type", "")
        }))
        
        print("Navigating to http://localhost:5173...")
        await page.goto("http://localhost:5173", wait_until="networkidle", timeout=20000)
        await asyncio.sleep(2)
        
        # 1. Capture Initial View (Dark Street Map)
        await page.screenshot(path="scratch_dark_street.png")
        print("Saved scratch_dark_street.png")
        
        # 2. Switch to Satellite Imagery
        sat_btn = page.locator("button:has-text('Satellite Imagery')")
        await sat_btn.click()
        await asyncio.sleep(2)
        
        # Fly to Lucknow directly via Leaflet eval to test zoom 14 high detail
        await page.evaluate("""() => {
            const mapContainer = document.querySelector('.rocket-leaflet-map');
            if (mapContainer && window.L) {
                // Find leaflet map instance
                for (const key in mapContainer) {
                    if (key.startsWith('_leaflet_id')) {
                        // Leaflet stores map instance in Leaflet internal registry or window
                    }
                }
            }
        }""")
        
        # Or change region dropdown to Uttar Pradesh & Lucknow
        region_select = page.locator("select[title='Change Monitoring Region']")
        if await region_select.count() > 0:
            options = await region_select.locator("option").all_inner_texts()
            print("Available regions in UI:", options)
            # Check if Lucknow or INDIA_UP is in options
            await region_select.select_option(value="INDIA_UP")
            await asyncio.sleep(3)
        
        # Capture Lucknow High-Res Satellite View (with Street Labels ON)
        await page.screenshot(path="scratch_lucknow_satellite_highres.png")
        print("Saved scratch_lucknow_satellite_highres.png")
        
        # Toggle Street Labels OFF
        labels_btn = page.locator("button:has-text('Labels ON')")
        if await labels_btn.count() > 0:
            await labels_btn.click()
            await asyncio.sleep(1.5)
            await page.screenshot(path="scratch_lucknow_satellite_no_labels.png")
            print("Saved scratch_lucknow_satellite_no_labels.png")
            # Toggle labels back ON
            await page.locator("button:has-text('Labels OFF')").click()
            await asyncio.sleep(1)
        
        # Switch to NASA Daily (375m)
        nasa_btn = page.locator("button:has-text('NASA Daily')")
        if await nasa_btn.count() > 0:
            await nasa_btn.click()
            await asyncio.sleep(2)
            await page.screenshot(path="scratch_lucknow_nasa_gibs.png")
            print("Saved scratch_lucknow_nasa_gibs.png")
        
        # Switch to Street / Geography Map
        geo_btn = page.locator("button:has-text('Street / Geography')")
        await geo_btn.click()
        await asyncio.sleep(2)
        await page.screenshot(path="scratch_lucknow_street_geography.png")
        print("Saved scratch_lucknow_street_geography.png")
        
        # Inspect network requests summary
        esri_reqs = [r for r in requests_log if "server.arcgisonline.com" in r["url"]]
        carto_reqs = [r for r in requests_log if "basemaps.cartocdn.com" in r["url"]]
        gibs_reqs = [r for r in requests_log if "gibs.earthdata.nasa.gov" in r["url"]]
        
        print("\n--- Network Tile Inspection ---")
        print(f"Esri High-Res Tiles: {len(esri_reqs)} requests, 200 OK: {sum(1 for r in esri_reqs if r['status'] == 200)}")
        print(f"CARTO Tiles / Labels: {len(carto_reqs)} requests, 200 OK: {sum(1 for r in carto_reqs if r['status'] == 200)}")
        print(f"NASA GIBS Tiles: {len(gibs_reqs)} requests, 200 OK: {sum(1 for r in gibs_reqs if r['status'] == 200)}")
        
        # Check failed tile requests (status != 200)
        failed_tiles = [r for r in requests_log if r["status"] not in (200, 304) and ("tile" in r["url"] or "png" in r["url"] or "jpg" in r["url"])]
        print(f"Failed tile requests (non-200/304): {len(failed_tiles)}")
        for ft in failed_tiles[:5]:
            print("  Failed:", ft)
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify())
