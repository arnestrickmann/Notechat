"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import LoadingSkeleton from "./LoadingSkeleton";
import SparkleIcon from "./SparkleIcon";
import EmptyChatState from "./EmptyChatState";
import logo from "../assets/logo.png";
import Spinner from "./Spinner";
import InfoIcon from "./InfoIcon";
import chatscreen from "../assets/screenshotchat.png";
import InfoModal from "./InfoModal";
import Notification from "./Notification";
import SUGGESTIONS from "../constants/suggestions";
import SourcesList from "./SourcesList";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: {
    noteTitle: string;
    noteUpdated: string;
    chunkContent: string;
  }[];
}

interface OllamaStatus {
  running: boolean;
  error?: string;
  modelAvailable?: boolean;
}

interface NoteReference {
  noteTitle: string;
  noteUpdated: string;
}

interface ChatProps {
  onSetupComplete: (status: boolean) => void;
}

const MODELS = {
  LLAMA2: "llama2",
  LLAMA3: "llama3.2:3b",
} as const;

type ModelType = (typeof MODELS)[keyof typeof MODELS];

interface ModelConfig {
  id: ModelType;
  name: string;
  displayName: string;
}

const MODEL_CONFIGS: ModelConfig[] = [
  { id: MODELS.LLAMA2, name: "llama2", displayName: "Llama 2" },
  { id: MODELS.LLAMA3, name: "llama3.2:3b", displayName: "Llama 3" },
];

