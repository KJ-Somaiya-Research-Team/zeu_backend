# Zeu Backend API — Complete Technical Documentation 

> **Version:** 2.0.0 | **Last Updated:** 2026-07-26
> **Deployment:** Vercel Serverless Functions (Node.js)
> **AI Engine:** Google Gemini (`@google/genai` SDK, `gemini-3.6-flash` / `gemini-3.5-pro`)
> **Maintainer:** KJ Somaiya Research Team (Backend & AI Architect)

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

## 9. Frontend Architecture & UI Blueprint (React + Vite on VPS)

> **Architecture:** The Zeu frontend is a standalone React SPA built with Vite. It is deployed on a VPS (e.g., DigitalOcean, AWS EC2, Hostinger) and consumes the Zeu Node.js backend hosted on Vercel via REST API calls. The backend and frontend are fully decoupled.

### 9.1. Recommended Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Build Tool** | Vite 6+ | Blazing fast HMR, optimized production builds, native ESM. |
| **UI Library** | React 19 | Industry standard SPA library. |
| **Language** | TypeScript | Type safety across API contracts. |
| **Routing** | React Router v7 | Client-side routing for SPA pages. |
| **Styling** | Tailwind CSS v4 | Utility-first CSS for rapid, consistent UI. |
| **State Management** | Zustand | Lightweight global store for chat & auth state. |
| **Data Fetching** | TanStack React Query v5 | Caching, polling, background refetch for API calls. |
| **Real-Time** | Server-Sent Events (SSE) / Polling | Streaming AI responses and live status updates. |
| **Auth** | Firebase Auth / Clerk / Custom JWT | Token-based auth. Store JWT in memory or `httpOnly` cookie. |
| **HTTP Client** | Native `fetch` or `axios` | Direct REST calls to the Vercel backend. |
| **Hosting** | VPS (DigitalOcean / AWS EC2 / Hostinger) | Full control. Served via Nginx as static files. |

### 9.2. Project Scaffolding (Terminal Commands)

```bash
# 1. Create the Vite + React + TypeScript project
npx -y create-vite@latest zeu-frontend -- --template react-ts
cd zeu-frontend

# 2. Install core dependencies
npm install react-router-dom zustand @tanstack/react-query axios

# 3. Install Tailwind CSS v4
npm install tailwindcss @tailwindcss/vite
```

Add Tailwind to `vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

Add to `src/index.css`:
```css
@import "tailwindcss";
```

### 9.3. Environment Configuration (`.env`)

Create a `.env` file in the project root. Vite exposes variables prefixed with `VITE_` to client-side code.

```env
# Zeu Backend (Vercel — managed by Sahil)
VITE_API_BASE_URL=https://zeu-backend-dgex.vercel.app

# App Config
VITE_APP_NAME=Zeu
VITE_APP_VERSION=1.0.0
```

Access in code:
```typescript
const API_URL = import.meta.env.VITE_API_BASE_URL;
```

### 9.4. Folder Structure

```
zeu-frontend/
├── public/
│   └── favicon.svg
├── src/
│   ├── main.tsx                       # Entry point
│   ├── App.tsx                        # Root component + Router
│   ├── index.css                      # Tailwind import
│   │
│   ├── api/
│   │   └── client.ts                  # Centralized API client (fetch wrapper)
│   │
│   ├── pages/
│   │   ├── HomePage.tsx               # Landing page
│   │   ├── ChatPage.tsx               # Customer chat full-page view
│   │   └── AgentDashboardPage.tsx     # Support agent portal
│   │
│   ├── components/
│   │   ├── chat/
│   │   │   ├── ChatWidget.tsx         # Floating toggle button (bottom-right)
│   │   │   ├── ChatWindow.tsx         # Full chat container
│   │   │   ├── MessageBubble.tsx      # Individual message (user/bot/agent)
│   │   │   ├── MessageList.tsx        # Scrollable message history
│   │   │   ├── ChatInput.tsx          # Text input + send button
│   │   │   ├── TypingIndicator.tsx    # Animated "Bot is typing..."
│   │   │   ├── StatusBadge.tsx        # AI_ACTIVE / PENDING_HUMAN / etc.
│   │   │   ├── TransferBanner.tsx     # "Connecting to agent..." overlay
│   │   │   └── FeedbackModal.tsx      # Post-resolution star rating modal
│   │   │
│   │   └── agent/
│   │       ├── QueuePanel.tsx         # List of pending tickets
│   │       ├── TicketCard.tsx         # Individual ticket preview card
│   │       ├── ActiveChatThread.tsx   # Agent's live chat view
│   │       ├── CustomerSidebar.tsx    # Order context & AI summary
│   │       ├── QuickReplies.tsx       # Macro/template buttons
│   │       └── ResolveDialog.tsx      # Close/resolve ticket modal
│   │
│   ├── hooks/
│   │   ├── useChat.ts                 # Chat session lifecycle hook
│   │   ├── useChatStatus.ts           # Polling hook for session status
│   │   └── useAgentQueue.ts           # Agent queue data hook
│   │
│   ├── stores/
│   │   └── chatStore.ts              # Zustand global chat state
│   │
│   ├── types/
│   │   └── chat.ts                   # TypeScript interfaces & enums
│   │
│   └── lib/
│       └── constants.ts              # Status enums, config values
│
├── .env                               # Environment variables
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

