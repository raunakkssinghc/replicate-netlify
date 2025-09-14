import Replicate from "replicate";

// Set up Replicate
const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN
});

// Retry function for AI extraction
async function extractJobDetailsWithRetry(jobTitle, jobDescription, maxRetries = 3) {
    const prompt = `You are an AI that extracts job details and always outputs a single valid JSON object.

Input:
Job Title: ${jobTitle}
Job Description: ${jobDescription}

Rules:
- Clean the job title:
  • Remove company names, departments, timelines, and duplicate words
  • Keep only role + specialization + seniority (e.g., "Senior Data Engineer Intern")
- Extract:
  • city → only city/state abbreviation (e.g., "Richmond, VA" not "Richmond, Virginia"), drop country. If multiple cities listed, pick the FIRST one only. If not found, return null.
  • work_arrangement → one of: ["remote", "hybrid", "on-site"]. CRITICAL: Always return lowercase only ("hybrid" not "Hybrid"). If not found, return null.
  • experience → one of:
      - Entry (0-2 Years)
      - Mid (3-5 Years)
      - Senior (6-8 Years)
      - Lead (8+ Years)
    If unclear, return null.
- CRITICAL: DO NOT MAKE UP INFORMATION. Only extract what is explicitly stated in the job description.
- For experience level: Look for explicit mentions of years of experience, seniority keywords, or job level indicators. If none are found, return null.
- Experience level mapping (CRITICAL - follow this exactly):
  • "1+ years" or "minimum 1 year" = Entry (0-2 Years)
  • "2+ years" or "minimum 2 years" = Mid (3-5 Years)
  • "5+ years" or "minimum 5 years" = Senior (6-8 Years)
  • "8+ years" or "minimum 8 years" = Lead (8+ Years)
- IMPORTANT: "2+ years" ALWAYS equals Mid (3-5 Years), NOT Entry
- Do not infer experience level from job title alone unless it clearly indicates seniority (e.g., "Senior", "Lead", "Principal").
- Output must be strictly JSON, no extra text, no explanations.
- FINAL CHECK: work_arrangement must be lowercase ("hybrid", "remote", "on-site") - NEVER capitalized.

Output Format (use this structure but extract from the ACTUAL job description above):
{
  "job_title": "[extract from job title]",
  "city": "[extract from job description or null]",
  "work_arrangement": "[remote/hybrid/on-site or null] (MUST be lowercase)",
  "experience": "[Entry (0-2 Years)/Mid (3-5 Years)/Senior (6-8 Years)/Lead (8+ Years) or null]"
}`;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const input = {
                prompt: prompt,
                max_new_tokens: 200
            };

            const output = await replicate.run("deepseek-ai/deepseek-v3.1", { input });
            const responseText = output.join("").trim();
            
            // Try to parse as JSON
            try {
                const jsonResult = JSON.parse(responseText);
                
                // Validate required fields
                if (jsonResult.job_title && 
                    (jsonResult.city === null || typeof jsonResult.city === 'string') &&
                    (jsonResult.work_arrangement === null || ['remote', 'hybrid', 'on-site'].includes(jsonResult.work_arrangement)) &&
                    (jsonResult.experience === null || ['Entry (0-2 Years)', 'Mid (3-5 Years)', 'Senior (6-8 Years)', 'Lead (8+ Years)'].includes(jsonResult.experience))) {
                    return jsonResult;
                }
            } catch (parseError) {
                console.log(`Attempt ${attempt}: Invalid JSON, retrying...`);
                if (attempt === maxRetries) {
                    throw new Error(`Failed to extract valid JSON after ${maxRetries} attempts. Last response: ${responseText}`);
                }
            }
        } catch (error) {
            console.log(`Attempt ${attempt} failed:`, error.message);
            if (attempt === maxRetries) {
                throw error;
            }
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
}

// Netlify Function handler
export const handler = async (event, context) => {
    // Handle CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        let job_title, job_description;
        
        // Check Content-Type to determine how to parse the body
        const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
        
        if (contentType.includes('application/json')) {
            // Parse JSON body
            const body = JSON.parse(event.body);
            job_title = body.job_title;
            job_description = body.job_description;
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
            // Parse form data
            const params = new URLSearchParams(event.body);
            job_title = params.get('job_title');
            job_description = params.get('job_description');
        } else if (contentType.includes('multipart/form-data')) {
            // Parse multipart form data
            console.log('Processing multipart form data');
            console.log('Content-Type:', contentType);
            console.log('Body type:', typeof event.body);
            console.log('Body content:', event.body);
            
            // For Netlify Functions, multipart data might be in different formats
            if (typeof event.body === 'object' && event.body !== null) {
                // If body is already parsed as an object
                console.log('Body is object, keys:', Object.keys(event.body));
                job_title = event.body.job_title;
                job_description = event.body.job_description;
            } else if (typeof event.body === 'string') {
                // If body is still a string, try to parse it manually
                console.log('Body is string, length:', event.body.length);
                const boundary = contentType.split('boundary=')[1];
                console.log('Boundary:', boundary);
                
                if (boundary) {
                    const parts = event.body.split(`--${boundary}`);
                    console.log('Number of parts:', parts.length);
                    
                    for (let i = 0; i < parts.length; i++) {
                        const part = parts[i];
                        console.log(`Part ${i}:`, part.substring(0, 200) + '...');
                        
                        if (part.includes('name="job_title"')) {
                            const match = part.match(/name="job_title"\s*\r?\n\r?\n(.*?)(?:\r?\n|$)/s);
                            if (match) {
                                job_title = match[1].trim();
                                console.log('Found job_title:', job_title);
                            }
                        }
                        if (part.includes('name="job_description"')) {
                            const match = part.match(/name="job_description"\s*\r?\n\r?\n(.*?)(?:\r?\n|$)/s);
                            if (match) {
                                job_description = match[1].trim();
                                console.log('Found job_description:', job_description);
                            }
                        }
                    }
                }
            }
            
            console.log('Final job_title:', job_title);
            console.log('Final job_description:', job_description);
        } else {
            // Try to parse as JSON by default
            try {
                const body = JSON.parse(event.body);
                job_title = body.job_title;
                job_description = body.job_description;
            } catch (parseError) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({
                        error: "Invalid request format. Use JSON or URL-encoded form data."
                    })
                };
            }
        }
        
        // If we still don't have the data, try checking query parameters as a fallback
        if ((!job_title || !job_description) && event.queryStringParameters) {
            console.log('Checking query parameters as fallback');
            job_title = job_title || event.queryStringParameters.job_title;
            job_description = job_description || event.queryStringParameters.job_description;
        }

        // Validate required fields
        if (!job_title || !job_description) {
            console.log('Validation failed - missing required fields');
            console.log('job_title:', job_title);
            console.log('job_description:', job_description);
            console.log('Content-Type:', event.headers['content-type']);
            console.log('Body type:', typeof event.body);
            console.log('Body preview:', typeof event.body === 'string' ? event.body.substring(0, 500) : event.body);
            
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: "Missing required fields: job_title and job_description",
                    received: {
                        job_title: job_title || null,
                        job_description: job_description || null
                    },
                    debug: {
                        contentType: event.headers['content-type'],
                        bodyType: typeof event.body,
                        bodyPreview: typeof event.body === 'string' ? event.body.substring(0, 200) : 'Not a string',
                        queryParams: event.queryStringParameters
                    }
                })
            };
        }

        const result = await extractJobDetailsWithRetry(job_title, job_description);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result)
        };
        
    } catch (error) {
        console.error('Error:', error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: "Failed to extract job details",
                details: error.message
            })
        };
    }
};