export default function Chat({ onSetupComplete }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus>({
    running: false,
  });
  const [currentResponse, setCurrentResponse] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelType>(MODELS.LLAMA3);
  const [isStarting, setIsStarting] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const noteReferences: Record<string, NoteReference> = {};
  const [folders, setFolders] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>("All Folders");
  const [showFolderSelect, setShowFolderSelect] = useState(false);

  // for notifications
  const [setupMessage, setSetupMessage] = useState<string>("");
  // ref for the messages container
  const messagesRef = useRef<HTMLDivElement>(null);

  // scroll to bottom function
  const scrollToBottom = () => {
    messagesRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // useeffect to scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages, currentResponse]);

  useEffect(() => {
    const checkOllamaStatus = async () => {
      try {
        const status = await window.electron.checkOllamaStatus();
        if (status.running) {
          const hasModel = await window.electron.checkOllamaModel(
            selectedModel
          );
          setOllamaStatus({ ...status, modelAvailable: hasModel });
        } else {
          setOllamaStatus(status);
        }
      } catch (error) {
        console.error("Failed to check Ollama status:", error);
        setOllamaStatus({ running: false, error: undefined });
      }
    };

    checkOllamaStatus();
    const interval = setInterval(checkOllamaStatus, 30000);
    return () => clearInterval(interval);
  }, [selectedModel]);

  useEffect(() => {
    const fetchFolders = async () => {
      try {
        const folderList = await window.electron.getFoldersInDb();
        setFolders(["All Folders", ...folderList]);
      } catch (error) {
        console.error("Failed to fetch folders:", error);
      }
    };

    fetchFolders();
  }, []);

  // for notifications
  useEffect(() => {
    const cleanup = window.electron.onSetupMessage((message: string) => {
      setSetupMessage(message);
      setTimeout(() => setSetupMessage(""), 2000);
    });

    return cleanup;
  }, []);

  const handleSetupOllama = async () => {
    setIsStarting(true);
    try {
      await window.electron.setupOllama();
      const hasModel = await window.electron.checkOllamaModel(selectedModel);
      setOllamaStatus({ running: true, modelAvailable: hasModel });
      onSetupComplete(true);
    } catch (error) {
      console.error("Failed to start Ollama:", error);
      setOllamaStatus({ running: false, error: undefined });
      onSetupComplete(false);
    } finally {
      setIsStarting(false);
    }
  };

  const handlePullModel = async () => {
    try {
      setIsLoading(true);
      await window.electron.pullOllamaModel(selectedModel);
      setOllamaStatus({ running: true, modelAvailable: true });
    } catch (error) {
      console.error(`Failed to pull ${selectedModel} model:`, error);
      setOllamaStatus((prev) => ({ ...prev, error: undefined }));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const handleToggleInstructions = () => setShowInstructions((prev) => !prev);
    window.addEventListener("toggleInstructions", handleToggleInstructions);
    return () =>
      window.removeEventListener(
        "toggleInstructions",
        handleToggleInstructions
      );
  }, []);

  const generateResponse = async (
    prompt: string,
    onProgress: (text: string) => void
  ) => {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: selectedModel,
        prompt: prompt,
        stream: true,
      }),
    });

    const reader = response.body?.getReader();
    let fullResponse = "";

    if (reader) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = new TextDecoder().decode(value);
          const lines = chunk.split("\n").filter(Boolean);

          for (const line of lines) {
            const json = JSON.parse(line);
            if (json.response) {
              fullResponse += json.response;
              onProgress(fullResponse);
            }
            if (json.error) {
              throw new Error(json.error);
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    }

    return fullResponse;
  };

  const handleClearChat = () => {
    setMessages([]);
    setCurrentResponse("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !ollamaStatus.running || !ollamaStatus.modelAvailable)
      return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setCurrentResponse("");

    try {
      const similarChunks = await window.electron.findSimilarChunks(
        input,
        5,
        19,
        selectedFolder === "All Folders" ? undefined : selectedFolder
      );

      similarChunks.forEach((chunk) => {
        noteReferences[chunk.chunkId] = {
          noteTitle: chunk.noteTitle,
          noteUpdated: chunk.noteUpdated,
        };
      });
      console.log(`noteReferences: ${JSON.stringify(noteReferences, null, 2)}`);

      const relevantContext = similarChunks
        .map(
          (chunk) => `From note "${chunk.noteTitle}":\n${chunk.chunkContent}`
        )
        .join("\n\n");
      console.log("relevantContext", relevantContext);

      const conversationContext = messages
        .slice(-4)
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join("\n");

      const promptWithContext = `
You are the Notechat AI assistant, a specialized tool for searching and analyzing Apple Notes content. Your core capabilities include:
- Searching through user's Apple Notes
- Understanding and referencing note contents
- Maintaining conversation continuity
- Providing markdown-formatted responses

CORE OBJECTIVES:
1. Answer questions based EXCLUSIVELY on the user's Apple Notes content
2. Maintain conversation context while focusing on note-specific information
3. Provide clear, structured responses that reference source notes

RESPONSE STRUCTURE:
1. Begin with a direct answer to the user's query
2. Keep answers short and to the point.
3. Use markdown formatting for clarity:
   - **Bold** for important points
   - Headers (##) for sections in longer responses
   - Lists for multiple points
4. When information is partial:
   - Clearly state what was found
   - Explicitly mention what information is missing
5. When no information is found:
   - Directly state: "I could not find relevant information in your connected notes"
   - Do not provide information from general knowledge

Relevant information from the Users Notes:
${relevantContext}

Previous conversation:
${conversationContext}

User: ${input}
Assistant: `;

      const fullResponse = await generateResponse(
        promptWithContext,
        (text: string) => {
          setCurrentResponse(text);
        }
      );

      const assistantMessage: Message = {
        role: "assistant",
        content: fullResponse,
        sources: similarChunks.map((chunk) => ({
          noteTitle: chunk.noteTitle,
          noteUpdated: chunk.noteUpdated,
          chunkContent: chunk.chunkContent,
        })),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setCurrentResponse("");
    } catch (error) {
      console.error("Failed to generate response:", error);
      const errorMessage: Message = {
        role: "assistant",
        content:
          "I apologize, but I encountered an error while processing your request. Please try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!ollamaStatus.running || !ollamaStatus.modelAvailable) {
    return (
      <div className="flex flex-col items-center justify-center bg-apple-notes p-8">
        <div className="fixed top-4 right-4 z-50">
          <div className="flex flex-col gap-2">
            {setupMessage && <Notification message={setupMessage} />}
          </div>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-md w-full"
        >
          {!ollamaStatus.running ? (
            <>
              <h1 className="text-2xl font-apple font-semibold text-center text-gray-900 mb-4 mt-4 px-1">
                Welcome to Notechat
              </h1>
              <motion.button
                onClick={handleSetupOllama}
                className="w-full px-6 py-4 bg-white text-gray-900 rounded-lg 
                font-apple text-lg font-medium shadow-md border border-gray-200 
                hover:border-gray-300 hover:shadow-md transition-all"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <motion.div
                  className="h-6 flex items-center cursor-pointer justify-center"
                  initial={false}
                >
                  <motion.div
                    key={isStarting ? "spinner" : "text"}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    {isStarting ? <Spinner /> : "Start Notechat"}
                  </motion.div>
                </motion.div>
              </motion.button>

              <motion.button
                onClick={() => setShowInfo(true)}
                className="w-full mt-2 px-6 py-3 bg-gray-50 text-gray-600 rounded-lg 
                font-apple text-base font-medium shadow-sm border border-gray-200 
                hover:border-gray-300 hover:shadow-md transition-all flex items-center cursor-pointer justify-center gap-2"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <InfoIcon className="w-5 h-5" />
                Learn More
              </motion.button>

              <img
                src={chatscreen}
                alt="Chat Screen"
                className="mt-2 h-auto rounded-lg shadow-lg border border-gray-200"
              />

              <InfoModal showInfo={showInfo} setShowInfo={setShowInfo} />
            </>
          ) : !ollamaStatus.modelAvailable ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full bg-white p-6 rounded-lg shadow-sm border border-gray-100"
            >
              <motion.div className="mb-4 flex justify-center">
                <Spinner />
              </motion.div>
              <p className="font-apple text-gray-800 text-center mb-2">
                Downloading {selectedModel}
              </p>
              <p className="font-apple text-sm text-gray-500 text-center">
                This may take a few minutes
              </p>
            </motion.div>
          ) : null}

          {ollamaStatus.error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 p-4 bg-white rounded-lg shadow-sm border border-red-100"
            >
              <p className="text-red-600 text-center font-apple text-sm">
                {ollamaStatus.error}
              </p>
            </motion.div>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-apple-notes">
      <div className="fixed top-4 right-4 z-50">
        <div className="flex flex-col gap-2">
          {setupMessage && <Notification message={setupMessage} />}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto h-[calc(100vh-180px)] pb-32 px-4">
        {messages.length === 0 ? (
          <EmptyChatState />
        ) : (
          <>
            {messages.map((message, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg font-apple mb-4 ${
                  message.role === "user"
                    ? "bg-white shadow-sm ml-auto max-w-[80%] border border-gray-100"
                    : "bg-white shadow-sm mr-auto max-w-[80%] border border-gray-100"
                } ${
                  index === 0 ? "mt-8" : ""
                } text-left break-words overflow-hidden`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {message.role === "assistant" && (
                    <img
                      src={logo}
                      alt="Apple Notes"
                      className="h-5 rounded flex-shrink-0"
                    />
                  )}
                  <div className="font-semibold text-sm text-gray-600">
                    {message.role === "user" ? "You" : "Apple Notes"}
                  </div>
                </div>
                <div className="mb-2 overflow-hidden">
                  <ReactMarkdown className="prose max-w-full break-words">
                    {message.content}
                  </ReactMarkdown>
                </div>
                {message.role === "assistant" && message.sources && (
                  <SourcesList sources={message.sources} />
                )}
              </div>
            ))}
            {currentResponse && (
              <div className="bg-white shadow-sm p-4 rounded-lg mr-auto max-w-[80%] border border-gray-100 font-apple text-left mb-4 break-words overflow-hidden">
                <div className="flex items-center gap-2 mb-1">
                  <img
                    src={logo}
                    alt="Apple Notes"
                    className="h-5 rounded flex-shrink-0"
                  />
                  <div className="font-semibold text-sm text-gray-600">
                    Your Apple Notes
                  </div>
                </div>
                <ReactMarkdown className="prose max-w-full break-words">
                  {currentResponse}
                </ReactMarkdown>
              </div>
            )}
            {isLoading && !currentResponse && <LoadingSkeleton />}
            <div ref={messagesRef} />
          </>
        )}
      </div>
      <div className="fixed bottom-0 left-0 right-0 bg-apple-notes">
        {messages.length === 0 && (
          <div className="flex flex-col gap-2 mb-4 px-4">
            <div className="max-w-2xl mx-auto w-full">
              {SUGGESTIONS.map((suggestion, index) => (
                <motion.button
                  key={index}
                  onClick={() => setInput(suggestion)}
                  className="w-full p-1 mb-2 bg-white rounded-lg border border-gray-200 
                      hover:border-gray-300 hover:shadow-sm transition-all text-left
                      font-apple text-gray-700"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <p className="ml-2">{suggestion}</p>
                </motion.button>
              ))}
            </div>
          </div>
        )}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.6,
            ease: "easeOut",
            delay: 0.2,
          }}
          className="p-4 bg-apple-notes border-t border-gray-200"
        >
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-end mb-2">
              <AnimatePresence>
                {messages.length > 0 && (
                  <motion.button
                    onClick={handleClearChat}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{
                      type: "spring",
                      stiffness: 200,
                      damping: 20,
                      mass: 0.8,
                      duration: 0.5,
                    }}
                    className="px-3 py-1.5 bg-white text-gray-700 rounded-lg 
          font-apple text-sm font-medium shadow-sm border border-gray-200 
          hover:border-gray-300 hover:shadow-md transition-all flex items-center gap-2"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m4-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                    Clear Chat
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
            <form onSubmit={handleSubmit} className="flex gap-2">
              <div className="relative">
                <motion.button
                  type="button"
                  onClick={() => setShowFolderSelect(!showFolderSelect)}
                  className="px-3 py-2 bg-white text-gray-700 rounded-lg 
    font-apple text-sm font-medium shadow-sm border border-gray-200 
    hover:border-gray-300 hover:shadow-md transition-all
    flex items-center gap-2 w-[140px]"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-gray-400 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                    />
                  </svg>
                  <span className="text-gray-600 truncate flex-1">
                    {selectedFolder}
                  </span>
                </motion.button>

                <AnimatePresence>
                  {showFolderSelect && (
                    <motion.div
                      initial={{ opacity: 0, y: -5, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -5, scale: 0.95 }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 25,
                      }}
                      className="absolute bottom-full mb-2 left-0 min-w-[200px]"
                    >
                      <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
                        {folders.map((folder, index) => (
                          <motion.button
                            key={folder}
                            onClick={() => {
                              setSelectedFolder(folder);
                              setShowFolderSelect(false);
                            }}
                            className={`w-full px-4 py-2 text-left font-apple text-sm
                  hover:bg-gray-50 transition-colors
                  ${selectedFolder === folder ? "bg-gray-50 font-medium" : ""}
                  ${index !== 0 ? "border-t border-gray-100" : ""}`}
                            whileHover={{ x: 2 }}
                            transition={{
                              type: "spring",
                              stiffness: 300,
                              damping: 20,
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className={`h-4 w-4 ${
                                  selectedFolder === folder
                                    ? "text-gray-800"
                                    : "text-gray-400"
                                }`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                                />
                              </svg>
                              {folder}
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 font-apple bg-white"
                disabled={isLoading}
              />
              <motion.button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 font-apple
                flex items-center justify-center gap-2 min-w-[80px]"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <SparkleIcon className="w-5 h-5" />{" "}
                  </div>
                ) : (
                  "Send"
                )}
              </motion.button>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