### 9.5. Centralized API Client (`src/api/client.ts`)

This is the single source of truth for all HTTP calls to the Zeu Vercel backend. Every component and hook should import from here.

```typescript
const BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Helper to get auth token (from your auth system)
const getToken = (): string | null => {
  return localStorage.getItem('zeu_auth_token');
};

// Generic request function
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// ─── AI CHAT ENDPOINTS ───────────────────────────────

/** Legacy endpoint (currently deployed and live) */
export const sendAIMessage = (prompt: string, classification = 'STANDARD', history: any[] = []) =>
  request<{ success: boolean; reply: string; is_transfer: boolean; model_used: string }>(
    '/api/generate',
    {
      method: 'POST',
      body: JSON.stringify({ prompt, classification, history }),
    }
  );

/** v1: Start a new chat session */
export const startChatSession = (userId: string, platform = 'web', language = 'en') =>
  request<{ success: boolean; sessionId: string; status: string; welcomeMessage: string }>(
    '/api/v1/chat/session/start',
    {
      method: 'POST',
      body: JSON.stringify({ userId, platform, language }),
    }
  );

/** v1: Send message within a session */
export const sendSessionMessage = (sessionId: string, message: string, stream = false) =>
  request<{ success: boolean; reply: string; is_transfer: boolean; model_used: string; timestamp: string }>(
    '/api/v1/chat/message',
    {
      method: 'POST',
      body: JSON.stringify({ sessionId, message, stream }),
    }
  );

/** v1: Fetch chat history */
export const getChatHistory = (sessionId: string, limit = 50) =>
  request<{ success: boolean; messages: any[] }>(
    `/api/v1/chat/history/${sessionId}?limit=${limit}`
  );

/** v1: Get session status (for polling) */
export const getChatStatus = (sessionId: string) =>
  request<{ success: boolean; status: string; agentInfo?: any; queuePosition?: number }>(
    `/api/v1/chat/status/${sessionId}`
  );

// ─── HUMAN TRANSFER ENDPOINTS ────────────────────────

/** v1: Transfer to human agent */
export const transferToHuman = (sessionId: string, reason: string) =>
  request<{ success: boolean; ticketId: string; queuePosition: number; estimatedWaitMinutes: number }>(
    '/api/v1/chat/transfer-to-human',
    {
      method: 'POST',
      body: JSON.stringify({ sessionId, reason }),
    }
  );

/** v1: Get agent queue */
export const getAgentQueue = (status = 'PENDING_HUMAN') =>
  request<{ success: boolean; queueLength: number; tickets: any[] }>(
    `/api/v1/agent/queue?status=${status}`
  );

/** v1: Agent claims a ticket */
export const claimTicket = (ticketId: string, agentId: string) =>
  request<{ success: boolean; sessionId: string; status: string; customerContext: any }>(
    '/api/v1/agent/claim-ticket',
    {
      method: 'POST',
      body: JSON.stringify({ ticketId, agentId }),
    }
  );

/** v1: Agent sends a message */
export const sendAgentMessage = (sessionId: string, agentId: string, message: string, actionType = 'text') =>
  request<{ success: boolean; messageId: string }>(
    '/api/v1/agent/message',
    {
      method: 'POST',
      body: JSON.stringify({ sessionId, agentId, message, actionType }),
    }
  );

/** v1: Resolve/close session */
export const resolveSession = (sessionId: string, agentId: string, resolution: string, agentNotes = '') =>
  request<{ success: boolean; status: string }>(
    '/api/v1/chat/resolve',
    {
      method: 'POST',
      body: JSON.stringify({ sessionId, agentId, resolution, agentNotes }),
    }
  );

// ─── FEEDBACK ENDPOINT ───────────────────────────────

/** Submit multipart feedback (uses FormData, no JSON Content-Type) */
export const submitFeedback = (formData: FormData) =>
  fetch(`${BASE_URL}/api/feedback`, {
    method: 'POST',
    body: formData, // Browser auto-sets Content-Type with boundary
  }).then((res) => res.json());
```

