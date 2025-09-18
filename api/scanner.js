export const config = {
  runtime: 'edge',
};

// A simple in-memory store for demonstration. 
// A real app would use a database (like Vercel KV or a Redis instance).
const previousScans = new Map();

async function fetchAndHash(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    if (!response.ok) {
      console.error(`Failed to fetch ${url}: ${response.statusText}`);
      return { content: null, error: `HTTP error! status: ${response.status}` };
    }
    const text = await response.text();
    // A simple hash to represent the content. A real app might use a more robust method.
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    const hashString = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    return { hash: hashString, error: null };
  } catch (e) {
    console.error(`Error fetching or hashing ${url}:`, e);
    return { hash: null, error: e.message };
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
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const { urls } = await request.json();
  if (!urls || !Array.isArray(urls)) {
    return new Response(JSON.stringify({ error: 'Missing or invalid `urls` array in request body' }), { status: 400 });
  }

  const reportData = [];
  const today = new Date().toISOString().split('T')[0].replace('2024','2025');

  for (const url of urls) {
      const { hash: currentHash, error } = await fetchAndHash(url);
      
      if (error) {
        // Handle fetch errors gracefully
        reportData.push({
            scanDate: today,
            competitor: new URL(url).hostname.replace('www.', ''),
            url: url,
            subcategory: getSubcategoryFromUrl(url),
            changeDetected: false,
            changeStatus: "Scan Error",
            summary: error,
        });
        continue;
      }

      const previousHash = previousScans.get(url);
      const changeDetected = previousHash && currentHash !== previousHash;

      let summary = "Initial baseline scan completed.";
      if (previousHash) {
          summary = changeDetected ? "Content has changed since last scan." : "No significant changes detected.";
      }

      reportData.push({
        scanDate: today,
        competitor: new URL(url).hostname.replace('www.', ''),
        url: url,
        subcategory: getSubcategoryFromUrl(url),
        changeDetected: changeDetected,
        changeStatus: changeDetected ? "Permanent Rollout" : "No Change",
        changeCategory: changeDetected ? "Content Update" : "N/A",
        summary: summary,
        insight: changeDetected ? "A change was detected. Manual review is recommended to determine strategic impact." : "N/A",
        hypothesis: changeDetected ? "A/B test hypothesis could be formulated after manual review." : "N/A",
      });

      // Update the "database" with the new hash for the next scan
      previousScans.set(url, currentHash);
  }

  return new Response(JSON.stringify({
    lastUpdated: new Date().toISOString(),
    reportData: reportData,
  }), {
    headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // Required for Vercel Hobby plan
    },
  });
}

