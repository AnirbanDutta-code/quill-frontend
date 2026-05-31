# Quill API Endpoints Documentation

## Base URL
```
http://localhost:8000
```

## Authentication Endpoints

### 1. Create New User
**Endpoint:** `GET /create_New_User`

**Parameters:**
- `username` (string, required): Username for the new account
- `user_email` (string, required): Valid email address
- `user_age` (integer, required): User's age
- `user_phone` (string, required): Phone number (10-15 digits)
- `password` (string, required): Password for the account

**Response (Success):**
```json
{
  "success": true,
  "user_id": "mongo_object_id",
  "username": "username"
}
```

**Response (Error):**
```json
{
  "error": "Error message describing what went wrong"
}
```

**Example:**
```
GET http://localhost:8000/create_New_User?username=john_doe&user_email=john@example.com&user_age=25&user_phone=1234567890&password=securepass123
```

---

### 2. Login User
**Endpoint:** `GET /login_user`

**Parameters:**
- `username` (string, required): Username
- `password` (string, required): Password

**Response (Success):**
```json
{
  "success": true,
  "message": "User {username} logged in successfully",
  "user_profile": {
    "username": "username",
    "user_email": "user@example.com",
    "user_age": 25,
    "user_phone": "1234567890",
    "created_at": "2024-01-01T00:00:00.000Z",
    "profile_type": "user_info"
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "password not matched" or "User not found"
}
```

**Example:**
```
GET http://localhost:8000/login_user?username=john_doe&password=securepass123
```

---

## Chat Endpoints

### 3. Send Query / Chat Message
**Endpoint:** `GET /llm_search`

**Parameters:**
- `query` (string, required): The user's question or message
- `search_type` (string, required): Type of search ("ask", "deep_thinking", "deep_research")
- `incognito` (boolean, required): Whether to save conversation (false = save, true = don't save)
- `createNewSession` (boolean, required): Start new conversation or continue existing
- `convname` (string, optional): Conversation name (required if createNewSession=false)

**Response (New Session):**
```json
{
  "conversation_id": "mongo_object_id",
  "conversation_name": "generated_conversation_name",
  "response": {
    "response": "AI response text",
    "sources": {...},
    "convname": "generated_conversation_name"
  }
}
```

**Response (Existing Session):**
```json
"AI response text"
```

**Response (Incognito):**
```json
{
  "response": "AI response text",
  "sources": {...}
}
```

**Example - New Session (Not Incognito):**
```
GET http://localhost:8000/llm_search?query=What%20is%20MongoDB&search_type=ask&incognito=false&createNewSession=true
```

**Example - Continue Session:**
```
GET http://localhost:8000/llm_search?query=Tell%20me%20more&search_type=ask&incognito=false&createNewSession=false&convname=Chat_20240101_120000
```

**Example - Incognito Mode:**
```
GET http://localhost:8000/llm_search?query=What%20is%20React&search_type=ask&incognito=true&createNewSession=true
```

---

### 4. List All Conversations
**Endpoint:** `GET /list_chats`

**Parameters:** None (uses logged-in user)

**Response (Success):**
```json
{
  "success": true,
  "conversations": [
    "Chat_20240101_120000",
    "Chat_20240101_130000",
    "Chat_20240102_090000"
  ]
}
```

**Response (Error):**
```json
{
  "error": "Please login first"
}
```

**Example:**
```
GET http://localhost:8000/list_chats
```

---

### 5. Get Conversation Messages
**Endpoint:** `GET /get_conv`

**Parameters:**
- `conv_name` (string, required): Name of the conversation to retrieve

**Response (Success):**
```json
{
  "success": true,
  "conversation": {
    "conversation_name": "Chat_20240101_120000",
    "created_at": "2024-01-01T12:00:00.000Z",
    "messages": [
      {
        "role": "user",
        "content": "What is MongoDB?",
        "timestamp": "2024-01-01T12:00:00.000Z"
      },
      {
        "role": "assistant",
        "content": "MongoDB is a NoSQL database...",
        "sources": {...},
        "timestamp": "2024-01-01T12:00:01.000Z"
      }
    ]
  }
}
```

**Response (Error):**
```json
{
  "error": "Please login first"
}
```

**Example:**
```
GET http://localhost:8000/get_conv?conv_name=Chat_20240101_120000
```

---

## Flow Example

1. **Create account:**
   ```
   GET /create_New_User?username=alice&user_email=alice@example.com&user_age=28&user_phone=9876543210&password=pass123
   ```

2. **Login:**
   ```
   GET /login_user?username=alice&password=pass123
   ```

3. **Start new chat:**
   ```
   GET /llm_search?query=Explain%20React%20Hooks&search_type=ask&incognito=false&createNewSession=true
   ```

4. **Continue chat (use conversation_name from previous response):**
   ```
   GET /llm_search?query=What%20about%20useState&search_type=ask&incognito=false&createNewSession=false&convname=Chat_20240101_120000
   ```

5. **List all conversations:**
   ```
   GET /list_chats
   ```

6. **Get conversation history:**
   ```
   GET /get_conv?conv_name=Chat_20240101_120000
   ```

---

## Important Notes

- All endpoints are currently using GET requests (should ideally use POST for sensitive data)
- Authentication uses a global `current_user` variable - ensure you login before accessing chat endpoints
- Incognito mode prevents conversation storage
- Password validation uses bcrypt hashing
- Conversation names are auto-generated based on timestamps and query content