### 9.6. Zustand Chat Store (`src/stores/chatStore.ts`)

```typescript
import { create } from 'zustand';
import * as api from '../api/client';

type ChatStatus = 'IDLE' | 'AI_ACTIVE' | 'PENDING_HUMAN' | 'HUMAN_CONNECTED' | 'CLOSED';

interface Message {
  id: string;
  role: 'user' | 'model' | 'agent';
  content: string;
  timestamp: string;
}

interface ChatState {
  sessionId: string | null;
  status: ChatStatus;
  messages: Message[];
  isLoading: boolean;
  queuePosition: number | null;
  agentName: string | null;

  startSession: (userId: string) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  requestHuman: (reason: string) => Promise<void>;
  pollStatus: () => Promise<void>;
  reset: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessionId: null,
  status: 'IDLE',
  messages: [],
  isLoading: false,
  queuePosition: null,
  agentName: null,

  startSession: async (userId) => {
    const data = await api.startChatSession(userId);
    set({
      sessionId: data.sessionId,
      status: 'AI_ACTIVE',
      messages: [{
        id: 'welcome',
        role: 'model',
        content: data.welcomeMessage,
        timestamp: new Date().toISOString(),
      }],
    });
  },

  sendMessage: async (text) => {
    const { sessionId } = get();
    if (!sessionId) return;

    // Optimistic UI: add user message immediately
    const userMsg: Message = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    set((s) => ({ messages: [...s.messages, userMsg], isLoading: true }));

    // Call the backend
    const data = await api.sendSessionMessage(sessionId, text);

    const botMsg: Message = {
      id: `b_${Date.now()}`,
      role: 'model',
      content: data.reply,
      timestamp: data.timestamp,
    };
    set((s) => ({ messages: [...s.messages, botMsg], isLoading: false }));

    // Auto-transfer if backend flags it
    if (data.is_transfer) {
      get().requestHuman('ai_triggered');
    }
  },

  requestHuman: async (reason) => {
    const { sessionId } = get();
    if (!sessionId) return;
    const data = await api.transferToHuman(sessionId, reason);
    set({ status: 'PENDING_HUMAN', queuePosition: data.queuePosition });
  },

  pollStatus: async () => {
    const { sessionId } = get();
    if (!sessionId) return;
    const data = await api.getChatStatus(sessionId);
    set({
      status: data.status as ChatStatus,
      queuePosition: data.queuePosition ?? null,
      agentName: data.agentInfo?.agentName ?? null,
    });
  },

  reset: () => set({
    sessionId: null, status: 'IDLE', messages: [],
    isLoading: false, queuePosition: null, agentName: null,
  }),
}));
```

### 9.7. App Router Setup (`src/App.tsx`)

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HomePage from './pages/HomePage';
import ChatPage from './pages/ChatPage';
import AgentDashboardPage from './pages/AgentDashboardPage';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/agent" element={<AgentDashboardPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

### 9.8. Chat State Machine (UI Transitions)

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
│ HANDOFF_REQUESTED │  (Calls POST /api/v1/chat/transfer-to-human)
└──────┬───────────┘
       │ Server confirms, ticket created
       ▼
┌──────────────────┐
│ WAITING_FOR_AGENT │  (Polls GET /api/v1/chat/status/:id every 4s)
│ "You are #3 in    │
│  queue (~5 min)"   │
└──────┬───────────┘
       │ Agent claims ticket → status becomes HUMAN_CONNECTED
       ▼
┌──────────────────┐
│ AGENT_CONNECTED   │  (Human agent is now chatting)
│ "Ravi S. joined"  │
└──────┬───────────┘
       │ Agent resolves issue → POST /api/v1/chat/resolve
       ▼
