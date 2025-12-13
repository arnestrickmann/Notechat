import { useState, useEffect } from "react";
import Header, { ChatMode } from "./components/Header";
import "./App.css";
import Chat from "./components/Chat";
import Notification from "./components/Notification";
import FeedbackModal from "./components/FeedbackModal";
import ExtractionProgress from "./components/ExtractionProgress";

function App() {
  const [mode, setMode] = useState<ChatMode>("local");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionMessage, setExtractionMessage] = useState<string>("");
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [progressEvent, setProgressEvent] = useState<any>(null);

  const handleExtractNotes = async () => {
    setIsExtracting(true);
    setProgressEvent(null);
    try {
      let count = await window.electron.countNotes();
      if (count > 0) {
        setExtractionMessage(
          `Adding ${count} Notes to knowledgebase, this might take a couple of minutes...`
        );
        
        // Set up progress listener
        const removeProgressListener = window.electron.onExtractionProgress((event) => {
          setProgressEvent(event);
          
          if (event.type === 'complete') {
            setLastUpdateTime(new Date());
            setExtractionMessage("Successfully added notes to knowledgebase!");
            setTimeout(() => {
              setProgressEvent(null);
              setIsExtracting(false);
            }, 3000);
          } else if (event.type === 'error') {
            setExtractionMessage("Failed to extract notes. Please try again.");
            setTimeout(() => {
              setProgressEvent(null);
              setIsExtracting(false);
            }, 5000);
          }
        });
        
        await window.electron.extractAndEmbedNotes();
        removeProgressListener();
      } else {
        setExtractionMessage("No notes found to add to knowledgebase.");
        setIsExtracting(false);
      }
    } catch (error) {
      console.error("Failed to extract notes:", error);
      setExtractionMessage("Failed to extract notes. Please try again.");
      setProgressEvent(null);
      setIsExtracting(false);
    }
  };

  // receiving the setup status from chat component to not render the connect to apple notes button
  const handleSetupComplete = (status: boolean) => {
    setIsSetupComplete(status);
  }

  // Clean up progress event on unmount
  useEffect(() => {
    return () => {
      if (progressEvent?.type === 'complete' || progressEvent?.type === 'error') {
        setProgressEvent(null);
      }
    };
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-apple-notes">
      <Header 
        mode={mode} 
        onModeChange={setMode}
        onExtractNotes={handleExtractNotes}
        isExtracting={isExtracting}
        showExtractButton={isSetupComplete}
        lastUpdateTime={lastUpdateTime}
        showFeedback={showFeedback} 
        setShowFeedback={setShowFeedback}
     />
      <main className="flex-1 relative bg-apple-notes pt-[88px]">
        <Chat onSetupComplete={handleSetupComplete} />
      </main>
      {extractionMessage && !progressEvent && (
        <div className="fixed top-4 right-4 z-50">
          <Notification message={extractionMessage} />
        </div>
      )}
      <ExtractionProgress event={progressEvent} isVisible={isExtracting} />
      <FeedbackModal 
        showFeedback={showFeedback}
        setShowFeedback={setShowFeedback}
      />
    </div>
  );
}

export default App;