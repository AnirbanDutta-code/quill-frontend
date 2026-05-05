import { Plus, FileText, Send, FileCode, Globe, Sparkles, Menu, X, Joystick, ColumnsSettings } from 'lucide-react';
import './App.css';
import React, { useCallback, useState, useEffect, useRef } from 'react';
import Markdown from 'react-markdown';

export default function App() {
  const [llmAskType, setLlmAskType] = useState('ask');
  const [currConvSources, setCurrConvSources] = useState({});
  const [historyItems, setHistoryItems] = useState([]);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isOldcioncRunning, setIsOldcioncRunning] = useState(false);
  const [currConvName, setCurrConvName] = useState("");
  const [selectedSourceId, setSelectedSourceId] = useState(null);
  const chatContainerRef = useRef(null);


  // Load conversation from history
  const load_old_conv = useCallback(async (conv_name) => {
    try {
      const params = new URLSearchParams({ conv_name: String(conv_name) });
      const response = await fetch(`http://127.0.0.1:8000/get_conv?${params}`);
      const fetchedData = await response.json();
      const formatedData = fetchedData['0']['chat']

      console.log(fetchedData)
      setCurrConvName(conv_name)
      setIsOldcioncRunning(true)
      setMessages(formatedData)
      return formatedData
    } catch (error) {
      console.error("Error fetching conversation:", error);
    }
  }, []);


  // send messages and sources to save them 
  const send_messages = useCallback(async (chat, sources, conv_name) => {
    const param = new URLSearchParams({
      conv_name: conv_name
    });
    try {
      console.log(`http://127.0.0.1:8000/convJsonFile?${param}`)
      const response = await fetch(`http://127.0.0.1:8000/convJsonFile?${param}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chat })
      });
      // console.log(JSON.stringify(data))
    } catch (error) {
      console.error("Error fetching qc:", error);
    }
  }, []);


  // get llm response
  const llm_response = useCallback(async (query, type) => {
    const params = new URLSearchParams({
      query: `${query}`,
      search_type: llmAskType,
      is_new: isOldcioncRunning
    });

    try {
      console.log(llmAskType)
      console.log(isOldcioncRunning)
      console.log(`http://127.0.0.1:8000/llm_model_search?${params}`)
      const response = await fetch(
        `http://127.0.0.1:8000/llm_model_search?${params}`
      );

      const data = await response.json();
      return data
    } catch (error) {
      console.error("Error fetching chats:", error);
    }
  }, [llmAskType, isOldcioncRunning]);


  // handel massages  
  const handleSendMessage = useCallback(async () => {


    // Add user message
    setMessages(prev => [...prev, { sender: 'human', text: message }]);
    const userMessage = message;
    console.log(userMessage)
    setMessage("");

    try {
      const response = await llm_response(userMessage);
      // Add AI response
      const updatedMessages = [...messages, { sender: 'human', text: userMessage }, { sender: 'ai', text: response.reponse }];

      //set datas to usesate consts
      setMessages(updatedMessages);
      setCurrConvSources(response.sources)
      setCurrConvName(response.convname)
      setIsOldcioncRunning(true)

      //send json files
      send_messages(updatedMessages, response.sources, response.convname || currConvName);

      // loggs       
      console.log(response.convname || currConvName)
      console.log(response.sources)

    } catch (error) {
      console.error(error);
    }
  }, [message, llm_response, messages, currConvName, send_messages]);


  // list message sessions
  const list_dir = useCallback(async () => {
    try {
      const response = await fetch("http://127.0.0.1:8000/list_chats");
      const data = await response.json();
      setHistoryItems(data);
      console.log(data);
    } catch (error) {
      console.error("Error fetching chats:", error);
    }
  }, []);


  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log('File selected:', file.name);
      // Handle file upload here
    }
  };

  useEffect(() => {
    list_dir();
  }, [messages])

  const log_llm_ask = useCallback(async (type) => {
    try {

      console.log(type)
    } catch (error) {
      console.error("Error fetching chats:", error);
    }
  }, []);


  return (
    <div className="main-wrapper">

      {/* SIDEBAR OVERLAY */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* LEFT SIDEBAR */}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>

        {/* Options Block */}
        <div className="options-block">
          <div className="options-title">Options</div>
          <div className="options-items">
            <div className="option-item"></div>
            <div className="option-item"></div>
            <div className="option-item"></div>
          </div>
        </div>

        {/* History Block */}
        <div className="history-block">
          <div className="history-title">History</div>
          <div className="history-items">
            {historyItems.map((item, index) => (
              <div key={index} className="history-item" onClick={() => { load_old_conv(item) }} >
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      {/* Content Area with Sources Panel */}
      <div className="content-area">
        <div className='chat-container' ref={chatContainerRef}>
          {messages.map((msg, index) => (
            <React.Fragment key={index}>
              <div className={`chat-message ${msg.sender}`}>
                <div className={`message-bubble ${msg.sender}`}>
                  <Markdown>{msg.text}</Markdown>
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>

        {Object.keys(currConvSources).length > 0 && (
          <div className="sources-panel">
            <div className="sources-title">Sources</div>
            {selectedSourceId && currConvSources[selectedSourceId] && (
              <div className="selected-source" onClick={() => setSelectedSourceId(null)}>
                <div className="source-url">
                  <a href={currConvSources[selectedSourceId].urls} target="_blank" rel="noopener noreferrer">
                    {currConvSources[selectedSourceId].urls}
                  </a>
                </div>
                <div className="source-content">
                  {currConvSources[selectedSourceId].content}
                </div>
              </div>
            )}
            <div className="sources-list">
              {Object.entries(currConvSources).map(([id, source]) => (
                <div
                  key={id}
                  className={`source-url-item ${selectedSourceId === id ? 'hidden' : ''}`}
                  onClick={() => setSelectedSourceId(id)}
                >
                  <p href={source.urls} target="_blank" rel="noopener noreferrer">
                    {source.urls}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Bar */}
        {/* Main Search Input */}
        <div className="search-input">

          <input
            id="file-upload"
            type="file"
            style={{ display: 'none' }}
          />

          <input
            type="text"
            className="input-placeholder"
            placeholder="ask anything ...."
            value={message}
            onChange={(e) => { setMessage(e.target.value) }}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />

          {/* Right Actions */}
          <div className="right-actions">

            <select name="Type" id="llmQuerytype" className='action-icon' onChange={(e) => {
              console.log(e.target.value)
              setLlmAskType(e.target.value)
            }}>
              <option value="ask">ask</option>
              <option value="deep_research">deep Research</option>
              <option value="deep_thinking">deep thinking</option>
            </select>

            {/* Send Button */}
            <button className="send-button" onClick={handleSendMessage}>
              <Send size={18} strokeWidth={2.5} />
            </button>
          </div>

        </div>


      </div>
    </div>
  );
}
