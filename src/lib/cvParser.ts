const CV_PARSER_URL = "https://cv-parser.charazay432.workers.dev";

export interface CvParseResult {
  name: string;
  email: string;
  phone: string;
  summary: string;
  tags: string[];
}

export async function parseCvText(text: string): Promise<CvParseResult> {
  const response = await fetch(CV_PARSER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: text.slice(0, 8000) }),
  });

  if (!response.ok) {
    throw new Error(`CV parsing failed (${response.status})`);
  }

  const json = await response.json();
  if (!json.ok || !json.data) {
    throw new Error("CV parsing returned invalid response");
  }

  return {
    name: json.data.name || "",
    email: json.data.email || "",
    phone: json.data.phone || "",
    summary: json.data.summary || "",
    tags: Array.isArray(json.data.tags) ? json.data.tags : [],
  };
}
