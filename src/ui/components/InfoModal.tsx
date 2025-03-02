import { motion } from "framer-motion";
import homebrew from "../assets/homebrew.png";
import ollama from "../assets/ollama.png";
import meta from "../assets/meta.png";

interface InfoModalProps {
  showInfo: boolean;
  setShowInfo: (show: boolean) => void;
}

export default function InfoModal({ showInfo, setShowInfo }: InfoModalProps) {
  if (!showInfo) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={() => setShowInfo(false)}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-apple-notes rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-apple font-semibold">Information</h2>
          <button
            onClick={() => setShowInfo(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-gray-700 text-left font-apple">
            As the app and the model is intended to run locally on your device,
            we need to make some preparations. We will install the following
            components for you automatically when you start the chat.
          </p>

          <div className="space-y-4">
            <div className="bg-gray-50 p-4 shadow-md border border-gray-200 rounded-lg">
              <a
                href="https://brew.sh"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 font-medium font-apple flex items-center gap-2"
              >
                Homebrew <img src={homebrew} alt="Homebrew" className="w-5" />
              </a>
              <p className="text-sm text-gray-600 text-left mt-1 font-apple">
                The missing package manager for macOS. Helps install and manage
                software packages.
              </p>
            </div>

            <div className="bg-gray-50 p-4 shadow-md border border-gray-200 rounded-lg">
              <a
                href="https://ollama.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 font-medium font-apple flex items-center gap-2"
              >
                Ollama <img src={ollama} alt="Ollama" className="w-5" />
              </a>
              <p className="text-sm text-gray-600 text-left mt-1 font-apple">
                Run large language models locally on your machine. Fast, secure,
                and private.
              </p>
            </div>

            <div className="bg-gray-50 p-4 shadow-md border border-gray-200 rounded-lg">
              <a
                href="https://ollama.ai/library/llama3"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 font-medium font-apple flex items-center gap-2"
              >
                Llama 3.2:3b{" "}
                <img src={meta} alt="Llama 3.2:3b" className="h-10" />
              </a>
              <p className="text-sm text-gray-600 text-left mt-1 font-apple">
                A lightweight but powerful open-source language model. Perfect
                balance of performance and resource usage.
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-1 text-left font-apple">
            We are working on a cloud version of Notechat, so you don't need to
            install anything to chat with your Apple Notes.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
