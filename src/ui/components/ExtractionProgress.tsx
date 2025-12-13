import React from 'react';

interface ProgressEvent {
  type: 'start' | 'progress' | 'note' | 'chunk' | 'complete' | 'error';
  totalNotes?: number;
  processedNotes?: number;
  totalChunks?: number;
  processedChunks?: number;
  currentNoteTitle?: string;
  currentChunkIndex?: number;
  message?: string;
  error?: string;
}

interface ExtractionProgressProps {
  event: ProgressEvent | null;
  isVisible: boolean;
}

const ExtractionProgress: React.FC<ExtractionProgressProps> = ({ event, isVisible }) => {
  if (!isVisible || !event) return null;

  const getProgressPercentage = () => {
    if (event.type === 'complete') return 100;
    if (event.totalNotes && event.processedNotes) {
      return Math.round((event.processedNotes / event.totalNotes) * 100);
    }
    return 0;
  };

  const getStatusColor = () => {
    switch (event.type) {
      case 'error':
        return 'bg-red-500';
      case 'complete':
        return 'bg-green-500';
      default:
        return 'bg-blue-500';
    }
  };

  const getStatusIcon = () => {
    switch (event.type) {
      case 'error':
        return '❌';
      case 'complete':
        return '✅';
      case 'start':
        return '🚀';
      case 'note':
        return '📝';
      case 'chunk':
        return '🔧';
      default:
        return '⏳';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 bg-white rounded-lg shadow-lg p-4 min-w-[320px] max-w-[400px]">
      <div className="flex items-center mb-2">
        <span className="text-lg mr-2">{getStatusIcon()}</span>
        <h3 className="font-semibold text-gray-800">
          {event.type === 'start' && 'Starting Extraction'}
          {event.type === 'note' && 'Processing Notes'}
          {event.type === 'chunk' && 'Processing Chunks'}
          {event.type === 'complete' && 'Extraction Complete'}
          {event.type === 'error' && 'Extraction Error'}
        </h3>
      </div>

      {/* Progress Bar */}
      {(event.type === 'note' || event.type === 'chunk' || event.type === 'complete') && (
        <div className="mb-3">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`${getStatusColor()} h-2 rounded-full transition-all duration-300`}
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
          <div className="text-xs text-gray-600 mt-1">
            {event.processedNotes && event.totalNotes && (
              <span>Notes: {event.processedNotes}/{event.totalNotes}</span>
            )}
            {event.processedChunks && event.totalChunks && (
              <span className="ml-2">Chunks: {event.processedChunks}/{event.totalChunks}</span>
            )}
          </div>
        </div>
      )}

      {/* Current Item */}
      {event.currentNoteTitle && (
        <div className="text-sm text-gray-700 mb-2">
          <span className="font-medium">Current:</span> {event.currentNoteTitle}
          {event.currentChunkIndex && event.totalChunks && (
            <span className="text-gray-500">
              {' '} (Chunk {event.currentChunkIndex}/{event.totalChunks})
            </span>
          )}
        </div>
      )}

      {/* Message */}
      {event.message && (
        <div className="text-sm text-gray-600 mb-2">
          {event.message}
        </div>
      )}

      {/* Error */}
      {event.error && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
          {event.error}
        </div>
      )}
    </div>
  );
};

export default ExtractionProgress;