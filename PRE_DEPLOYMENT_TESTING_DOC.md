# 📄 Zeu AI Backend API - Pre-Deployment Testing & Specification Document

**Product**: Zeu AI Chatbot Backend Service  
**Purpose**: Official Pre-Deployment API Verification & JSON Testing Specification Document for Clients & Technical Teams.

---

## 🎯 Executive Summary

This document provides complete technical documentation and testing procedures for verifying the **Zeu AI Chatbot Backend Service** before deploying to production environments (Vercel, AWS, Docker, or Node.js servers).

The backend includes a pre-packaged JSON test suite, automated CLI testing utilities, and Postman collections that allow client technical teams to validate all API endpoints, system health, Gemini AI integration, escalation handoff logic, and customer feedback handlers.

---

## 📁 Pre-Packaged JSON Test Suite Deliverables

All test files are stored in the `./test_payloads/` directory within the project root:

| File Name | HTTP Method | Endpoint Target | Purpose / Test Scenario |
| :--- | :--- | :--- | :--- |
| **`endpoint_tests_manifest.json`** | Multi | Master Manifest | Central configuration listing all test cases, target paths, and expected status codes. |
| **`health_check.json`** | `GET` | `/` | Validates server availability and active route list. |
| **`generate_standard.json`** | `POST` | `/api/generate` | Tests standard AI query resolution (`gemini-3.6-flash`). |
| **`generate_critical.json`** | `POST` | `/api/generate` | Tests high-priority order dispute escalation & human transfer logic. |
| **`generate_invalid_empty.json`** | `POST` | `/api/generate` | Tests payload validation & `400 Bad Request` handling when prompt is missing. |
| **`feedback_payload.json`** | `POST` | `/api/feedback` | Tests customer feedback submission & multipart data parsing. |
| **`zeu_postman_collection.json`** | Multi | All Endpoints | Ready-to-import Postman v2.1 collection with pre-written test scripts. |

---

## 🔌 API Endpoint Specifications & JSON Schemas

### 1. Health Check Endpoint

- **Endpoint Path**: `GET /`
- **Headers**: None required
- **Description**: Verifies that the server is online and operational.

#### Expected Response JSON (Status: 200 OK)
```json
{
  "status": "online",
  "message": "Zeu Chatbot API Backend is running!",
  "endpoints": [
    "POST /api/generate",
    "POST /api/feedback"
  ]
}
```

---

### 2. Standard AI Response Generation Endpoint

- **Endpoint Path**: `POST /api/generate`
- **Headers**: `Content-Type: application/json`
- **Description**: Handles standard customer inquiries (e.g., store hours, pickup rules, general questions).

#### Request JSON Payload (`test_payloads/generate_standard.json`)
```json
{
  "prompt": "Hi, what is Zeu and how does pickup work?",
  "classification": "STANDARD",
  "history": [
    {
      "role": "user",
      "content": "Hello"
    },
    {
      "role": "model",
      "content": "Hello! I am Zeu's AI Assistant. How can I help you today?"
    }
  ]
}
```

#### Expected Response JSON (Status: 200 OK)
```json
{
  "success": true,
  "reply": "Zeu is a local Kirana grocery ordering platform. For pickup orders, you have a 7-minute pickup window after placing your order...",
  "is_transfer": false,
  "model_used": "gemini-3.6-flash"
}
```

---

### 3. Critical Dispute & Escalation Endpoint

- **Endpoint Path**: `POST /api/generate`
- **Headers**: `Content-Type: application/json`
- **Description**: Triggers high-priority dispute reasoning. If the customer requests a human agent or reports a missing order, the system sets `is_transfer: true` for human handoff.

#### Request JSON Payload (`test_payloads/generate_critical.json`)
```json
{
  "prompt": "My order was NEVER received, connect me to a human agent",
  "classification": "CRITICAL",
  "history": []
}
```

#### Expected Response JSON (Status: 200 OK)
```json
{
  "success": true,
  "reply": "I am transferring you to a human agent immediately.",
  "is_transfer": true,
  "model_used": "gemini-3.6-flash"
}
```

---

### 4. Input Validation Error (Missing Prompt)

- **Endpoint Path**: `POST /api/generate`
- **Headers**: `Content-Type: application/json`
- **Description**: Validates that bad/incomplete client payloads return proper HTTP status codes.

#### Request JSON Payload (`test_payloads/generate_invalid_empty.json`)
```json
{
  "classification": "STANDARD"
}
```

#### Expected Response JSON (Status: 400 Bad Request)
```json
{
  "error": "Prompt is required"
}
```

---

### 5. Customer Feedback Submission Endpoint

