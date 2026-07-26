# Zeu Backend API — Complete Technical Documentation v2.0

> **Version:** 2.0.0 | **Last Updated:** 2026-07-26
> **Deployment:** Vercel Serverless Functions (Node.js)
> **AI Engine:** Google Gemini (`@google/genai` SDK, `gemini-3.6-flash` / `gemini-3.5-pro`)
> **Maintainer:** Sahil (Backend & AI Architect)

---

## Table of Contents

1. [Environment & Configuration](#1-environment--configuration)
2. [Authentication & Security](#2-authentication--security)
3. [Global Headers & Rate Limiting](#3-global-headers--rate-limiting)
4. [Existing Endpoints (Deployed)](#4-existing-endpoints-deployed)
5. [AI Chatbot Core Module (New v1 Endpoints)](#5-ai-chatbot-core-module)
6. [Human Agent Transfer & Escalation Protocol](#6-human-agent-transfer--escalation-protocol)
7. [Customer Feedback Module](#7-customer-feedback-module)
8. [Comprehensive Error Reference](#8-comprehensive-error-reference)
9. [Frontend Architecture & UI Blueprint](#9-frontend-architecture--ui-blueprint)
10. [AI-Optimized System Context (Cursor / Copilot)](#10-ai-optimized-system-context)

---

## 1. Environment & Configuration

### Base URLs

| Environment | URL |
|---|---|
| Local Development | `http://localhost:3000` |
| Vercel Preview | `https://zeu-backend-dgex-git-preview.vercel.app` |
| **Production** | **`https://zeu-backend-dgex.vercel.app`** |

### Server-Side Environment Variables (`.env` / Vercel Dashboard)

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Google Gemini API key for AI generation. |
| `NODE_ENV` | No | `development` or `production`. Defaults to `production` on Vercel. |

### Vercel CLI Setup

```bash
# Install Vercel CLI
npm i -g vercel

# Link project and deploy
cd Zeu && vercel

# Add API key securely (select all environments)
vercel env add GEMINI_API_KEY

# Deploy to production
vercel --prod
```

---

## 2. Authentication & Security

All protected endpoints require an `Authorization` header with a Bearer token.

| Header | Value | Required |
|---|---|---|
| `Authorization` | `Bearer <JWT_TOKEN>` | Yes (for agent/admin endpoints) |
| `Content-Type` | `application/json` | Yes (for JSON endpoints) |

**Token Lifecycle:**
- Tokens are issued by the startup's own auth system (e.g., NextAuth, Clerk, Firebase Auth).
- The Zeu backend validates tokens via middleware before processing requests.
- Token expiry: Configurable (recommended 24h for customers, 8h for agents).

**Public Endpoints (No Auth Required):**
- `GET /` (Health check)
- `POST /api/generate` (Legacy AI endpoint — uses API-key-level auth via Vercel env)

**Protected Endpoints (Auth Required):**
- All `/api/v1/*` endpoints

---

## 3. Global Headers & Rate Limiting

Every API response includes the following headers:

| Header | Value | Description |
|---|---|---|
| `Access-Control-Allow-Origin` | `*` | CORS enabled for all origins. |
| `Access-Control-Allow-Methods` | `GET, POST, PUT, PATCH, DELETE, OPTIONS` | Allowed HTTP methods. |
| `X-RateLimit-Limit` | `100` | Max requests per minute per IP. |
| `X-RateLimit-Remaining` | `97` | Remaining requests in the current window. |
| `X-RateLimit-Reset` | `1753523400` | Unix timestamp when the rate limit resets. |

**Rate Limit Exceeded Response (`429`):**
```json
{
  "success": false,
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please retry after 60 seconds.",
  "retryAfterSeconds": 60
}
```

---

## 4. Existing Endpoints (Deployed)

These endpoints are live on production today.

### 4.1. Health Check

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/` |
| **Auth** | None |

**Response `200 OK`:**
```json
{
  "status": "online",
  "message": "Zeu Chatbot API Backend is running!",
  "endpoints": ["POST /api/generate", "POST /api/feedback"]
}
```

---

### 4.2. AI Response Generation (Legacy)

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/generate` |
| **Auth** | API-key level (server-side `GEMINI_API_KEY`) |

**Request Headers:**

| Header | Value | Required |
|---|---|---|
| `Content-Type` | `application/json` | Yes |

**Request Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `prompt` | `string` | Yes | The customer's message text. |
| `classification` | `string` | No | `"STANDARD"` (default) or `"CRITICAL"`. Controls model routing. |
| `history` | `array` | No | Previous messages: `[{role: "user"/"model", content: "..."}]`. Max 10 retained. |

**Request Example:**
```json
{
  "prompt": "My order is 20 minutes late, where is it?",
  "classification": "STANDARD",
  "history": [
    { "role": "user", "content": "Hello" },
    { "role": "model", "content": "Hello! How can Zeu help you today?" }
  ]
}
```

**Response `200 OK`:**
```json
{
  "success": true,
  "reply": "I understand the wait can be frustrating! Let me check on your order status...",
  "is_transfer": false,
  "model_used": "gemini-3.6-flash"
}
```

**Response `200 OK` (Human Escalation Triggered):**
```json
{
  "success": true,
  "reply": "This issue cannot be handled by the chatbot. I am transferring you to a human agent immediately.",
  "is_transfer": true,
  "model_used": "deterministic-guardrail"
}
```

> **Frontend Action:** When `is_transfer === true`, immediately trigger the Human Handoff UI flow (see Section 9).

**cURL Example:**
```bash
curl -X POST https://zeu-backend-dgex.vercel.app/api/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Mujhe insaan se baat karni hai", "classification": "STANDARD"}'
```

**Fetch Example:**
```javascript
const res = await fetch('https://zeu-backend-dgex.vercel.app/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: "My order was never received",
    classification: "CRITICAL"
  })
});
const data = await res.json();
if (data.is_transfer) {
  // Trigger human handoff UI
}
```

---

## 5. AI Chatbot Core Module

These are the v1 session-based endpoints for structured chat lifecycle management.

### 5.1. Start Chat Session

Creates a new chat session with metadata context.

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/v1/chat/session/start` |
| **Auth** | `Bearer <token>` |

**Request Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `userId` | `string` | Yes | Unique customer ID from auth system. |
| `platform` | `string` | No | `"web"`, `"mobile"`, `"whatsapp"`. Defaults to `"web"`. |
| `orderContext` | `object` | No | Active order details to pre-load into AI context. |
| `orderContext.orderId` | `string` | No | Active order ID. |
| `orderContext.status` | `string` | No | e.g., `"OUT_FOR_DELIVERY"`, `"PREPARING"`. |
| `language` | `string` | No | `"en"`, `"hi"`, `"mr"`. Defaults to `"en"`. |

**Request Example:**
```json
{
  "userId": "usr_k7x9m2",
  "platform": "mobile",
  "orderContext": {
    "orderId": "ORD-20260726-4821",
    "status": "OUT_FOR_DELIVERY"
  },
  "language": "hi"
}
```

**Response `201 Created`:**
```json
{
  "success": true,
  "sessionId": "ses_a1b2c3d4e5",
  "status": "AI_ACTIVE",
  "createdAt": "2026-07-26T14:15:00.000Z",
  "welcomeMessage": "Namaste! Main Zeu AI Assistant hoon. Aapki kya madad kar sakta hoon? 🙏",
  "contextLoaded": {
    "orderId": "ORD-20260726-4821",
    "orderStatus": "OUT_FOR_DELIVERY"
  }
}
```

**cURL:**
```bash
curl -X POST https://zeu-backend-dgex.vercel.app/api/v1/chat/session/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -d '{"userId": "usr_k7x9m2", "platform": "mobile", "language": "hi"}'
```

---

### 5.2. Send Chat Message

Sends a customer message through the AI engine and returns the response. Supports optional Server-Sent Events (SSE) streaming.

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/v1/chat/message` |
| **Auth** | `Bearer <token>` |

**Request Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `sessionId` | `string` | Yes | Active session ID from `/session/start`. |
| `message` | `string` | Yes | Customer's message text. |
| `classification` | `string` | No | `"STANDARD"` or `"CRITICAL"`. Auto-detected if omitted. |
| `stream` | `boolean` | No | If `true`, response is streamed via SSE. Defaults to `false`. |

**Request Example (Standard):**
```json
{
  "sessionId": "ses_a1b2c3d4e5",
  "message": "Mera order kab aayega?",
  "stream": false
}
```

**Response `200 OK`:**
```json
{
  "success": true,
  "sessionId": "ses_a1b2c3d4e5",
  "reply": "Aapka order abhi delivery ke liye nikla hai! Approximately 10-15 minutes mein pahunch jayega. 🚲",
  "is_transfer": false,
  "model_used": "gemini-3.6-flash",
  "classification_detected": "STANDARD",
  "timestamp": "2026-07-26T14:16:30.000Z"
}
```

**Response `200 OK` (Escalation Triggered):**
```json
{
  "success": true,
  "sessionId": "ses_a1b2c3d4e5",
  "reply": "This issue cannot be handled by the chatbot. I am transferring you to a human agent immediately.",
  "is_transfer": true,
  "model_used": "deterministic-guardrail",
  "classification_detected": "CRITICAL",
  "transferReason": "explicit_human_request",
  "timestamp": "2026-07-26T14:16:45.000Z"
}
```

**Streaming (SSE) Response:**
When `stream: true`, the server responds with `Content-Type: text/event-stream`:
```
data: {"type": "chunk", "text": "Aapka order "}
data: {"type": "chunk", "text": "abhi delivery ke liye "}
data: {"type": "chunk", "text": "nikla hai! 🚲"}
data: {"type": "done", "is_transfer": false, "model_used": "gemini-3.6-flash"}
```

**Fetch Example (Standard):**
```javascript
const res = await fetch('/api/v1/chat/message', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    sessionId: 'ses_a1b2c3d4e5',
    message: 'My milk packet is torn and leaking'
  })
});
const data = await res.json();

if (data.is_transfer) {
  await transferToHuman(data.sessionId, data.transferReason);
}
```

**Fetch Example (SSE Streaming):**
```javascript
const res = await fetch('/api/v1/chat/message', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    sessionId: 'ses_a1b2c3d4e5',
    message: 'What items can I order?',
    stream: true
  })
});

const reader = res.body.getReader();
const decoder = new TextDecoder();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value);
  // Parse SSE lines and append to UI
}
```

---

### 5.3. Fetch Chat History

Retrieves the complete conversation log for a given session.

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/api/v1/chat/history/:sessionId` |
| **Auth** | `Bearer <token>` |

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `sessionId` | `string` | Yes | The chat session ID. |

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `limit` | `integer` | No | Max messages to return. Default `50`. |
| `offset` | `integer` | No | Pagination offset. Default `0`. |

**Response `200 OK`:**
```json
{
  "success": true,
  "sessionId": "ses_a1b2c3d4e5",
  "status": "AI_ACTIVE",
  "messageCount": 4,
  "messages": [
    {
      "id": "msg_001",
      "role": "model",
      "content": "Namaste! Main Zeu AI Assistant hoon. Aapki kya madad kar sakta hoon? 🙏",
      "timestamp": "2026-07-26T14:15:00.000Z",
      "source": "ai"
    },
    {
      "id": "msg_002",
      "role": "user",
      "content": "Mera order kab aayega?",
      "timestamp": "2026-07-26T14:15:12.000Z",
      "source": "customer"
    },
    {
      "id": "msg_003",
      "role": "model",
      "content": "Aapka order abhi delivery ke liye nikla hai! 🚲",
      "timestamp": "2026-07-26T14:15:14.000Z",
      "source": "ai"
    },
    {
      "id": "msg_004",
      "role": "user",
      "content": "Thank you!",
      "timestamp": "2026-07-26T14:15:30.000Z",
      "source": "customer"
    }
  ]
}
```

**cURL:**
```bash
curl -X GET "https://zeu-backend-dgex.vercel.app/api/v1/chat/history/ses_a1b2c3d4e5?limit=20" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

---

## 6. Human Agent Transfer & Escalation Protocol

These endpoints power the full lifecycle of a human agent takeover when the AI cannot resolve the issue.

### 6.1. Transfer to Human Agent

Triggers a human handoff. Sets session status to `PENDING_HUMAN` and pushes the ticket into the agent queue.

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/v1/chat/transfer-to-human` |
| **Auth** | `Bearer <token>` |

**Request Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `sessionId` | `string` | Yes | The active chat session ID. |
| `reason` | `string` | Yes | Enum: `"explicit_human_request"`, `"non_delivery"`, `"dispute"`, `"ai_low_confidence"`, `"safety_concern"`, `"fraud_report"`. |
| `priorityLevel` | `string` | No | `"LOW"`, `"MEDIUM"`, `"HIGH"`, `"CRITICAL"`. Auto-assigned if omitted. |
| `customerSummary` | `string` | No | Brief AI-generated summary of the issue for the agent. |

**Request Example:**
```json
{
  "sessionId": "ses_a1b2c3d4e5",
  "reason": "non_delivery",
  "priorityLevel": "HIGH",
  "customerSummary": "Customer reports order ORD-20260726-4821 was never delivered. Paid via UPI. Requesting full refund."
}
```

**Response `200 OK`:**
```json
{
  "success": true,
  "sessionId": "ses_a1b2c3d4e5",
  "status": "PENDING_HUMAN",
  "ticketId": "TKT-20260726-0091",
  "queuePosition": 3,
  "estimatedWaitMinutes": 5,
  "message": "You have been added to the support queue. An agent will be with you shortly."
}
```

**cURL:**
```bash
curl -X POST https://zeu-backend-dgex.vercel.app/api/v1/chat/transfer-to-human \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -d '{"sessionId": "ses_a1b2c3d4e5", "reason": "non_delivery", "priorityLevel": "HIGH"}'
```

---

### 6.2. Get Agent Queue

Fetches the live support queue for human operators. Sorted by priority (CRITICAL first) then by wait time.

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/api/v1/agent/queue` |
| **Auth** | `Bearer <agent_token>` (Agent/Admin role required) |

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `status` | `string` | No | Filter: `"PENDING_HUMAN"`, `"HUMAN_CONNECTED"`. Defaults to `"PENDING_HUMAN"`. |
| `limit` | `integer` | No | Max tickets to return. Default `20`. |

**Response `200 OK`:**
```json
{
  "success": true,
  "queueLength": 3,
  "tickets": [
    {
      "ticketId": "TKT-20260726-0089",
      "sessionId": "ses_x9y8z7",
      "userId": "usr_m4n5o6",
      "reason": "safety_concern",
      "priorityLevel": "CRITICAL",
      "customerSummary": "Customer reports allergic reaction after consuming product from Zeu store.",
      "waitingSinceMinutes": 2,
      "createdAt": "2026-07-26T14:10:00.000Z"
    },
    {
      "ticketId": "TKT-20260726-0090",
      "sessionId": "ses_p1q2r3",
      "userId": "usr_s4t5u6",
      "reason": "non_delivery",
      "priorityLevel": "HIGH",
      "customerSummary": "Order ORD-20260726-3312 marked delivered but customer never received it.",
      "waitingSinceMinutes": 5,
      "createdAt": "2026-07-26T14:07:00.000Z"
    },
    {
      "ticketId": "TKT-20260726-0091",
      "sessionId": "ses_a1b2c3d4e5",
      "userId": "usr_k7x9m2",
      "reason": "non_delivery",
      "priorityLevel": "HIGH",
      "customerSummary": "Customer reports order ORD-20260726-4821 was never delivered.",
      "waitingSinceMinutes": 1,
      "createdAt": "2026-07-26T14:14:00.000Z"
    }
  ]
}
```

---

### 6.3. Claim Ticket (Agent Assignment)

A logged-in human agent claims a pending customer session from the queue.

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/v1/agent/claim-ticket` |
| **Auth** | `Bearer <agent_token>` |

**Request Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `ticketId` | `string` | Yes | The ticket ID from the queue. |
| `agentId` | `string` | Yes | The authenticated agent's user ID. |

**Request Example:**
```json
{
  "ticketId": "TKT-20260726-0091",
  "agentId": "agent_ravi_01"
}
```

**Response `200 OK`:**
```json
{
  "success": true,
  "ticketId": "TKT-20260726-0091",
  "sessionId": "ses_a1b2c3d4e5",
  "status": "HUMAN_CONNECTED",
  "agentId": "agent_ravi_01",
  "customerContext": {
    "userId": "usr_k7x9m2",
    "language": "hi",
    "orderId": "ORD-20260726-4821",
    "issueType": "non_delivery",
    "conversationSummary": "Customer reports order was never delivered. Paid via UPI. Requesting full refund.",
    "messageCount": 6
  },
  "message": "Session assigned. You are now connected to the customer."
}
```

**Error `409 Conflict` (Already claimed):**
```json
{
  "success": false,
  "error": "Ticket already claimed",
  "claimedBy": "agent_priya_02"
}
```

---

### 6.4. Agent Send Message

Sends a direct message from a human agent to the customer, bypassing all AI logic.

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/v1/agent/message` |
| **Auth** | `Bearer <agent_token>` |

**Request Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `sessionId` | `string` | Yes | The active session ID. |
| `agentId` | `string` | Yes | Authenticated agent's ID. |
| `message` | `string` | Yes | The agent's reply text. |
| `actionType` | `string` | No | `"text"`, `"refund_initiated"`, `"replacement_ordered"`, `"escalated_to_admin"`. |
| `refundAmount` | `number` | No | Amount in INR if `actionType` is `"refund_initiated"`. |

**Request Example:**
```json
{
  "sessionId": "ses_a1b2c3d4e5",
  "agentId": "agent_ravi_01",
  "message": "Namaste! Main Ravi hoon, aapka support agent. Aapke order ki jaanch ho rahi hai aur main aapko 5 minute mein update dunga.",
  "actionType": "text"
}
```

**Response `200 OK`:**
```json
{
  "success": true,
  "sessionId": "ses_a1b2c3d4e5",
  "messageId": "msg_agent_014",
  "deliveredAt": "2026-07-26T14:20:00.000Z"
}
```

**Request Example (Refund Action):**
```json
{
  "sessionId": "ses_a1b2c3d4e5",
  "agentId": "agent_ravi_01",
  "message": "Aapka refund process ho gaya hai. ₹245 aapke wallet mein 24 ghante mein aa jayega. 🙏",
  "actionType": "refund_initiated",
  "refundAmount": 245
}
```

---

### 6.5. Resolve / Close Session

Closes the ticket and marks the session as resolved. Optionally transfers back to AI.

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/v1/chat/resolve` |
| **Auth** | `Bearer <agent_token>` |

**Request Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `sessionId` | `string` | Yes | The session to resolve. |
| `agentId` | `string` | Yes | Agent who is resolving. |
| `resolution` | `string` | Yes | `"resolved"`, `"refund_approved"`, `"replacement_sent"`, `"escalated_to_admin"`, `"returned_to_ai"`. |
| `agentNotes` | `string` | No | Internal notes for record-keeping. |

**Request Example:**
```json
{
  "sessionId": "ses_a1b2c3d4e5",
  "agentId": "agent_ravi_01",
  "resolution": "refund_approved",
  "agentNotes": "Verified non-delivery via logistics dashboard. Full refund of ₹245 approved and processed."
}
```

**Response `200 OK`:**
```json
{
  "success": true,
  "sessionId": "ses_a1b2c3d4e5",
  "ticketId": "TKT-20260726-0091",
  "status": "CLOSED",
  "resolution": "refund_approved",
  "resolvedAt": "2026-07-26T14:25:00.000Z",
  "resolvedBy": "agent_ravi_01"
}
```

---

### 6.6. Get Session Status (Polling / Real-Time)

Returns the real-time status of a chat session. The frontend should poll this endpoint (every 3-5 seconds) or subscribe via SSE to update the UI state machine.

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/api/v1/chat/status/:sessionId` |
| **Auth** | `Bearer <token>` |

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `sessionId` | `string` | Yes | The chat session ID. |

**Response `200 OK`:**
```json
{
  "success": true,
  "sessionId": "ses_a1b2c3d4e5",
  "status": "HUMAN_CONNECTED",
  "agentInfo": {
    "agentId": "agent_ravi_01",
    "agentName": "Ravi S.",
    "connectedSince": "2026-07-26T14:18:00.000Z"
  },
  "queuePosition": null,
  "estimatedWaitMinutes": null
}
```

**Status Enum Values:**

| Status | Description |
|---|---|
| `AI_ACTIVE` | Customer is chatting with the AI bot. |
| `PENDING_HUMAN` | Transfer requested. Waiting in queue. |
| `HUMAN_CONNECTED` | A human agent is actively chatting. |
| `CLOSED` | Session resolved and closed. |

**Fetch Example (Polling):**
```javascript
const pollStatus = async (sessionId) => {
  const res = await fetch(`/api/v1/chat/status/${sessionId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();

  switch (data.status) {
    case 'AI_ACTIVE':
      showBotUI();
      break;
    case 'PENDING_HUMAN':
      showWaitingScreen(data.queuePosition, data.estimatedWaitMinutes);
      break;
    case 'HUMAN_CONNECTED':
      showAgentChatUI(data.agentInfo);
      break;
    case 'CLOSED':
      showResolutionSummary();
      break;
  }
};

// Poll every 4 seconds
setInterval(() => pollStatus('ses_a1b2c3d4e5'), 4000);
```

---

## 7. Customer Feedback Module

### 7.1. Submit Feedback (Existing — Deployed)

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/feedback` |
| **Auth** | API-key level |
| **Content-Type** | `multipart/form-data` (auto-set by browser) |

**FormData Fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `chatbot_rating` | `integer` | No | 1-5 star rating. |
| `chatbot_text` | `string` | No | Text feedback for chatbot. |
| `chatbot_image` | `File` | No | Image attachment (e.g., screenshot). |
| `app_rating` | `integer` | No | 1-5 star rating for overall app. |
| `app_text` | `string` | No | Text feedback for app. |
| `app_image` | `File` | No | Image attachment. |
| `store_rating` | `integer` | No | 1-5 star rating for Kirana store. |
| `store_text` | `string` | No | Text feedback for store. |
| `store_image` | `File` | No | Image attachment. |

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Feedback and images processed successfully",
  "receivedSections": ["chatbot_rating", "chatbot_text", "app_rating"],
  "receivedFiles": ["chatbot_image"]
}
```

**Fetch Example:**
```javascript
const formData = new FormData();
formData.append('chatbot_rating', 4);
formData.append('chatbot_text', 'Bot resolved my issue quickly!');
formData.append('chatbot_image', fileInput.files[0]);

const res = await fetch('https://zeu-backend-dgex.vercel.app/api/feedback', {
  method: 'POST',
  body: formData  // Do NOT set Content-Type manually
});
```

---

## 8. Comprehensive Error Reference

| Status | Error | Description | Sample Response |
|---|---|---|---|
| `400` | Bad Request | Missing or malformed parameters. | `{"success": false, "error": "Prompt is required"}` |
| `401` | Unauthorized | Missing/invalid auth token. | `{"success": false, "error": "Unauthorized: Token missing or expired"}` |
| `403` | Forbidden | Valid token but insufficient role. | `{"success": false, "error": "Forbidden: Agent role required"}` |
| `404` | Not Found | Session/ticket ID does not exist. | `{"success": false, "error": "Session ses_xyz not found"}` |
| `405` | Method Not Allowed | Wrong HTTP verb for endpoint. | `{"error": "Method Not Allowed"}` |
| `409` | Conflict | Resource already claimed/locked. | `{"success": false, "error": "Ticket already claimed", "claimedBy": "agent_02"}` |
| `429` | Rate Limited | Too many requests per minute. | `{"success": false, "error": "Too Many Requests", "retryAfterSeconds": 60}` |
| `500` | Internal Error | Server crash or Gemini API failure. | `{"success": false, "error": "Failed to process AI request", "details": "..."}` |

---

## 9. Frontend Architecture & UI Blueprint

### 9.1. Recommended Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Framework** | Next.js 15+ (App Router) | Server components, API routes, SSR/ISR. |
| **Styling** | Tailwind CSS v4 + Shadcn UI | Rapid, consistent, accessible UI components. |
| **State Management** | Zustand | Lightweight global store for chat state. |
| **Data Fetching** | TanStack React Query v5 | Caching, polling, mutations for API calls. |
| **Real-Time** | Server-Sent Events (SSE) | Streaming AI responses and status updates. |
| **Auth** | NextAuth.js v5 / Clerk | JWT-based auth for customers and agents. |

### 9.2. Environment Configuration (`.env.local`)

```env
NEXT_PUBLIC_API_URL=https://zeu-backend-dgex.vercel.app
NEXT_PUBLIC_WS_URL=wss://zeu-backend-dgex.vercel.app
NEXT_PUBLIC_APP_NAME=Zeu
NEXTAUTH_SECRET=your_nextauth_secret_here
NEXTAUTH_URL=http://localhost:3000
```

### 9.3. Core Component Tree

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # Landing/Home
│   ├── chat/
│   │   └── page.tsx                # Customer chat view
│   └── agent/
│       ├── dashboard/
│       │   └── page.tsx            # Agent dashboard
│       └── chat/[sessionId]/
│           └── page.tsx            # Agent active chat
├── components/
│   ├── chat/
│   │   ├── ChatWidget.tsx          # Floating chat toggle button
│   │   ├── ChatWindow.tsx          # Full chat container
│   │   ├── MessageBubble.tsx       # Individual message (user/bot/agent)
│   │   ├── MessageList.tsx         # Scrollable message history
│   │   ├── ChatInput.tsx           # Text input + send button
│   │   ├── TypingIndicator.tsx     # Animated "Bot is typing..."
│   │   ├── StatusBadge.tsx         # Shows AI_ACTIVE / PENDING_HUMAN / etc.
│   │   ├── TransferBanner.tsx      # "Connecting to agent..." overlay
│   │   └── FeedbackModal.tsx       # Post-resolution rating modal
│   ├── agent/
│   │   ├── QueuePanel.tsx          # List of pending tickets
│   │   ├── TicketCard.tsx          # Individual ticket preview
│   │   ├── ActiveChatThread.tsx    # Agent's live chat view
│   │   ├── CustomerSidebar.tsx     # Order context & history
│   │   ├── QuickReplies.tsx        # Macro/template buttons
│   │   └── ResolveDialog.tsx       # Close/resolve ticket modal
│   └── ui/                         # Shadcn UI primitives
├── hooks/
│   ├── useChat.ts                  # Chat session lifecycle hook
│   ├── useChatStatus.ts           # Polling hook for session status
│   ├── useAgentQueue.ts           # Agent queue data hook
│   └── useSSE.ts                  # Server-Sent Events hook
├── stores/
│   └── chatStore.ts               # Zustand store for chat state
├── lib/
│   ├── api.ts                     # API client (fetch wrapper)
│   └── constants.ts               # Status enums, config values
└── types/
    └── chat.ts                    # TypeScript interfaces
```

### 9.4. Chat State Machine (UI Transitions)

```
┌─────────────┐
│  IDLE        │  (No session active)
└──────┬──────┘
       │ User opens chat widget
       ▼
┌─────────────┐
│  AI_ACTIVE   │  (Bot handles conversation)
│  ┌─────────┐ │
│  │BOT_TYPING│◄──── User sends message
│  └────┬────┘ │
│       ▼      │
│  ┌─────────┐ │
│  │USER_INPUT│──── Bot responds
│  └─────────┘ │
└──────┬──────┘
       │ is_transfer === true OR user clicks "Talk to Human"
       ▼
┌──────────────────┐
│ HANDOFF_REQUESTED │  (POST /api/v1/chat/transfer-to-human)
└──────┬───────────┘
       │ Server confirms, ticket created
       ▼
┌──────────────────┐
│ WAITING_FOR_AGENT │  (Polling GET /api/v1/chat/status/:id)
│ "You are #3 in    │
│  queue (~5 min)"   │
└──────┬───────────┘
       │ Agent claims ticket
       ▼
┌──────────────────┐
│ AGENT_CONNECTED   │  (Human agent is now chatting)
│ "Ravi S. joined"  │
└──────┬───────────┘
       │ Agent resolves issue
       ▼
┌──────────────────┐
│ SESSION_CLOSED    │  (Show resolution + feedback modal)
└──────────────────┘
```

### 9.5. Key Frontend Hook: `useChat.ts`

```typescript
import { create } from 'zustand';

type ChatStatus = 'IDLE' | 'AI_ACTIVE' | 'PENDING_HUMAN' | 'HUMAN_CONNECTED' | 'CLOSED';

interface Message {
  id: string;
  role: 'user' | 'model' | 'agent';
  content: string;
  timestamp: string;
  source: 'customer' | 'ai' | 'human_agent';
}

interface ChatState {
  sessionId: string | null;
  status: ChatStatus;
  messages: Message[];
  queuePosition: number | null;
  agentInfo: { agentId: string; agentName: string } | null;

  startSession: (userId: string) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  requestHumanTransfer: (reason: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessionId: null,
  status: 'IDLE',
  messages: [],
  queuePosition: null,
  agentInfo: null,

  startSession: async (userId) => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/chat/session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, platform: 'web' })
    });
    const data = await res.json();
    set({
      sessionId: data.sessionId,
      status: 'AI_ACTIVE',
      messages: [{ id: 'welcome', role: 'model', content: data.welcomeMessage, timestamp: data.createdAt, source: 'ai' }]
    });
  },

  sendMessage: async (text) => {
    const { sessionId, messages } = get();
    const userMsg: Message = { id: `msg_${Date.now()}`, role: 'user', content: text, timestamp: new Date().toISOString(), source: 'customer' };
    set({ messages: [...messages, userMsg] });

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, message: text })
    });
    const data = await res.json();

    const botMsg: Message = { id: `msg_${Date.now() + 1}`, role: 'model', content: data.reply, timestamp: data.timestamp, source: data.is_transfer ? 'ai' : 'ai' };
    set({ messages: [...get().messages, botMsg] });

    if (data.is_transfer) {
      get().requestHumanTransfer(data.transferReason || 'ai_triggered');
    }
  },

  requestHumanTransfer: async (reason) => {
    const { sessionId } = get();
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/chat/transfer-to-human`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, reason })
    });
    const data = await res.json();
    set({ status: 'PENDING_HUMAN', queuePosition: data.queuePosition });
  }
}));
```

### 9.6. Customer-Facing ChatWidget Features

| Feature | Description |
|---|---|
| **Floating Toggle** | Fixed-position button (bottom-right) to open/close the chat window. |
| **Message List** | Auto-scrolling list showing user, bot, and agent messages with distinct styling. |
| **Typing Indicator** | Animated dots shown while AI is generating a response. |
| **"Talk to Human" Button** | Visible in the chat header. Triggers `POST /api/v1/chat/transfer-to-human`. |
| **Status Badge** | Shows current state: 🟢 AI Active, 🟡 Waiting for Agent, 🔵 Agent Connected, ⚪ Closed. |
| **Transfer Banner** | Full-width overlay: "Connecting you to a human agent... Position #3 (~5 min)". |
| **Feedback Modal** | Appears after session closes. Submits to `POST /api/feedback`. |

### 9.7. Agent Dashboard Features

| Feature | Description |
|---|---|
| **Queue Panel** | Real-time list of `PENDING_HUMAN` tickets, sorted by priority. Auto-refreshes via polling. |
| **Ticket Card** | Shows customer name, issue type, priority badge (🔴 CRITICAL, 🟠 HIGH), and wait time. |
| **Claim Button** | One-click to claim a ticket via `POST /api/v1/agent/claim-ticket`. |
| **Active Chat Thread** | Full message history + live input for agent replies via `POST /api/v1/agent/message`. |
| **Customer Sidebar** | Shows order ID, order status, AI conversation summary, and customer language preference. |
| **Quick Replies** | Pre-built macro buttons (e.g., "Refund Initiated", "Replacement Ordered", "Escalated to Admin"). |
| **Resolve Dialog** | Modal to close the ticket via `POST /api/v1/chat/resolve` with resolution type and notes. |

---

## 10. AI-Optimized System Context (Cursor / Copilot)

Drop this block into your `.cursorrules`, `AGENTS.md`, or Copilot instructions file for instant AI-assisted development:

```markdown
## Zeu Backend API Context

### Project
- **Name:** Zeu (Grocery ordering platform for local Kirana stores)
- **Backend:** Vercel Serverless Functions (Node.js)
- **AI Engine:** Google Gemini via `@google/genai` SDK (`ai.interactions.create`)
- **Primary Model:** `gemini-3.6-flash` (standard), `gemini-3.5-pro` (disputes)

### Base URL
- Production: `https://zeu-backend-dgex.vercel.app`

### Auth
- Bearer JWT tokens in `Authorization` header for all `/api/v1/*` endpoints.

### Endpoints Summary
1. `GET /` — Health check. Returns `{status: "online"}`.
2. `POST /api/generate` — Legacy AI chat. JSON `{prompt, classification, history}` → `{reply, is_transfer, model_used}`.
3. `POST /api/feedback` — Multipart form. Fields: `chatbot_rating`, `chatbot_text`, `chatbot_image`, etc.
4. `POST /api/v1/chat/session/start` — Init session. `{userId, platform, orderContext}` → `{sessionId, welcomeMessage}`.
5. `POST /api/v1/chat/message` — Send message. `{sessionId, message, stream}` → `{reply, is_transfer}`.
6. `GET /api/v1/chat/history/:sessionId` — Get chat log. `?limit=50&offset=0`.
7. `POST /api/v1/chat/transfer-to-human` — Escalate. `{sessionId, reason}` → `{ticketId, queuePosition}`.
8. `GET /api/v1/agent/queue` — Agent queue. Returns pending tickets sorted by priority.
9. `POST /api/v1/agent/claim-ticket` — Agent claims ticket. `{ticketId, agentId}` → `{status: "HUMAN_CONNECTED"}`.
10. `POST /api/v1/agent/message` — Agent reply. `{sessionId, agentId, message, actionType}`.
11. `POST /api/v1/chat/resolve` — Close session. `{sessionId, agentId, resolution}` → `{status: "CLOSED"}`.
12. `GET /api/v1/chat/status/:sessionId` — Poll status. Returns `AI_ACTIVE | PENDING_HUMAN | HUMAN_CONNECTED | CLOSED`.

### Business Rules (from N=34 ML Research)
- Late/delayed orders: AI handles directly, NO human transfer.
- Non-delivery ("never received"): IMMEDIATE human transfer.
- 7-minute window: ONLY for Click-and-Collect Pickup, NOT delivery.
- Never connect customer directly to Kirana shopkeeper.
- Empathy without resolution causes churn: always offer hard resolutions (refunds).
- Multilingual: English, Hindi, Marathi.

### Frontend Stack
- Next.js 15 (App Router), Tailwind CSS v4, Shadcn UI, Zustand, React Query, SSE for streaming.
```
