export const config = {
  runtime: 'edge',
};

// IMPORTANT: In a real production app, you would use a persistent database like Vercel KV, Upstash, or Supabase
// to store previous scans. This in-memory Map will reset every time the serverless function restarts.
const previousScans = new Map();

// --- Gemini AI Analysis Function ---
async function getAiAnalysis(oldHtml, newHtml) {
  // In Vercel, you would set your GEMINI_API_KEY in the project's Environment Variables settings.
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) return null;
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${GEMINI_API_KEY}`;

  const systemPrompt = `You are an expert Conversion Rate Optimization (CRO) specialist.
    You will be given two HTML snippets from the same webpage: an old version and a new version.
    Your task is to identify the single most significant strategic change between them.
    Ignore minor changes like updated dates, copyright years, or random tracking IDs.
    Focus on changes to headlines, calls-to-action (CTAs), forms, pricing, social proof, or overall value proposition.

    Respond ONLY with a valid JSON object with the following structure:
    {
      "changeCategory": "string", // e.g., "Headline Test", "Form Optimization", "CTA Change", "Social Proof", "Pricing Update", "Content Update"
      "summary": "string", // A concise, one-sentence summary of what changed.
      "insight": "string", // A brief analysis of WHY the change was likely made.
      "hypothesis": "string" // A formal A/B test hypothesis that the user could run on their own site, inspired by this change.
    }`;

  const requestBody = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ parts: [{ text: `Here is the old HTML:\n\`\`\`html\n${oldHtml}\n\`\`\`\n\nHere is the new HTML:\n\`\`\`html\n${newHtml}\n\`\`\`` }] }],
    generationConfig: { responseMimeType: "application/json" }
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) {
      console.error("Gemini API Error:", await response.text());
      return null;
    }
    const data = await response.json();
    return JSON.parse(data.candidates[0].content.parts[0].text);
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return null;
  }
}

// --- DEFINITIVE Core Scanner Logic using a Specialized Scraping API ---
async function fetchAndAnalyze(url) {
  const SCRAPERAPI_KEY = process.env.SCRAPERAPI_KEY;
  if (!SCRAPERAPI_KEY) {
      return { content: null, error: "SCRAPERAPI_KEY is not set in environment variables." };
  }
  
  // We construct a URL to ScraperAPI's service, telling it to render JS and use a UK proxy.
  const scraperApiUrl = `http://api.scraperapi.com?api_key=${SCRAPERAPI_KEY}&url=${encodeURIComponent(url)}&render=true&country_code=gb`;

  try {
    const response = await fetch(scraperApiUrl);

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`ScraperAPI Error for ${url}: ${errorText}`);
        return { content: null, error: `Scraping API error: ${response.status}` };
    }
    
    const currentHtml = await response.text();
    return { content: currentHtml, error: null };
  } catch (e) {
    console.error(`Error calling ScraperAPI for ${url}:`, e);
    return { content: null, error: e.message };
  }
}


function getSubcategoryFromUrl(url) {
    try {
        const urlObject = new URL(url);
        const pathSegments = urlObject.pathname.split('/').filter(Boolean);
        if (pathSegments.length > 0) {
            const meaningfulSegment = pathSegments.find(s => s.length > 3 && s !== 'uk' && s !== 'com') || pathSegments.pop();
            return meaningfulSegment.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
    } catch(e) { /* ignore */ }
    return 'General';
}

export default async function handler(request) {
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });

  const { urls } = await request.json();
  if (!urls || !Array.isArray(urls)) return new Response(JSON.stringify({ error: 'Invalid `urls` array' }), { status: 400 });

  const reportData = [];
  const today = new Date().toISOString().split('T')[0].replace('2024','2025');

  for (const url of urls) {
    const { content: currentHtml, error } = await fetchAndAnalyze(url);
    const competitor = new URL(url).hostname.replace('www.', '');
    const subcategory = getSubcategoryFromUrl(url);
    
    if (error) {
      reportData.push({ scanDate: today, competitor, url, subcategory, changeDetected: false, changeStatus: "Scan Error", summary: error });
      continue;
    }

    const previousHtml = previousScans.get(url);
    const changeDetected = previousHtml && currentHtml !== previousHtml;

    if (changeDetected) {
      const analysis = await getAiAnalysis(previousHtml, currentHtml);
      if (analysis) {
        reportData.push({
          scanDate: today, competitor, url, subcategory, changeDetected: true,
          changeStatus: "Permanent Rollout",
          ...analysis
        });
      } else {
        reportData.push({ scanDate: today, competitor, url, subcategory, changeDetected: true, changeStatus: "Permanent Rollout", changeCategory: "Content Update", summary: "Change detected, but AI analysis failed." });
      }
    } else {
      reportData.push({ scanDate: today, competitor, url, subcategory, changeDetected: false, changeStatus: previousHtml ? "No Change" : "Baseline Scan" });
    }
    
    previousScans.set(url, currentHtml);
  }

  return new Response(JSON.stringify({
    lastUpdated: new Date().toISOString(),
    reportData: reportData,
  }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

