import re


def clean_instagram_caption(raw_text: str) -> str:
    text = (raw_text or "").strip()
    text = re.sub(
        r"###\s*VISUAL\s+ASSET\s+SPECIFICATION[\s\S]*?(?=\n###|\Z)",
        "",
        text,
        flags=re.IGNORECASE,
    ).strip()

    caption_match = re.search(r"###\s*CAPTION\s*\n([\s\S]*?)(?=\n###|\Z)", text, flags=re.IGNORECASE)
    description_match = re.search(r"###\s*DESCRIPTION\s*\n([\s\S]*?)(?=\n###|\Z)", text, flags=re.IGNORECASE)
    hashtags_match = re.search(r"###\s*HASHTAGS\s*\n([\s\S]*?)(?=\n###|\Z)", text, flags=re.IGNORECASE)

    caption = caption_match.group(1).strip() if caption_match else ""
    hashtags = hashtags_match.group(1).strip() if hashtags_match else ""
    if hashtags:
        hashtags = " ".join(
            tag if tag.startswith("#") else f"#{tag}"
            for tag in hashtags.split()
        )

    # Use concise caption directly to prevent article dumps in social feeds
    if caption:
        return "\n\n".join(part for part in (caption, hashtags) if part).strip()

    if description_match:
        desc = description_match.group(1).strip()
        short_desc = desc.split("\n\n")[0] if "\n\n" in desc else desc[:280]
        return "\n\n".join(part for part in (short_desc, hashtags) if part).strip()

    cleaned = re.sub(r"###\s*[A-Z\s]+\n", "", text)
    cleaned = re.sub(r"##\s*[A-Z\s]+\n", "", cleaned)
    first_block = cleaned.split("\n\n")[0] if "\n\n" in cleaned else cleaned[:280]
    return first_block.strip()
