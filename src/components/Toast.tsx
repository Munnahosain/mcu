"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check, AlertCircle, Info, X } from "lucide-react";
import { useEffect, useState } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastProps {
  message: ToastMessage;
  onClose: (id: string) => void;
}

const Toast = ({ message, onClose }: ToastProps) => {
  useEffect(() => {
    const duration = message.duration || 4000;
    const timer = setTimeout(() => onClose(message.id), duration);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  const colors = {
    success: { bg: "bg-green-500/10", border: "border-green-500/30", text: "text-green-700 dark:text-green-400" },
    error: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-700 dark:text-red-400" },
    info: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-700 dark:text-blue-400" },
    warning: { bg: "bg-yellow-500/10", border: "border-yellow-500/30", text: "text-yellow-700 dark:text-yellow-400" },
  };

  const icons = {
    success: <Check className="w-5 h-5 text-green-500" />,
    error: <AlertCircle className="w-5 h-5 text-red-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
    warning: <AlertCircle className="w-5 h-5 text-yellow-500" />,
  };

  const color = colors[message.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, x: 100 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, y: -20, x: 100 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className={`${color.bg} ${color.border} border backdrop-blur-sm rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg`}
    >
      <div className="shrink-0">{icons[message.type]}</div>
      <p className={`text-sm font-semibold ${color.text}`}>{message.message}</p>
      <button onClick={() => onClose(message.id)} className="ml-auto shrink-0">
        <X className="w-4 h-4 opacity-50 hover:opacity-100" />
      </button>
    </motion.div>
  );
};

export interface ToastContainerProps {
  messages: ToastMessage[];
  onClose: (id: string) => void;
}

export const ToastContainer = ({ messages, onClose }: ToastContainerProps) => {
  return (
    <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm">
      <AnimatePresence>
        {messages.map((msg) => (
          <Toast key={msg.id} message={msg} onClose={onClose} />
        ))}
      </AnimatePresence>
    </div>
  );
};

// Hook to use toast notifications
export const useToast = () => {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const addToast = (message: string, type: ToastType = "info", duration?: number) => {
    const id = crypto.randomUUID();
    setMessages((prev) => [...prev, { id, message, type, duration }]);
  };

  const removeToast = (id: string) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== id));
  };

  return { messages, addToast, removeToast };
};
