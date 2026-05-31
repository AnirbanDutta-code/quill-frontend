import "./App.css";
import React, { useCallback, useState, useEffect, useRef } from "react";
import {
  Send,
  Menu,
  LogOut,
  Trash2,
  Copy,
  ChevronsDown,
  EyeOff,
  Eye,
} from "lucide-react";

import Markdown from "react-markdown";

// =======================================================================

const BASE = import.meta.env.VITE_BASE_URL 
export default function App() {
  // ========== STATE MANAGEMENT ==========
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [createNewSession, setCreateNewSession] = useState(true);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [incognito, setIncognito] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [apiStatus, setApiStatus] = useState({
    health: false,
    llmSearch: false,
    listChats: false,
    getConv: false,
  });
  const [toast, setToast] = useState(null);
  const [tokenCount, setTokenCount] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [isSignupMode, setIsSignupMode] = useState(false);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const autoLoginAttempted = useRef(false);

  // ========== UTILITY FUNCTIONS ==========

  const showToast = (message, type = "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showToast("Copied to clipboard!", "success");
  };

  // ============================================= API CALLS ========================================

  /**
   * Health check - verifies API connection
   */
  const checkHealth = useCallback(async () => {
    try {
      const response = await fetch(`${BASE}/`);
      setApiStatus((prev) => ({ ...prev, health: response.ok }));
    } catch {
      setApiStatus((prev) => ({ ...prev, health: false }));
    }
  }, []);

  /**
   * Fetches chat history on page load
   */
  const fetchChatHistory = useCallback(async () => {
    if (!isLoggedIn) return;

    try {
      const response = await fetch(`${BASE}/list_chats`);
      if (!response.ok) throw new Error("Failed to fetch chats");
      const data = await response.json();
      console.log(data);

      if (data.success && Array.isArray(data.conversations)) {
        const chatItems = data.conversations.map((convName, idx) => ({
          id: convName,
          title:
            convName.replace(/chat_|_/g, " ").substring(0, 40) +
            (convName.length > 40 ? "…" : ""),
          updated_at: Date.now() - idx * 3600000,
        }));
        setHistoryItems(chatItems);
        setApiStatus((prev) => ({ ...prev, listChats: true }));
      } else if (data.error) {
        console.error("Error:", data.error);
        setApiStatus((prev) => ({ ...prev, listChats: false }));
      }
    } catch (error) {
      console.error("Error fetching chat history:", error);
      setApiStatus((prev) => ({ ...prev, listChats: false }));
    }
  }, [isLoggedIn]);

  /**
   * Fetches conversation messages by conversation name
   */
  const fetchConversation = useCallback(async (convName) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ conv_name: convName });
      const response = await fetch(`${BASE}/get_conv?${params}`);
      if (!response.ok) throw new Error("Failed to fetch conversation");
      const data = await response.json();
      if (!data) {
        throw new Error("No data returned from server");
      }

      if (data.success && data.conversation) {
        const formattedMessages = [];
        const conversation = data.conversation;

        if (conversation.messages && Array.isArray(conversation.messages)) {
          conversation.messages.forEach((msg) => {
            const role = msg.role === "assistant" ? "ai" : msg.role;

            if (role === "user" || role === "ai") {
              formattedMessages.push({
                role: role,
                content: msg.content,
                ts: msg.timestamp || new Date().toISOString(),
                sources: msg.sources,
              });
            }
          });
        }

        setMessages(formattedMessages);
        setCurrentChatId(convName);
        setCreateNewSession(false);
        setApiStatus((prev) => ({ ...prev, getConv: true }));
      } else if (data.error) {
        throw new Error(data.error);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error) {
      console.error("Error fetching conversation:", error);
      showToast("Failed to load conversation");
      setApiStatus((prev) => ({ ...prev, getConv: false }));
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Sends message to LLM and streams response
   */
  const sendMessage = useCallback(async () => {
    if (!inputValue.trim()) return;

    const userMessage = {
      role: "user",
      content: inputValue,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    adjustTextareaHeight();
    setIsLoading(true);

    try {
      const params = new URLSearchParams({
        query: inputValue,
        search_type: "ask",
        incognito: incognito,
        createNewSession: createNewSession,
        convname: "",
      });

      if (currentChatId) {
        params.set("convname", currentChatId);
      }

      const response = await fetch(`${BASE}/llm_search?${params}`);
      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();
      console.log("Response:", data);

      let aiContent = "";
      let resolvedChatId = currentChatId;

      // Handle error responses
      if (data.error) {
        throw new Error(data.error);
      }

      // Handle new session response
      if (createNewSession && data.response) {
        const responseContent = data.response.response || data.response;
        aiContent =
          typeof responseContent === "string"
            ? responseContent
            : JSON.stringify(responseContent);
        resolvedChatId = data.conversation_name;
        setCreateNewSession(false);
      }
      // Handle existing session response
      else if (data.response) {
        aiContent =
          typeof data.response === "string"
            ? data.response
            : JSON.stringify(data.response);
        resolvedChatId = data.conversation_name || currentChatId;
      }
      // Handle string response (incognito)
      else if (typeof data === "string") {
        aiContent = data;
      } else {
        aiContent = JSON.stringify(data);
      }

      const aiMessage = {
        role: "ai",
        content: aiContent,
        ts: new Date().toISOString(),
      };

      // Simulate streaming by adding word by word
      setMessages((prev) => [...prev, { ...aiMessage, content: "" }]);
      const words = aiContent.split(" ");
      let currentContent = "";

      for (const word of words) {
        currentContent += (currentContent ? " " : "") + word;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1].content = currentContent;
          return updated;
        });
        await new Promise((resolve) => setTimeout(resolve, 30));
      }

      // Update chat ID if new session was created
      if (resolvedChatId !== currentChatId) {
        setCurrentChatId(resolvedChatId);
        await fetchChatHistory();
      }

      setApiStatus((prev) => ({ ...prev, llmSearch: true }));
    } catch (error) {
      console.error("Error sending message:", error);
      showToast(
        error.message || "Failed to send message. Check API connection.",
      );
      setApiStatus((prev) => ({ ...prev, llmSearch: false }));
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  }, [
    inputValue,
    currentChatId,
    incognito,
    createNewSession,
    fetchChatHistory,
  ]);

  /**
   * Starts a new chat session
   */
  const startNewChat = () => {
    setMessages([]);
    setCurrentChatId(null);
    setInputValue("");
    setTokenCount(0);
    setCreateNewSession(true);
    adjustTextareaHeight();
  };

  /**
   * Deletes a chat from history
   */
  const deleteChat = async (chatId) => {
    try {
      const response = await fetch(`${BASE}/delete_msg?conv_name=${chatId}`);
      const data = await response.json();

      if (data.success) {
        setHistoryItems((prev) => prev.filter((chat) => chat.id !== chatId));
        if (currentChatId === chatId) {
          startNewChat();
        }
        showToast("Conversation deleted successfully", "success");
      } else {
        showToast(data.error || "Failed to delete conversation");
      }
    } catch (error) {
      console.error("Error deleting conversation:", error);
      showToast("Error deleting conversation: " + error.message);
    }
  };

  /**
   * Login user
   */
  const handleLogin = async (user, password) => {
    try {
      const response = await fetch(`${BASE}/login_user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username: user, password: password }),
      });
      const data = await response.json();

      if (data.success) {
        setIsLoggedIn(true);
        setUsername(user);
        showToast("Logged in successfully!", "success");
      } else {
        showToast(data.error || "Login failed");
      }
    } catch (error) {
      showToast("Login error: " + error.message);
    }
  };

  /**
   * Sign up user
   */
  const handleSignUp = async (username, email, age, phone, password) => {
    try {
      const response = await fetch(`${BASE}/create_New_User`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username,
          user_email: email,
          user_age: age,
          user_phone: phone,
          password: password,
        }),
      });
      const data = await response.json();

      if (data.success) {
        showToast("Account created successfully! Please login.", "success");
        setIsSignupMode(false);
      } else {
        showToast(data.error || "Sign up failed");
      }
    } catch (error) {
      showToast("Sign up error: " + error.message);
    }
  };

  /**
   * Logout user
   */
  const handleLogout = () => {
    setIsLoggedIn(false);
    setUsername("");
    setMessages([]);
    setHistoryItems([]);
    setCurrentChatId(null);
    setCreateNewSession(true);
    showToast("Logged out successfully!", "success");
  };

  // ========== LIFECYCLE EFFECTS ==========

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    adjustTextareaHeight();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setSidebarOpen(true);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      fetchChatHistory();
    }
  }, [isLoggedIn, fetchChatHistory]);

  // Auto-login on /test route
  useEffect(() => {
    const attemptAutoLogin = async () => {
      if (window.location.pathname === "/test" && !autoLoginAttempted.current) {
        autoLoginAttempted.current = true;
        await handleLogin("anirban", "hellohi123");
      }
    };
    attemptAutoLogin();
  }, []);

  // ========== EVENT HANDLERS ==========

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    adjustTextareaHeight();
  };

  const handleSuggestionClick = (suggestion) => {
    setInputValue(suggestion);
    textareaRef.current?.focus();
  };

  // ========== COMPONENT: CODE BLOCK WITH COPY BUTTON ==========

  const renderCodeBlock = (content) => {
    return (
      <Markdown
        components={{
          code({ inline, children, ...props }) {
            if (inline) {
              return <code {...props}>{children}</code>;
            }

            const codeValue = String(children).replace(/\n$/, "");

            return (
              <div className="code-block-container">
                <div className="code-block-header">
                  <button
                    className="copy-code-btn"
                    onClick={() => copyToClipboard(codeValue)}
                    title="Copy code"
                  >
                    <Copy size={14} />
                  </button>
                </div>
                <pre>
                  <code {...props}>{children}</code>
                </pre>
              </div>
            );
          },
        }}
      >
        {content}
      </Markdown>
    );
  };

  // ========== COMPONENT: LOADING SKELETON ==========

  const LoadingSkeleton = () => (
    <div className="message msg-ai-wrapper">
      <div className="msg-ai-header">
        <span>⚡</span>
      </div>
      <div
        className="message msg-ai shimmer"
        style={{ width: "200px", height: "40px" }}
      />
    </div>
  );

  // ========== COMPONENT: EMPTY STATE ==========

  const EmptyState = () => (
    <div className="empty-state">
      <div className="empty-logo-wrap">💬</div>
      <h2 className="empty-title">lets Cook</h2>
      <div className="suggestions">
        {[
          "Explain React hooks",
          "MongoDB best practices",
          "API design patterns",
        ].map((suggestion) => (
          <button
            key={suggestion}
            className="suggestion-chip"
            onClick={() => handleSuggestionClick(suggestion)}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );

  // ========== COMPONENT: LOGIN FORM ==========

  const LoginForm = () => {
    const [loginUsername, setLoginUsername] = useState("");
    const [loginPassword, setLoginPassword] = useState("");
    const [signupUsername, setSignupUsername] = useState("");
    const [signupEmail, setSignupEmail] = useState("");
    const [signupAge, setSignupAge] = useState("");
    const [signupPhone, setSignupPhone] = useState("");
    const [signupPassword, setSignupPassword] = useState("");
    const [signupConfirmPassword, setSignupConfirmPassword] = useState("");

    const handleLoginSubmit = (e) => {
      e.preventDefault();
      if (loginUsername && loginPassword) {
        handleLogin(loginUsername, loginPassword);
      }
    };

    const handleSignupSubmit = (e) => {
      e.preventDefault();
      if (
        signupUsername &&
        signupEmail &&
        signupAge &&
        signupPhone &&
        signupPassword &&
        signupConfirmPassword
      ) {
        if (signupPassword !== signupConfirmPassword) {
          showToast("Passwords do not match");
          return;
        }
        handleSignUp(
          signupUsername,
          signupEmail,
          signupAge,
          signupPhone,
          signupPassword,
        );
      }
    };

    return (
      <div className="app-container">
        <div className="login-container">
          <div className="login-card">
            {!isSignupMode ? (
              <>
                <h1>Quill</h1>
                <p>Welcome back</p>
                <form onSubmit={handleLoginSubmit}>
                  <input
                    type="text"
                    placeholder="Username"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    required
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                  <button type="submit">Login</button>
                </form>
                <p className="signup-prompt">
                  New in Quill?{" "}
                  <button
                    type="button"
                    className="signup-link"
                    onClick={() => setIsSignupMode(true)}
                  >
                    Sign up
                  </button>
                </p>
              </>
            ) : (
              <>
                <h1>Quill</h1>
                <p>Create your account</p>
                <form onSubmit={handleSignupSubmit}>
                  <input
                    type="text"
                    placeholder="Username"
                    value={signupUsername}
                    onChange={(e) => setSignupUsername(e.target.value)}
                    required
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                  />
                  <input
                    type="number"
                    placeholder="Age"
                    value={signupAge}
                    onChange={(e) => setSignupAge(e.target.value)}
                    required
                  />
                  <input
                    type="tel"
                    placeholder="Phone"
                    value={signupPhone}
                    onChange={(e) => setSignupPhone(e.target.value)}
                    required
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                  />
                  <input
                    type="password"
                    placeholder="Confirm Password"
                    value={signupConfirmPassword}
                    onChange={(e) => setSignupConfirmPassword(e.target.value)}
                    required
                  />
                  <button type="submit">Sign Up</button>
                </form>
                <p className="signup-prompt">
                  Already have an account?{" "}
                  <button
                    type="button"
                    className="signup-link"
                    onClick={() => setIsSignupMode(false)}
                  >
                    Login
                  </button>
                </p>
              </>
            )}
          </div>
        </div>
        {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
      </div>
    );
  };

  // ========== MAIN RENDER ==========

  if (!isLoggedIn) {
    return <LoginForm />;
  }

  return (
    <div className="app-container">
      {/* ===== SIDEBAR ===== */}
      <aside
        className={`sidebar ${sidebarOpen ? "" : "collapsed"} ${
          isMobile && sidebarOpen ? "mobile-open" : ""
        }`}
      >
        {/* Top Section */}
        <div className="sidebar-top">
          <div className="brand">{sidebarOpen && <span>Quill </span>}</div>

          <button className="btn-new-chat" onClick={startNewChat}>
            <span style={{ fontSize: "16px" }}>+</span>
            {sidebarOpen && "New Chat"}
          </button>
        </div>

        {/* Middle Section - History */}
        {sidebarOpen && (
          <div className="sidebar-middle">
            <div className="section-label">RECENT CHATS</div>
            {historyItems.map((item) => (
              <div
                key={item.id}
                className="history-item"
                onClick={() => fetchConversation(item.id)}
              >
                <div className="history-item-left">
                  <div className="history-title">{item.title}</div>
                </div>
                <button
                  className="history-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteChat(item.id);
                  }}
                  title="Delete chat"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Divider */}
        {sidebarOpen && <div className="divider" />}

        {/* Bottom Section - Account */}
        <div className="sidebar-bottom">
          <div className="account-info">
            <div className="avatar">
              {username.substring(0, 2).toUpperCase()}
            </div>
            {sidebarOpen && (
              <div className="account-details">
                <div className="account-name">{username}</div>
                <div className="account-role">Pro Plan</div>
              </div>
            )}
          </div>
          {sidebarOpen && (
            <div className="account-actions">
              <button title="Logout" onClick={handleLogout}>
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ===== MAIN CHAT AREA ===== */}
      <main className="main-area">
        {/* Header Bar */}
        <header className="header-bar">
          <div className="header-left">
            <button
              className="menu-trigger"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title="Toggle sidebar"
            >
              <Menu size={20} />
            </button>
            <span className="model-label">mistral-small-latest</span>
          </div>

          {/* API Status Pills */}
          <div className="api-status-panel">
            {[
              {
                endpoint: "/",
                label: "GET /",
                status: apiStatus.health,
                title: "Base · Root health check",
              },
              {
                endpoint: "/llm_search",
                label: "GET /llm_search",
                status: apiStatus.llmSearch,
                title: "Query endpoint",
              },
              {
                endpoint: "/list_chats",
                label: "GET /list_chats",
                status: apiStatus.listChats,
                title: "List chats",
              },
              {
                endpoint: "/get_conv",
                label: "GET /get_conv",
                status: apiStatus.getConv,
                title: "Get conversation",
              },
            ].map((api) => (
              <div
                key={api.endpoint}
                className="api-pill"
                onClick={() => copyToClipboard(`${BASE}${api.endpoint}`)}
                title={api.title}
              >
                <span className={`dot ${api.status ? "online" : ""}`} />
                {api.label}
              </div>
            ))}
          </div>
        </header>

        {/* Chat Messages Area */}
        <div className="messages-area">
          {messages.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={
                    msg.role === "user"
                      ? "message msg-user-wrapper"
                      : "message msg-ai-wrapper"
                  }
                >
                  {msg.role === "ai" && <div className="msg-ai-header"></div>}
                  <div
                    className={
                      msg.role === "user"
                        ? "message msg-user"
                        : "message msg-ai"
                    }
                  >
                    {renderCodeBlock(msg.content)}
                    {idx === messages.length - 1 &&
                      msg.role === "ai" &&
                      isLoading && <span className="blinking-cursor" />}
                  </div>
                </div>
              ))}
              {isLoading && <LoadingSkeleton />}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="input-bar">
          <div className="input-container">
            <div className="textarea-wrap">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything…"
                disabled={isLoading}
              />
            </div>

            <button
              className="btn-send"
              onClick={sendMessage}
              disabled={isLoading || !inputValue.trim()}
              title="Send message"
            >
              {isLoading ? "..." : <Send size={18} />}
            </button>
            <button
              className="incognito-fab"
              type="button"
              aria-label="Incognito mode"
              onClick={() => {
                // setIncognito(!incognito);
                fetchChatHistory();
              }}
            >
              {incognito ? <EyeOff size={16} /> : <Eye size={16} />}
              <span>Incognito</span>
            </button>
          </div>
          <div className="connection-info">
            Connected to {BASE} · /llm_search · {tokenCount} tokens
          </div>
        </div>
      </main>

      {/* ===== TOAST NOTIFICATION ===== */}
      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
    </div>
  );
}
