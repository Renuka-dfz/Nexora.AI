export interface ParsedInstagramContent {
  caption: string;
  description: string;
  hashtags: string[];
  seoKeywords: string[];
  visualSpec?: {
    headline: string;
    subhead: string;
    pillars: string[];
    metric: string;
  };
  videoScenes?: Array<{
    scene_num: number;
    time_range: string;
    title: string;
    visual: string;
    voiceover: string;
  }>;
}

export function parseInstagramContent(
  text: string,
  defaultTitle: string = 'DataFactZ Enterprise AI'
): ParsedInstagramContent {
  if (!text) {
    return {
      caption: defaultTitle,
      description: '',
      hashtags: ['#DataFactZ', '#EnterpriseAI', '#DataEngineering'],
      seoKeywords: ['enterprise ai', 'data platform', 'pgvector', 'ai governance'],
    };
  }

  let caption = '';
  let description = '';
  let hashtags: string[] = [];
  let seoKeywords: string[] = [];

  // Check for structured markdown headers
  const captionMatch = text.match(/### CAPTION\s*\n([\s\S]*?)(?=\n###|\n\n###|$)/i);
  const descMatch = text.match(/### DESCRIPTION\s*\n([\s\S]*?)(?=\n###|\n\n###|$)/i);
  const hashMatch = text.match(/### HASHTAGS\s*\n([\s\S]*?)(?=\n###|\n\n###|$)/i);
  const seoMatch = text.match(/### SEO KEYWORDS\s*\n([\s\S]*?)(?=\n###|\n\n###|$)/i);

  if (captionMatch || descMatch) {
    caption = captionMatch ? captionMatch[1].trim() : '';
    description = descMatch ? descMatch[1].trim() : '';

    if (hashMatch) {
      hashtags = hashMatch[1]
        .split(/[\s,]+/)
        .map((t) => t.trim())
        .filter((t) => t.startsWith('#') || t.length > 0)
        .map((t) => (t.startsWith('#') ? t : `#${t}`));
    }

    if (seoMatch) {
      seoKeywords = seoMatch[1]
        .split(/[,;\n]+/)
        .map((k) => k.trim())
        .filter((k) => k.length > 0);
    }
  } else {
    // Fallback heuristic parser for raw text
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

    // Find any hashtag lines
    const tagLines = lines.filter((l) => l.startsWith('#') && !l.startsWith('###'));
    const nonTagLines = lines.filter((l) => !l.startsWith('#'));

    if (tagLines.length > 0) {
      hashtags = tagLines
        .join(' ')
        .split(/\s+/)
        .filter((t) => t.startsWith('#'));
    }

    if (nonTagLines.length > 0) {
      caption = nonTagLines[0];
      description = nonTagLines.slice(1).join('\n\n');
    } else {
      caption = defaultTitle;
      description = text;
    }

    seoKeywords = [
      defaultTitle.toLowerCase(),
      'enterprise ai architecture',
      'pgvector embeddings',
      'data engineering',
      'deterministic workflows',
    ];
  }

  // Ensure safe defaults
  if (!caption) caption = defaultTitle;
  if (hashtags.length === 0) {
    hashtags = ['#DataFactZ', '#EnterpriseAI', '#DataEngineering', '#CloudData', '#AIGovernance'];
  }
  if (seoKeywords.length === 0) {
    seoKeywords = ['enterprise ai', 'rag architecture', 'data engineering', 'pgvector'];
  }

  // Extract visual banner specifications if present
  let visualSpec: ParsedInstagramContent['visualSpec'] = undefined;
  const headlineMatch = text.match(/\*\*Headline:\*\*\s*(.*)/i);
  const subheadMatch = text.match(/\*\*Subhead:\*\*\s*(.*)/i);
  const metricMatch = text.match(/\*\*Metric:\*\*\s*(.*)/i);

  if (headlineMatch || subheadMatch) {
    visualSpec = {
      headline: headlineMatch ? headlineMatch[1].trim() : defaultTitle,
      subhead: subheadMatch ? subheadMatch[1].trim() : 'Deterministic AI Workflows & Governed Vector Ingestion',
      pillars: [
        'Pillar 1: Governed Enterprise Ingestion (pgvector)',
        'Pillar 2: Deterministic LangGraph Agent Execution',
        'Pillar 3: Human-in-the-Loop Audit & Verification',
      ],
      metric: metricMatch ? metricMatch[1].trim() : '99.4% Factual Grounding',
    };
  }

  return {
    caption,
    description,
    hashtags,
    seoKeywords,
    visualSpec,
  };
}
