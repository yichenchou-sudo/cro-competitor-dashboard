import { kv } from '@vercel/kv';

export const config = {
  runtime: 'nodejs',
  maxDuration: 300,
};

// --- AI Analysis Function ---
async function getAiAnalysis(oldHtml, newHtml) {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return null;
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${GEMINI_API_KEY}`;
    const systemPrompt = `You are an expert Conversion Rate Optimization (CRO) specialist. You will be given two HTML snippets from the same webpage: an old version and a new version. Your task is to identify the single most significant strategic change between them. Ignore minor changes like updated dates, copyright years, or random tracking IDs. Focus on changes to headlines, calls-to-action (CTAs), forms, pricing, social proof, or overall value proposition. Respond ONLY with a valid JSON object with the following structure: { "changeCategory": "string", "summary": "string", "insight": "string", "hypothesis": "string" }`;

    const requestBody = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: `Here is the old HTML:\n\`\`\`html\n${oldHtml}\n\`\`\`\n\nHere is the new HTML:\n\`\`\`html\n${newHtml}\n\`\`\`` }] }],
      generationConfig: { responseMimeType: "application/json" }
    };
    try {
        const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
        if (!response.ok) { console.error("Gemini API Error:", await response.text()); return null; }
        const data = await response.json();
        return JSON.parse(data.candidates[0].content.parts[0].text);
    } catch (error) { console.error('Error calling Gemini API:', error); return null; }
}

// --- Scraping Function ---
async function fetchAndAnalyze(url) {
    const SCRAPERAPI_KEY = process.env.SCRAPERAPI_KEY;
    if (!SCRAPERAPI_KEY) return { content: null, error: "SCRAPERAPI_KEY is not set." };
    const scraperApiUrl = `http://api.scraperapi.com?api_key=${SCRAPERAPI_KEY}&url=${encodeURIComponent(url)}&render=true&country_code=gb`;
    try {
        const response = await fetch(scraperApiUrl, { signal: AbortSignal.timeout(290000) }); // Add timeout
        if (!response.ok) return { content: null, error: `Scraping API error: ${response.status}` };
        const currentHtml = await response.text();
        return { content: currentHtml, error: null };
    } catch (e) {
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
    } catch(e) {}
    return 'General';
}

// This is the main background worker function
export default async function handler(request) {
  try {
    const { urls } = await request.json();
    const reportData = [];
    const today = new Date().toISOString().split('T')[0].replace('2024', '2025');

    for (const url of urls) {
      const dbKey = `scan:${encodeURIComponent(url)}`;
      const { content: currentHtml, error } = await fetchAndAnalyze(url);
      const competitor = new URL(url).hostname.replace('www.', '');
      const subcategory = getSubcategoryFromUrl(url);

      if (error) {
        reportData.push({ scanDate: today, competitor, url, subcategory, changeDetected: false, changeStatus: "Scan Error", summary: error });
        continue;
      }

      const previousHtml = await kv.get(dbKey);
      const changeDetected = previousHtml && currentHtml !== previousHtml;

      if (changeDetected) {
        const analysis = await getAiAnalysis(previousHtml, currentHtml);
        if (analysis) {
          reportData.push({ scanDate: today, competitor, url, subcategory, changeDetected: true, changeStatus: "Permanent Rollout", ...analysis });
        } else {
          reportData.push({ scanDate: today, competitor, url, subcategory, changeDetected: true, changeStatus: "Permanent Rollout", changeCategory: "Content Update", summary: "Change detected, but AI analysis failed." });
        }
      } else {
        reportData.push({ scanDate: today, competitor, url, subcategory, changeDetected: false, changeStatus: previousHtml ? "No Change" : "Baseline Scan" });
      }
      await kv.set(dbKey, currentHtml);
    }

    const finalReport = {
      lastUpdated: new Date().toISOString(),
      reportData: reportData,
    };
    await kv.set('latestReport', JSON.stringify(finalReport));

    return new Response(JSON.stringify({ success: true, message: "Scan processed and report saved." }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in process-scan:', error);
    // Note: This response doesn't go to the user, but is useful for server logs
    return new Response(JSON.stringify({ error: `A server error occurred: ${error.message}` }), {
      status: 500,
    });
  }
}

