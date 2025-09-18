import { kv } from '@vercel/kv';

export const config = {
  runtime: 'nodejs', // Use Node.js for better compatibility with scraping libraries
  maxDuration: 300,  // Background functions can have a much longer timeout
};

// --- AI Analysis Function ---
async function getAiAnalysis(oldHtml, newHtml) {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return null;
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${GEMINI_API_KEY}`;
    const systemPrompt = `You are an expert CRO specialist...`; // (Full prompt from previous versions)

    // ... (rest of the Gemini function is the same as the previous version)
    const requestBody = { /* ... */ };
    try {
        const response = await fetch(API_URL, { /* ... */ });
        // ...
        return JSON.parse(data.candidates[0].content.parts[0].text);
    } catch (error) {
        return null;
    }
}


// --- Scraping Function ---
async function fetchAndAnalyze(url) {
    const SCRAPERAPI_KEY = process.env.SCRAPERAPI_KEY;
    if (!SCRAPERAPI_KEY) return { content: null, error: "SCRAPERAPI_KEY is not set." };
    const scraperApiUrl = `http://api.scraperapi.com?api_key=${SCRAPERAPI_KEY}&url=${encodeURIComponent(url)}&render=true&country_code=gb`;
    try {
        const response = await fetch(scraperApiUrl);
        if (!response.ok) return { content: null, error: `Scraping API error: ${response.status}` };
        const currentHtml = await response.text();
        return { content: currentHtml, error: null };
    } catch (e) {
        return { content: null, error: e.message };
    }
}

function getSubcategoryFromUrl(url) { /* ... same as previous version ... */ }

// This is the main background worker function
export default async function handler(request) {
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

  // Instead of responding to the user, we save the final report to the database
  const finalReport = {
    lastUpdated: new Date().toISOString(),
    reportData: reportData,
  };
  await kv.set('latestReport', JSON.stringify(finalReport));

  return new Response(JSON.stringify({ success: true, message: "Scan processed and report saved." }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
