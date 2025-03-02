import { motion } from "framer-motion";
import logo from "../assets/logo.png";
import Spinner from "./Spinner";
import applenotes from "../assets/applenotes.png";
import { useEffect, useState } from "react";
import FeedbackModal from "./FeedbackModal";

export type ChatMode = "local" | "cloud";

interface HeaderProps {
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  onExtractNotes: () => Promise<void>;
  isExtracting: boolean;
  showExtractButton: boolean;
  lastUpdateTime: Date | null;
  showFeedback: boolean;
  setShowFeedback: (show: boolean) => void;
}

export default function Header({
  onExtractNotes,
  isExtracting,
  showExtractButton,
  lastUpdateTime,
}: HeaderProps) {
  const [hasExtracted, setHasExtracted] = useState(!!lastUpdateTime);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const notesCount = await window.electron.getNotesInDb();
        setIsConnected(notesCount > 0);
        if (notesCount > 0 && !hasExtracted) {
          setHasExtracted(true);
        }
      } catch (error) {
        console.error("Failed to check notes connection:", error);
      }
    };

    checkConnection();
  }, []);

  const handleClick = async () => {
    await onExtractNotes();
    setHasExtracted(true);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.6,
          ease: "easeOut",
          delay: 0.2,
        }}
        className="fixed top-0 left-0 right-0 z-50 bg-apple-notes border-b border-gray-200"
      >
        <div className="titlebar-drag-region"></div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="max-w-7xl mx-auto py-6 px-4 flex mt-4 flex-row justify-between items-center"
        >
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="flex flex-row gap-2 items-center"
          >
            <img src={logo} alt="Notechat" className="w-10" />
            <h1 className="text-2xl font-apple font-bold">Notechat</h1>
          </motion.div>

          <div className="flex items-center gap-4">
            {(lastUpdateTime || (isConnected && showExtractButton)) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 text-sm text-gray-500 font-apple"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-green-500"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>

                <span>
                  {lastUpdateTime
                    ? `Updated ${formatDate(lastUpdateTime)}`
                    : "Connected to Apple Notes"}
                </span>
              </motion.div>
            )}

            {showExtractButton && (
              <motion.button
                onClick={handleClick}
                disabled={isExtracting}
                className="bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200 font-apple text-sm
            flex items-center gap-2 hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50 cursor-pointer"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                {isExtracting ? (
                  <>
                    Refreshing... <Spinner />
                  </>
                ) : isConnected ? (
                  <>
                    Refresh Connection
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                      />
                    </svg>
                    <img
                      src={applenotes}
                      alt="Apple Notes"
                      className="w-5 h-5 border border-gray-200 rounded-md shadow-md"
                    />
                  </>
                ) : (
                  <>
                    Connect to Apple Notes
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
                      />
                    </svg>
                    <img
                      src={applenotes}
                      alt="Apple Notes"
                      className="w-5 h-5 border border-gray-200 rounded-md shadow-md"
                    />
                  </>
                )}
              </motion.button>
            )}

            <motion.button
              onClick={() => setShowFeedback(true)}
              className="bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200 font-apple text-sm
        flex items-center gap-2 hover:bg-gray-50 transition-colors duration-200"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
                />
              </svg>
              Feedback
            </motion.button>
          </div>
        </motion.div>
      </motion.header>
      <FeedbackModal
        showFeedback={showFeedback}
        setShowFeedback={setShowFeedback}
      />
    </>
  );
}
