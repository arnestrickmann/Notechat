import { useState } from "react";
import Header, { ChatMode } from "./components/Header";
import "./App.css";
import Chat from "./components/Chat";
import Notification from "./components/Notification";
import FeedbackModal from "./components/FeedbackModal";

function App() {
  const [mode, setMode] = useState<ChatMode>("local");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionMessage, setExtractionMessage] = useState<string>("");
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const handleExtractNotes = async () => {
    setIsExtracting(true);
    try {
      let count = await window.electron.countNotes();
      if (count > 0) {
        setExtractionMessage(
          `Adding ${count} Notes to knowledgebase, this might take a couple of minutes...`
        );
        await window.electron.extractAndEmbedNotes();
        setLastUpdateTime(new Date());
        setExtractionMessage("Successfully added notes to knowledgebase!");
      } else {
        setExtractionMessage("No notes found to add to knowledgebase.");
      }
    } catch (error) {
      console.error("Failed to extract notes:", error);
      setExtractionMessage("Failed to extract notes. Please try again.");
    } finally {
      setIsExtracting(false);
      setTimeout(() => setExtractionMessage(""), 3000);
    }
  };

  // receiving the setup status from chat component to not render the connect to apple notes button
  const handleSetupComplete = (status: boolean) => {
    setIsSetupComplete(status);
  }

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
      {extractionMessage && (
        <div className="fixed top-4 right-4 z-50">
          <Notification message={extractionMessage} />
        </div>
      )}
      <FeedbackModal 
        showFeedback={showFeedback}
        setShowFeedback={setShowFeedback}
      />
    </div>
  );
}

export default App;