┌──────────────────┐
│ SESSION_CLOSED    │  (Show resolution summary + FeedbackModal)
└──────────────────┘
```

### 9.9. Customer ChatWidget Features

| Feature | Description |
|---|---|
| **Floating Toggle** | Fixed-position button (bottom-right) to open/close the chat window. |
| **Message List** | Auto-scrolling list with distinct bubble styles for user (right, blue), bot (left, gray), and agent (left, green). |
| **Typing Indicator** | Animated 3-dot pulse shown while `isLoading === true`. |
| **"Talk to Human" Button** | In the chat header. Calls `useChatStore.requestHuman('explicit_human_request')`. |
| **Status Badge** | 🟢 `AI_ACTIVE` · 🟡 `PENDING_HUMAN` · 🔵 `HUMAN_CONNECTED` · ⚪ `CLOSED`. |
| **Transfer Banner** | Full-width overlay: "Connecting you to a human agent... Position #3 (~5 min)". Shown when `status === 'PENDING_HUMAN'`. |
| **Feedback Modal** | Appears when `status === 'CLOSED'`. Submits star ratings + text via `submitFeedback(formData)`. |

### 9.10. Agent Dashboard Features

| Feature | Description |
|---|---|
| **Queue Panel** | Real-time list of `PENDING_HUMAN` tickets via `getAgentQueue()`. Auto-refreshes with React Query `refetchInterval: 5000`. |
| **Ticket Card** | Shows customer ID, issue type, priority badge (🔴 CRITICAL, 🟠 HIGH, 🟡 MEDIUM), and wait time. |
| **Claim Button** | One-click to claim via `claimTicket(ticketId, agentId)`. Disabled if already claimed (409). |
| **Active Chat Thread** | Full message history via `getChatHistory(sessionId)` + live input via `sendAgentMessage()`. |
| **Customer Sidebar** | Displays order ID, order status, AI conversation summary, and customer language. |
| **Quick Replies** | Pre-built macro buttons: "Refund Initiated ₹", "Replacement Ordered", "Escalated to Admin". Each calls `sendAgentMessage()` with the appropriate `actionType`. |
| **Resolve Dialog** | Modal to close the ticket via `resolveSession()` with dropdown for resolution type and notes textarea. |

### 9.11. VPS Deployment Guide (Production)

#### Step 1: Build the production bundle
```bash
cd zeu-frontend
npm run build
```
This outputs optimized static files to `dist/`.

#### Step 2: Upload to VPS
```bash
# SCP the dist folder to your server
scp -r dist/ root@YOUR_VPS_IP:/var/www/zeu-frontend
```

#### Step 3: Configure Nginx

Create `/etc/nginx/sites-available/zeu`:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    root /var/www/zeu-frontend;
    index index.html;

    # SPA fallback: serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets aggressively
    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable the site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/zeu /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
```

#### Step 4: Add SSL (HTTPS)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

#### Step 5: Verify
Open `https://yourdomain.com` — your React SPA loads and all API calls hit `https://zeu-backend-dgex.vercel.app` (CORS is already enabled on the backend).

---

## 10. AI-Optimized System Context (Cursor / Copilot)

Drop this block into your `.cursorrules`, `AGENTS.md`, or Copilot instructions file for instant AI-assisted development:

```markdown
## Zeu Project Context

### Architecture
- **Backend:** Vercel Serverless Functions (Node.js). Managed externally. Base URL: `https://zeu-backend-dgex.vercel.app`
- **Frontend:** React 19 + Vite 6 + TypeScript SPA. Deployed on VPS via Nginx.
- **AI Engine:** Google Gemini via `@google/genai` SDK (`ai.interactions.create`)
- **Primary Model:** `gemini-3.6-flash` (standard), `gemini-3.5-pro` (disputes)

### Frontend Stack
- React 19, Vite 6, TypeScript, React Router v7, Tailwind CSS v4, Zustand, TanStack React Query v5.
- Env var prefix: `VITE_` (e.g., `VITE_API_BASE_URL`).
- All API calls go through `src/api/client.ts`.

### API Endpoints Summary
1. `GET /` — Health check. Returns `{status: "online"}`.
2. `POST /api/generate` — Legacy AI chat. JSON `{prompt, classification, history}` → `{reply, is_transfer, model_used}`.
3. `POST /api/feedback` — Multipart form (FormData). Fields: `chatbot_rating`, `chatbot_text`, `chatbot_image`, etc.
4. `POST /api/v1/chat/session/start` — Init session. `{userId, platform, language}` → `{sessionId, welcomeMessage}`.
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

### Key Files
- `src/api/client.ts` — All API functions. Import from here, never call fetch directly.
- `src/stores/chatStore.ts` — Zustand store with `startSession`, `sendMessage`, `requestHuman`, `pollStatus`.
- `src/pages/ChatPage.tsx` — Customer chat view.
- `src/pages/AgentDashboardPage.tsx` — Support agent portal.
```
