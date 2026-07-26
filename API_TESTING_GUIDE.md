# Zeu Backend API Pre-Deployment Testing Documentation

This document provides a comprehensive guide for testing all API endpoints of the Zeu Chatbot Backend using structured JSON payload files before executing production or staging deployments.

---

## 📂 Test JSON Files Directory Structure

All API testing payload files, test manifests, and Postman collection files are located in the `test_payloads/` directory:

```text
zeu_backend/
├── test_payloads/
│   ├── endpoint_tests_manifest.json  # Master test manifest mapping all endpoints & tests
│   ├── health_check.json             # Request & expected response for GET /
│   ├── generate_standard.json        # Standard AI generate request JSON payload
│   ├── generate_critical.json        # Critical escalation dispute request JSON payload
│   ├── generate_invalid_empty.json   # Invalid payload (missing prompt) testing 400 error
│   ├── feedback_payload.json         # Feedback endpoint multipart test metadata
│   └── zeu_postman_collection.json   # Ready-to-import Postman v2.1 Collection
├── scripts/
│   └── test-api.js                   # Zero-dependency automated test runner script
├── API_TESTING_GUIDE.md              # Documentation file
└── test_requests.http                # VS Code REST Client test requests
```

---

## 🛠️ API Endpoints Specification

### 1. Health Check Endpoint
- **URL**: `/` or `/api`
- **Method**: `GET`
- **Description**: Verifies that the server process is online and responsive.
- **Payload File**: `test_payloads/health_check.json`
- **Expected Status**: `200 OK`
- **Expected Response**:
```json
{
  "status": "online",
  "message": "Zeu Chatbot API Backend is running!",
  "endpoints": ["POST /api/generate", "POST /api/feedback"]
}
```

---

### 2. AI Response Generation Endpoint (Standard Query)
- **URL**: `/api/generate`
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`
- **Description**: Handles normal user queries using `gemini-3.6-flash`.
- **Payload File**: `test_payloads/generate_standard.json`
- **Sample Request Body**:
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
- **Expected Status**: `200 OK`
- **Expected Response**:
```json
{
  "success": true,
  "reply": "Zeu is a local Kirana grocery delivery and pre-book/pickup platform...",
  "is_transfer": false,
  "model_used": "gemini-3.6-flash"
}
```

---

### 3. AI Escalation & Dispute Handling Endpoint (Critical Query)
- **URL**: `/api/generate`
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`
- **Description**: Triggers high-priority dispute resolution mode (`gemini-3.5-pro`) and returns human transfer handoff flags.
- **Payload File**: `test_payloads/generate_critical.json`
- **Sample Request Body**:
```json
{
  "prompt": "My order was NEVER received, connect me to a human agent",
  "classification": "CRITICAL",
  "history": []
}
```
- **Expected Status**: `200 OK`
- **Expected Response**:
```json
{
  "success": true,
  "reply": "I am transferring you to a human agent immediately.",
  "is_transfer": true,
  "model_used": "gemini-3.5-pro"
}
```

---

### 4. Payload Validation Error Test (Missing Prompt)
- **URL**: `/api/generate`
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`
- **Description**: Verifies proper error handling when mandatory fields are omitted.
- **Payload File**: `test_payloads/generate_invalid_empty.json`
- **Sample Request Body**:
```json
{
  "classification": "STANDARD"
}
```
- **Expected Status**: `400 Bad Request`
- **Expected Response**:
```json
{
  "error": "Prompt is required"
}
```

---

### 5. Customer Feedback Endpoint
- **URL**: `/api/feedback`
- **Method**: `POST`
- **Content-Type**: `multipart/form-data`
- **Description**: Accepts form fields and uploaded item images for customer feedback.
- **Payload File**: `test_payloads/feedback_payload.json`
- **Expected Status**: `200 OK`
- **Expected Response**:
```json
{
  "success": true,
  "message": "Feedback and images processed successfully",
  "receivedSections": ["overallRating", "additionalComments"],
  "receivedFiles": []
}
```

---

## 🚀 How to Run Pre-Deployment Tests

### Option A: Automated CLI Test Runner (Recommended)

Run the built-in automated test suite before deploying to production or staging:

1. **Start the local server** (in one terminal window):
   ```bash
   npm run dev
   ```

2. **Run pre-deployment tests** (in another terminal window):
   ```bash
   npm run test:api
   ```

3. **Test Remote Staging / Production Deployment URL**:
   ```bash
   npm run test:api -- --url=https://zeu-backend.vercel.app
   ```

---

### Option B: Using cURL with JSON Payload Files

You can test endpoints directly from the command line using the `@` syntax to pass the test JSON files:

- **Test Health Check**:
  ```bash
  curl -X GET http://localhost:3000/
  ```

- **Test Standard AI Generation**:
  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d @test_payloads/generate_standard.json \
    http://localhost:3000/api/generate
  ```

- **Test Critical Dispute Query**:
  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d @test_payloads/generate_critical.json \
    http://localhost:3000/api/generate
  ```

- **Test Validation Error (Missing Prompt)**:
  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d @test_payloads/generate_invalid_empty.json \
    http://localhost:3000/api/generate
  ```

---

### Option C: Postman / Insomnia / Newman

1. Open Postman or Insomnia.
2. Click **Import**.
3. Choose the file `test_payloads/zeu_postman_collection.json`.
4. Update the `baseUrl` variable to match your local or staging server (e.g., `http://localhost:3000` or `https://zeu-backend.vercel.app`).
5. Click **Run Collection** to run all pre-deployment assertion tests in sequence.

To run via CLI using Newman:
```bash
npx newman run test_payloads/zeu_postman_collection.json
```

---

### Option D: VS Code REST Client Extension

1. Open `test_requests.http` in VS Code.
2. Install the **REST Client** extension (`humao.rest-client`) if not already installed.
3. Click **Send Request** above any endpoint section to view live responses.

---

## 📋 Pre-Deployment Verification Checklist

Before pushing to production or staging (e.g. Vercel / AWS / Docker):

- [ ] **Environment Variable Verification**: Ensure `GEMINI_API_KEY` is configured in `.env` (locally) and in your cloud host environment settings.
- [ ] **Run Automated Test Suite**: Execute `npm run test:api` and confirm all tests pass.
- [ ] **Check Status Codes**:
  - `GET /` returns `200`
  - `POST /api/generate` returns `200` with valid JSON payload
  - `POST /api/generate` returns `400` with missing prompt payload
  - `POST /api/feedback` returns `200` with multipart payload
- [ ] **Escalation Handoff Verification**: Verify `is_transfer: true` and reply text contains transfer text when classification is `CRITICAL` or prompt requests a human agent.
- [ ] **CORS Headers**: Verify `Access-Control-Allow-Origin: *` headers are attached on preflight OPTIONS and POST responses.
