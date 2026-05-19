import "./App.css";
import React, { useCallback, useState, useEffect, useRef } from "react";
import {
  Send,
  Menu,
  Settings,
  LogOut,
  Trash2,
  Copy,
  ChevronsDown,
  EyeOff,
  Eye
} from "lucide-react";

import Markdown from "react-markdown";

// =======================================================================

const BASE = "http://localhost:8000";

export default function App() {
  // ========== STATE MANAGEMENT ==========
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [createNewSession, setcreateNewSession] = useState(true);
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

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // ========== UTILITY FUNCTIONS ==========

  /**
   * Shows a toast notification (auto-dismisses after 4 seconds)
   */
  const showToast = (message, type = "error") => {
    setToast({ message, type });
    Quill(() => setToast(null), 4000);
  };

  /**
   * Auto-scrolls to the latest message
   */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  /**
   * Adjusts textarea height dynamically
   */
  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  };

  /**
   * Copies endpoint to clipboard
   */
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showToast("Copied to clipboard!", "success");
  };

  /**
   * Handles responsive sidebar on mobile
   */
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

  // ============================================= API CALLS ========================================

  /**
   ========== Health check - verifies API connection ==========
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
   *==========Fetches chat history on page load ==========
   */
  const fetchChatHistory = useCallback(async () => {
    try {
      const response = await fetch(`${BASE}/list_chats`);
      if (!response.ok) throw new Error("Failed to fetch chats");
      const data = await response.json();

      // Convert folder names to chat history items
      const chatItems = Array.isArray(data)
        ? data.map((folder, idx) => ({
            id: folder,
            title:
              folder.replace(/chat_|_/g, " ").substring(0, 40) +
              (folder.length > 40 ? "…" : ""),
            updated_at: Date.now() - idx * 3600000,
          }))
        : [];

      setHistoryItems(chatItems);
      setApiStatus((prev) => ({ ...prev, listChats: true }));
    } catch (error) {
      console.error("Error fetching chat history:", error);
      // Use dummy data if API fails

      setApiStatus((prev) => ({ ...prev, listChats: false }));
    }
  }, []);

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
      console.log(typeof data);

      // Parse the conversation format: array of objects with role and content
      // Filter out "previousChatSummerized" role (only needed for backend context)
      const formattedMessages = [];
      if (Array.isArray(data)) {
        data.forEach((msg) => {
          // Skip the summarized context - it's only for backend
          if (msg.role === "previousChatSummerized") {
            return;
          }

          // Map user and ai messages to the format expected by the chat window
          if (msg.role === "user" || msg.role === "ai") {
            formattedMessages.push({
              role: msg.role,
              content: msg.content,
              ts: new Date().toISOString(),
              // Preserve additional fields if present
              ask_type: msg.ask_type || undefined,
              source: msg.source || undefined,
            });
          }
        });
      }

      setMessages(formattedMessages);
      setCurrentChatId(convName);
      setApiStatus((prev) => ({ ...prev, getConv: true }));
      setcreateNewSession(false);
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
      });
      if (currentChatId) {
        params.set("convname", currentChatId);
      }
      const response = await fetch(`${BASE}/llm_search?${params}`);
      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();
      console.log(data);

      // Handle response format: either [model_res, conv_context] or just model_res
      const modelRes = Array.isArray(data) ? data[0] : data;
      const aiContent =
        modelRes.reponse ||
        modelRes.response ||
        "I couldn't generate a response.";
      const resolvedChatId = modelRes.convname || currentChatId;

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

      // Keep the resolved chat id in sync with the backend response
      if (resolvedChatId !== currentChatId) {
        setCurrentChatId(resolvedChatId);
        setcreateNewSession(false);
        // Refresh chat history after the chat id is resolved
        await fetchChatHistory();
      }

      setApiStatus((prev) => ({ ...prev, llmSearch: true }));
    } catch (error) {
      console.error("Error sending message:", error);
      showToast("Failed to send message. Check API connection.");
      setApiStatus((prev) => ({ ...prev, llmSearch: false }));
      // Remove the last empty AI message on error
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, currentChatId, fetchChatHistory]);

  /**
   * Starts a new chat session
   */
  const startNewChat = () => {
    setMessages([]);
    setCurrentChatId(null);
    setInputValue("");
    setTokenCount(0);
    adjustTextareaHeight();
    setcreateNewSession(true);
  };

  /**
   * Deletes a chat from history
   */
  const deleteChat = (chatId) => {
    setHistoryItems((prev) => prev.filter((chat) => chat.id !== chatId));
    if (currentChatId === chatId) {
      startNewChat();
    }
  };

  // ========== LIFECYCLE EFFECTS ==========

  useEffect(() => {
    checkHealth();
    fetchChatHistory();
    const interval = setInterval(checkHealth, 10000); // Check health every 10s
    return () => clearInterval(interval);
  }, [checkHealth, fetchChatHistory]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    adjustTextareaHeight();
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
    const codeBlockRegex = /```([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: "text",
          value: content.slice(lastIndex, match.index),
        });
      }
      parts.push({ type: "code", value: match[1].trim() });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      parts.push({ type: "text", value: content.slice(lastIndex) });
    }

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

  // ========== RENDER ==========

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
            <div className="avatar">AB</div>
            {sidebarOpen && (
              <div className="account-details">
                <div className="account-name">Alex Burman</div>
                <div className="account-role">Pro Plan</div>
              </div>
            )}
          </div>
          {sidebarOpen && (
            <div className="account-actions">
              <button title="Settings">
                <Settings size={16} />
              </button>
              <button title="Logout">
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
                placeholder="Ask  anything…"
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
                setIncognito(!incognito);
                setcreateNewSession(!createNewSession);
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
