import sys
import os
import asyncio
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.modules.marketing.image_service import generate_and_save_marketing_image

async def main():
    test_content_id = uuid.uuid4()
    topic = "Enterprise AI Agents: Autonomous Partner Data Intake & Reconciliation"
    headline = "DataFactZ AI: Autonomous Enterprise Data Intake"
    subheadline = "Contract-based AI agents in your cloud with full human oversight."
    pillars = [
        "Ingest complex partner files & bordereaux",
        "Deterministic reconciliation & ledger matching",
        "Zero data drift with enterprise human review",
    ]

    print("=======================================================")
    print("TESTING DATAFACTZ BRANDED IMAGE GENERATION")
    print(f"Topic: {topic}")
    print(f"Headline: {headline}")
    print("=======================================================\n")

    public_url, provider_used, err = await generate_and_save_marketing_image(
        content_id=test_content_id,
        topic=topic,
        headline=headline,
        subheadline=subheadline,
        pillars=pillars,
        platform="instagram",
        company_name="DataFactZ",
    )

    print(f"Result Provider Used: {provider_used}")
    print(f"Generated Public URL: {public_url}")
    if err:
        print(f"Note / Fallback Reason: {err}")
    
    if public_url:
        filename = os.path.basename(public_url)
        local_path = os.path.join(os.path.dirname(__file__), "static", "generated_images", filename)
        if os.path.exists(local_path):
            size_kb = os.path.getsize(local_path) / 1024
            print(f"Saved Image File: {local_path} ({size_kb:.1f} KB)")
            print("\nSUCCESS: DataFactZ branded visual generated and verified!")
        else:
            print(f"Image URL returned but local file not found at: {local_path}")
    else:
        print("\nImage generation failed.")

if __name__ == "__main__":
    asyncio.run(main())