- **Endpoint Path**: `POST /api/feedback`
- **Content Type**: `multipart/form-data`
- **Description**: Accepts form fields (ratings, comments) and file uploads (order item images).

#### Request Field Metadata (`test_payloads/feedback_payload.json`)
```json
{
  "overallRating": "5",
  "deliveryExperience": "Fast delivery",
  "additionalComments": "Pre-deployment testing verification"
}
```

#### Expected Response JSON (Status: 200 OK)
```json
{
  "success": true,
  "message": "Feedback and images processed successfully",
  "receivedSections": ["overallRating", "deliveryExperience", "additionalComments"],
  "receivedFiles": []
}
```

---

## 🛠️ Step-by-Step Instructions for Pre-Deployment Testing

### Method 1: Automated NPM CLI Test Suite (Recommended for CI/CD)

The backend features an automated test runner script that reads the JSON test files and executes all endpoint assertions automatically.

1. **Start the local server**:
   ```bash
   npm run dev
   ```
2. **Execute pre-deployment tests**:
   ```bash
   npm run test:api
   ```
3. **Test Remote Staging / Production Server**:
   ```bash
   npm run test:api -- --url=https://your-staging-backend.vercel.app
   ```

#### Sample Test CLI Output:
```text
==================================================
🚀 Running Zeu Backend Pre-Deployment API Tests
📍 Target Server: http://localhost:3000
==================================================

✅ [PASS] Health Check (GET /)
   Endpoint: GET / | Status: 200
   Response Status: "online"

✅ [PASS] AI Generate Standard Query (POST /api/generate)
   Endpoint: POST /api/generate | Status: 200

✅ [PASS] AI Generate Escalation Query (POST /api/generate)
   Endpoint: POST /api/generate | Status: 200

✅ [PASS] AI Generate Missing Prompt Validation (POST /api/generate)
   Endpoint: POST /api/generate | Status: 400

✅ [PASS] Feedback Form Submission (POST /api/feedback)
   Endpoint: POST /api/feedback | Status: 200

==================================================
📊 Test Summary: 5 Passed, 0 Failed
==================================================
```

---

### Method 2: Testing with cURL & Local JSON Files

Clients can execute cURL commands directly against their server by referencing the JSON files using `@`:

#### Health Check:
```bash
curl -X GET http://localhost:3000/
```

#### Standard AI Generation:
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d @test_payloads/generate_standard.json \
  http://localhost:3000/api/generate
```

#### Critical Escalation:
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d @test_payloads/generate_critical.json \
  http://localhost:3000/api/generate
```

#### Missing Prompt Validation:
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d @test_payloads/generate_invalid_empty.json \
  http://localhost:3000/api/generate
```

---

### Method 3: Postman / Insomnia Collection Import

1. Open **Postman** or **Insomnia**.
2. Click **Import** -> Select file -> `test_payloads/zeu_postman_collection.json`.
3. Set the variable `baseUrl` to your target environment URL (`http://localhost:3000` or `https://your-domain.com`).
4. Run the collection to verify all 5 endpoint test cases with built-in status and payload assertions.

---

## 📋 Client Pre-Deployment Checklist

Before approving the backend for production deployment, verify the following checklist:

- [x] **Environment Variables**: `GEMINI_API_KEY` is configured in `.env` (for local Node.js) and in Vercel / Cloud Provider settings.
- [x] **Health Check Endpoint**: `GET /` returns status `200` with `"status": "online"`.
- [x] **AI Generation Response**: `POST /api/generate` returns `200` with `success: true` and non-empty `reply`.
- [x] **Escalation Handoff Flag**: `POST /api/generate` with critical dispute prompt returns `is_transfer: true`.
- [x] **Validation Logic**: `POST /api/generate` with missing `prompt` returns `400 Bad Request`.
- [x] **Multipart Feedback Handling**: `POST /api/feedback` processes form fields and file attachments.
- [x] **CORS Headers**: Response headers include `Access-Control-Allow-Origin: *` to enable cross-origin requests from frontend apps.

---

## ❓ Support & Troubleshooting

| Issue / Error | Likely Cause | Solution |
| :--- | :--- | :--- |
| `500 Internal Server Error` on `/api/generate` | Missing or invalid `GEMINI_API_KEY` | Set `GEMINI_API_KEY` in environment configuration. |
| `404 Endpoint Not Found` | Incorrect URL path | Ensure routes are prefixed with `/api/generate` or `/api/feedback`. |
| `405 Method Not Allowed` | Sending `GET` request to `POST` endpoint | Send `POST` requests for `/api/generate` and `/api/feedback`. |
| `listen EPERM` on port 3000 | Port conflict or permission issue | Run with `PORT=3001 node server.js` or set `PORT` in `.env`. |
