"""
Nexora.AI - Cloudflare Workers AI Image Generation CLI Tester
Tests the text-to-image pipeline using Black Forest Labs Flux-1-schnell on Cloudflare AI Edge.
"""

import asyncio
import base64
import os
import sys
import time

sys.path.append("backend")

from dotenv import load_dotenv
load_dotenv()

from app.integrations.cloudflare.image_client import CloudflareImageClient


async def main():
    print("=" * 80)
    print("  NEXORA.AI - CLOUDFLARE WORKERS AI IMAGE GENERATION TERMINAL TEST")
    print("=" * 80)

    client = CloudflareImageClient()

    if not client.is_configured:
        print("[!] ERROR: Cloudflare credentials missing from .env")
        print("    Ensure CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are set.")
        return

    print(f"[*] Cloudflare Account ID : {client.account_id[:6]}...{client.account_id[-4:]}")
    print(f"[*] Diffusion Model       : {client.model}")
    print(f"[*] Target AI Endpoint    : https://api.cloudflare.com/client/v4/accounts/.../ai/run/{client.model}")
    print("-" * 80)

    # Topic query
    topic = "AI-Driven Sales Forecasting"
    prompt = "Predictive machine learning models analyzing demand, supply chain optimization, and retail analytics"

    print(f"[*] Input Topic : '{topic}'")
    print(f"[*] Raw Prompt  : '{prompt}'")
    print("\n[*] Dispatching request to Cloudflare Workers AI edge GPU cluster...")

    start_time = time.time()
    try:
        result = await client.generate_branding_image(
            prompt=prompt,
            company_name="DataFactZ",
            topic=topic,
        )
    except Exception as exc:
        print(f"\n[!] Generation failed: {exc}")
        return

    elapsed = time.time() - start_time

    # Decode binary JPEG from base64
    data_uri = result["image_data_uri"]
    b64_content = data_uri.split(",", 1)[1] if "," in data_uri else data_uri
    image_bytes = base64.b64decode(b64_content)

    # Save to disk
    out_dir = os.path.join(os.getcwd(), "static", "generated_images")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "terminal_demo_flux.jpg")

    with open(out_path, "wb") as f:
        f.write(image_bytes)

    print("\n" + "=" * 80)
    print("  GENERATION COMPLETED SUCCESSFULLY!")
    print("=" * 80)
    print(f"  Execution Time   : {elapsed:.2f} seconds")
    print(f"  Model Used       : {result['model']}")
    print(f"  File Size        : {len(image_bytes):,} bytes ({len(image_bytes) / 1024:.1f} KB)")
    print(f"  Saved Image Path : {out_path}")
    print("\n[*] Full Prompt Optimized by Agent for Flux-1-schnell:")
    print(f"    \"{result['prompt']}\"")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(main())
