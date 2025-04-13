"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import cx from "classnames";
import { motion } from "framer-motion";
import {
  ArrowUpIcon,
  CheckCircleIcon,
  ChevronDown,
  DownloadIcon,
  Settings2,
  XCircleIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  availableModels,
  type AIModelDisplayInfo,
} from "@/lib/deep-research/ai/providers";
import { ApiKeyDialog } from "@/components/chat/api-key-dialog";

interface MultimodalInputProps {
  onSubmit: (
    input: string,
    config: {
      breadth: number;
      depth: number;
      modelId: string;
    }
  ) => void;
  isLoading: boolean;
  placeholder?: string;
  onDownload?: () => void;
  canDownload?: boolean;
}

export function MultimodalInput({
  onSubmit,
  isLoading,
  placeholder = "What would you like to research?",
  onDownload,
  canDownload = false,
}: MultimodalInputProps) {
  // Use state for input value
  const [input, setInput] = useState("");
  const [breadth, setBreadth] = useState(3);
  const [depth, setDepth] = useState(2);
  const [modelId, setModelId] = useState("gpt-4o");
  const [showModelSelector, setShowModelSelector] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // State for API key dialog
  const [showApiKeyPrompt, setShowApiKeyPrompt] = useState(false);
  const [hasKeys, setHasKeys] = useState(false);
  
  // Check if API keys are enabled
  const enableApiKeys = process.env.NEXT_PUBLIC_ENABLE_API_KEYS === 'true';

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 300)}px`;
    }
  }, [input]);

  // Check for API keys on mount
  useEffect(() => {
    if (enableApiKeys) {
      const checkApiKeys = async () => {
        try {
          const res = await fetch("/api/keys/check");
          if (res.ok) {
            const data = await res.json();
            setHasKeys(data.hasKeys);
            setShowApiKeyPrompt(!data.hasKeys);
          }
        } catch (error) {
          console.error("Failed to check API keys:", error);
        }
      };
      
      checkApiKeys();
    }
  }, [enableApiKeys]);

  const handleSubmit = () => {
    if (!input.trim() || isLoading) return;
    
    // If API keys are enabled and we don't have them, show the prompt
    if (enableApiKeys && !hasKeys) {
      setShowApiKeyPrompt(true);
      return;
    }
    
    onSubmit(input, { breadth, depth, modelId });
    setInput("");
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const DownloadButton = () => (
    <Button
      variant="outline"
      size="sm"
      onClick={onDownload}
      className="bg-primary/5 hover:bg-primary/10 border-primary/20 hover:border-primary/30 transition-colors"
    >
      <DownloadIcon className="h-4 w-4 mr-1.5" />
      <span className="text-xs font-medium">Download Report</span>
    </Button>
  );

  // Add a tooltip/hint about rate limits
  const [showRateLimitHint, setShowRateLimitHint] = useState(false);

  // Update the model tooltip to include structured output support info
  const modelTooltip = (model: AIModelDisplayInfo) => {
    return (
      <div className="text-xs text-muted-foreground">
        {model.tokensPerMinute ? `Rate limit: ${model.tokensPerMinute / 1000}K TPM` : ''}
        {model.id === 'gpt-3.5-turbo' && ' (Fastest)'}
        {model.supportsStructuredOutput === false && ' (Limited features)'}
      </div>
    );
  };

  return (
    <div
      className="relative flex items-center w-full rounded-lg border border-zinc-700 bg-zinc-800/70 backdrop-blur-sm shadow-sm focus-within:border-thron/50 focus-within:ring-1 focus-within:ring-thron/30 transition-all duration-200"
    >
      {/* Conditionally render API key dialog only if enabled */}
      {enableApiKeys && (
        <ApiKeyDialog
          show={showApiKeyPrompt}
          onClose={setShowApiKeyPrompt}
          onSuccess={() => {
            setShowApiKeyPrompt(false);
            setHasKeys(true);
          }}
        />
      )}

      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        placeholder={placeholder}
        disabled={isLoading}
        className="flex-1 max-h-[calc(100dvh)] min-h-[72px] w-full resize-none bg-transparent px-4 py-3.5 text-sm text-white placeholder:text-zinc-400 focus:outline-none disabled:opacity-70"
        style={{ scrollbarWidth: "none" }}
      />

      {/* Model Selector */}
      <div className="absolute bottom-3 left-4 flex items-center gap-2 text-xs text-zinc-400">
        {/* Only show when input is empty */}
        {!input.trim() && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">
              Breadth: {breadth}
            </span>
            <Slider
              value={[breadth]}
              min={1}
              max={5}
              step={1}
              className="w-24"
              onValueChange={([value]) => setBreadth(value)}
            />
          </div>
        )}

        {!input.trim() && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">
              Depth: {depth}
            </span>
            <Slider
              value={[depth]}
              min={1}
              max={5}
              step={1}
              className="w-24"
              onValueChange={([value]) => setDepth(value)}
            />
          </div>
        )}
      </div>

      {/* Submit Button */}
      <Button
        className="rounded-full p-2 h-fit absolute bottom-3 right-3 m-0.5 border border-zinc-600 bg-zinc-700 hover:bg-zinc-600"
        onClick={handleSubmit}
        disabled={!input.trim() || isLoading}
      >
        {isLoading ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Settings2 className="h-5 w-5 text-zinc-300" />
          </motion.div>
        ) : (
          <ArrowUpIcon className="h-5 w-5 text-zinc-300" />
        )}
      </Button>
    </div>
  );
}
