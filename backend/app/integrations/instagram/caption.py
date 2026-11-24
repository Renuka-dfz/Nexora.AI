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

    if caption_match or description_match:
        caption = caption_match.group(1).strip() if caption_match else ""
        description = description_match.group(1).strip() if description_match else ""
        hashtags = hashtags_match.group(1).strip() if hashtags_match else ""
        if hashtags:
            hashtags = " ".join(
                tag if tag.startswith("#") else f"#{tag}"
                for tag in hashtags.split()
            )
        return "\n\n".join(part for part in (caption, description, hashtags) if part)[:2200].strip()

    cleaned = re.sub(r"###\s*[A-Z\s]+\n", "", text)
    cleaned = re.sub(r"##\s*[A-Z\s]+\n", "", cleaned)
    return cleaned[:2200].strip()
