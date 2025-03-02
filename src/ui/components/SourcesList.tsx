import { motion } from "framer-motion";

interface SourcesListProps {
  sources: {
    noteTitle: string;
    noteUpdated: string;
    chunkContent: string;
  }[];
}

export default function SourcesList({ sources }: SourcesListProps) {
  if (!sources || sources.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mt-3 flex flex-wrap gap-2"
    >
      {sources.map((source, index) => (
        <motion.div
          key={index}
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          className="inline-flex items-center px-2.5 py-1.5 rounded-full text-xs 
                   bg-gray-100 text-gray-700 transition-colors
                   border border-gray-200 group"
          title={source.chunkContent}
        >
          <span className="font-medium">📝 {source.noteTitle}</span>
          <span className="mx-1.5 text-gray-400">•</span>
          <span className="text-gray-500">
            {new Date(source.noteUpdated).toLocaleDateString()}
          </span>
        </motion.div>
      ))}
    </motion.div>
  );
}
