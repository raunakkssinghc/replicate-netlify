# Job Details Extractor API

A serverless API that extracts structured job details from job descriptions using AI. Built for Netlify Functions and designed for n8n integration.

## 🚀 Features

- **AI-Powered Extraction** - Uses DeepSeek AI to extract job details
- **Retry Logic** - Automatically retries up to 3 times for valid JSON
- **Field Validation** - Ensures all fields are in correct format
- **CORS Enabled** - Ready for cross-origin requests
- **Serverless** - Deployed on Netlify Functions

## 📋 Extracted Fields

- **job_title** - Cleaned job title (removes company names, etc.)
- **city** - City/state abbreviation (e.g., "San Francisco, CA")
- **work_arrangement** - One of: "remote", "hybrid", "on-site" (lowercase)
- **experience** - One of: "Entry (0-2 Years)", "Mid (3-5 Years)", "Senior (6-8 Years)", "Lead (8+ Years)"

## 🛠️ Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set environment variable:**
   ```bash
   export REPLICATE_API_TOKEN="your_token_here"
   ```

3. **Test locally with Netlify CLI:**
   ```bash
   npm install -g netlify-cli
   netlify dev
   ```

## 🌐 Deployment to Netlify

### Option 1: Git Integration (Recommended)
1. Push your code to GitHub/GitLab
2. Connect your repository to Netlify
3. Set build settings:
   - **Build command:** (leave empty)
   - **Publish directory:** (leave empty)
4. Add environment variable:
   - **REPLICATE_API_TOKEN** = your Replicate API token

### Option 2: Manual Deploy
1. Install Netlify CLI: `npm install -g netlify-cli`
2. Login: `netlify login`
3. Deploy: `netlify deploy --prod`

## 📡 API Usage

### Endpoint
```
POST /.netlify/functions/extract-job-details
```

### Request
```json
{
  "job_title": "Data Engineer",
  "job_description": "Your job description text here..."
}
```

### Response
```json
{
  "job_title": "Data Engineer",
  "city": "San Francisco, CA",
  "work_arrangement": "hybrid",
  "experience": "Mid (3-5 Years)"
}
```

## 🔗 n8n Integration

Use the **HTTP Request** node in n8n:

- **Method:** POST
- **URL:** `https://your-site.netlify.app/.netlify/functions/extract-job-details`
- **Headers:** `Content-Type: application/json`
- **Body:** JSON with `job_title` and `job_description`

## 🧪 Testing

Test the API with curl:
```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/extract-job-details \
  -H "Content-Type: application/json" \
  -d '{
    "job_title": "Data Engineer",
    "job_description": "We are looking for a Data Engineer with 3-5 years of experience..."
  }'
```

## 📁 Project Structure

```
├── netlify/
│   └── functions/
│       └── extract-job-details.js  # Main function
├── netlify.toml                    # Netlify configuration
├── index.html                      # Landing page
├── package.json                    # Dependencies
└── README.md                       # This file
```

## 🔧 Configuration

The function uses these environment variables:
- **REPLICATE_API_TOKEN** - Your Replicate API token (required)

## 🚨 Error Handling

The API returns appropriate HTTP status codes:
- **200** - Success
- **400** - Missing required fields
- **405** - Method not allowed
- **500** - Extraction failed

All errors include descriptive messages for debugging.
