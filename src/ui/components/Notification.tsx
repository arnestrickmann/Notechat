import { motion } from "framer-motion";
import InfoIcon from "./InfoIcon";

interface NotificationProps {
  message: string;
}

export default function Notification({ message }: NotificationProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="p-4 rounded-lg mt-20 shadow-sm border border-blue-100 bg-white font-apple text-sm"
    >
      <div className="flex items-center gap-2">
        <InfoIcon className="w-5 h-5 text-gray-500" />
        <span className="text-gray-700">{message}</span>
      </div>
    </motion.div>
  );
}
