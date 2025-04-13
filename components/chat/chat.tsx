"use client";

import { useState, useEffect } from "react";
import { Message } from "ai";
import { motion } from "framer-motion";
import { BrainCircuitIcon, GithubIcon, PanelRightOpen } from "lucide-react";

import { useScrollToBottom } from "@/lib/hooks/use-scroll-to-bottom";

import DownloadTxtButton from "./download-txt";
import { MultimodalInput } from "./input";
import { PreviewMessage, ProgressStep } from "./message";
import { ResearchProgress } from "./research-progress";
import { ErrorMessage } from '../ui/error-message';
import { PartialResultsMessage } from '../ui/partial-results-message';

export function Chat({
  id,
  initialMessages,
}: {
  id: string;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<ProgressStep[]>([]);
  const [containerRef, messagesEndRef] = useScrollToBottom<HTMLDivElement>();

  // New state to store the final report text
  const [finalReport, setFinalReport] = useState<string | null>(null);

  // States for interactive feedback workflow
  const [stage, setStage] = useState<"initial" | "feedback" | "researching">(
    "initial"
  );
  const [initialQuery, setInitialQuery] = useState("");

  // Add state for mobile progress panel visibility
  const [showProgress, setShowProgress] = useState(false);

  // New state to track if we're on mobile (using 768px as breakpoint for md)
  const [isMobile, setIsMobile] = useState<boolean>(false);
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Update the condition to only be true when there are actual research steps
  const hasStartedResearch =
    progress.filter(
      (step) =>
        // Only count non-report steps or initial report steps
        step.type !== "report" ||
        step.content.includes("Generating") ||
        step.content.includes("Synthesizing")
    ).length > 0;

  // Helper function to call the research endpoint
  const sendResearchQuery = async (
    query: string,
    config: { breadth: number; depth: number; modelId: string }
  ) => {
    try {
      setIsLoading(true);
      setProgress([]);
      // Inform the user that research has started
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: "Starting in-depth research based on your inputs...",
        },
      ]);

      const response = await fetch("/api/research", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream",
          "Cache-Control": "no-cache",
        },
        body: JSON.stringify({
          query,
          breadth: config.breadth,
          depth: config.depth,
          modelId: config.modelId,
        }),
      });

      // Check if the response is not ok (e.g., 4xx or 5xx status)
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error conducting research");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      const textDecoder = new TextDecoder();
      let buffer = "";
      const reportParts: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += textDecoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          if (part.startsWith("data: ")) {
            const jsonStr = part.substring(6).trim();
            if (!jsonStr) continue;
            try {
              const event = JSON.parse(jsonStr);
              if (event.type === "progress") {
                if (event.step.type !== "report") {
                  // Check for duplicates before adding this progress step.
                  setProgress((prev) => {
                    if (
                      prev.length > 0 &&
                      prev[prev.length - 1].content === event.step.content
                    ) {
                      return prev;
                    }
                    return [...prev, event.step];
                  });
                }
              } else if (event.type === "result") {
                // Save the final report so we can download it later
                setFinalReport(event.report);
                
                // Check if there's a note about using fallback model
                const content = event.note 
                  ? `<PartialResultsMessage message="${event.note}" />\n\n${event.report}`
                  : event.report;
                
                setMessages((prev) => [
                  ...prev,
                  {
                    id: Date.now().toString(),
                    role: "assistant",
                    content: content,
                  },
                ]);
              } else if (event.type === "report_part") {
                reportParts.push(event.content);
              }
            } catch (e) {
              console.error("Error parsing event:", e);
            }
          }
        }
      }

      if (reportParts.length > 0) {
        // In case the report was sent in parts
        const fullReport = reportParts.join("\n");
        setFinalReport(fullReport);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: fullReport,
          },
        ]);
      }
    } catch (error) {
      console.error("Research error:", error);
      
      // Check if the error is a rate limit error
      let errorMessage = "Sorry, there was an error conducting the research.";
      let suggestion = "Please try again or use a different model.";
      
      if (error instanceof Error) {
        const errorText = error.message.toLowerCase();
        if (errorText.includes("rate limit") || errorText.includes("tpm")) {
          errorMessage = "Rate limit reached.";
          suggestion = "Please try again in a moment or use a different model with higher rate limits.";
        }
      }
      
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: `<ErrorMessage message="${errorMessage}" suggestion="${suggestion}" />`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (
    userInput: string,
    config: { breadth: number; depth: number; modelId: string }
  ) => {
    if (!userInput.trim() || isLoading) return;

    // Add user message immediately
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: "user",
        content: userInput,
      },
    ]);

    setIsLoading(true);

    if (stage === "initial") {
      // Add thinking message only for initial query
      setMessages((prev) => [
        ...prev,
        {
          id: "thinking",
          role: "assistant",
          content: "Thinking...",
        },
      ]);

      // Handle the user's initial query
      setInitialQuery(userInput);

      try {
        const response = await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: userInput,
            numQuestions: 3,
            modelId: config.modelId,
          }),
        });
        
        // Check if the response is not ok
        if (!response.ok) {
          const errorData = await response.json();
          
          // Check if it's a rate limit error
          if (errorData.error?.includes("rate limit")) {
            throw new Error("Rate limit reached. Please try again in a moment or use a different model.");
          }
          
          throw new Error(errorData.error || "Error generating feedback questions");
        }
        
        const data = await response.json();
        const questions: string[] = data.questions || [];
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== "thinking");
          if (questions.length > 0) {
            const formattedQuestions = questions
              .map((q, index) => `${index + 1}. ${q}`)
              .join("\n\n");
            return [
              ...filtered,
              {
                id: Date.now().toString(),
                role: "assistant",
                content: `Please answer the following follow-up questions to help clarify your research:\n\n${formattedQuestions}`,
              },
            ];
          }
          return filtered;
        });
        setStage("feedback");
      } catch (error) {
        console.error("Feedback generation error:", error);
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== "thinking"),
          {
            id: Date.now().toString(),
            role: "assistant",
            content: `Sorry, there was an error generating feedback questions: ${error instanceof Error ? error.message : "Unknown error"}. You can try again with a different model.`,
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    } else if (stage === "feedback") {
      // In feedback stage, combine the initial query and follow-up answers
      const combined = `Initial Query: ${initialQuery}\nFollow-up Answers:\n${userInput}`;
      setStage("researching");
      try {
        await sendResearchQuery(combined, config);
      } catch (error) {
        console.error("Research error:", error);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: `Sorry, there was an error conducting the research: ${error instanceof Error ? error.message : "Unknown error"}. You can try again with a different model.`,
          },
        ]);
      } finally {
        setIsLoading(false);
        // Reset the stage so further messages will be processed
        setStage("initial");
        // Inform the user that a new research session can be started
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content:
              "Research session complete. You can now ask another question to begin a new research session.",
          },
        ]);
      }
    }
  };

  return (
    <div className="flex w-full h-full relative">
      {/* Main container with dynamic width */}
      <motion.div
        className={`mx-auto flex flex-col h-full pt-10 ${
          hasStartedResearch ? "md:mr-0" : "md:mx-auto"
        }`}
        initial={{ width: "100%", maxWidth: "800px" }}
        animate={{
          width: !isMobile && hasStartedResearch ? "55%" : "100%",
          maxWidth: !isMobile && hasStartedResearch ? "1000px" : "800px",
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        {/* Messages Container */}
        <div
          ref={containerRef}
          className={`${
            showProgress ? "hidden md:block" : "block"
          } flex-1 overflow-y-auto relative`}
        >
          {/* Welcome Message (if no research started and no messages) */}
          {!hasStartedResearch && messages.length === 0 && (
            <div className="flex-1 flex items-center justify-center p-4 md:p-8">
              <motion.div
                className="max-w-md mx-auto text-center"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
              >
                <div className="space-y-4">
                  <motion.div
                    animate={{
                      y: [-2, 2, -2],
                      rotate: [-1, 1, -1],
                    }}
                    transition={{
                      duration: 5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="relative"
                  >
                    <motion.div
                      animate={{
                        scale: [1, 1.05, 1],
                        opacity: [0.8, 1, 0.8],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      className="absolute inset-0 bg-gradient-to-r from-thron/20 to-thron/30 
                        blur-2xl rounded-full -z-10"
                    />
                    <BrainCircuitIcon className="w-12 h-12 mx-auto text-thron drop-shadow-[0_0_15px_rgba(44,170,222,0.3)]" />
                  </motion.div>

                  <div className="space-y-2">
                    <motion.h2
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="text-base md:text-2xl font-semibold bg-clip-text text-transparent 
                        bg-gradient-to-r from-thron via-thron/90 to-thron/80"
                    >
                     Thron AI assistant
                    </motion.h2>

                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="text-xs md:text-base text-muted-foreground/80 max-w-[340px] mx-auto leading-relaxed"
                    >
                      An deep  assistant alternative to OpenAI and Gemini's research capabilities. Ask any question to generate a comprehensive report.
                      
                    </motion.p>

                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="pt-2"
                    >
                      <a
                        href="https://github.com/Thron-Labs/thronai"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-2 py-1 md:px-6 md:py-2.5 text-xs md:text-sm font-medium 
                          bg-gradient-to-r from-thron/10 to-thron/5 hover:from-thron/15 hover:to-thron/10
                          text-thron hover:text-thron/90 rounded-full transition-all duration-300
                          shadow-[0_0_0_1px_rgba(44,170,222,0.1)] hover:shadow-[0_0_0_1px_rgba(44,170,222,0.2)]
                          hover:scale-[1.02]"
                      >
                        <GithubIcon className="w-4 h-4 mr-1" />
                        View source code
                      </a>
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* Messages */}
          <div className="p-4 md:p-6 space-y-6">
            {messages.map((message) => (
              <PreviewMessage key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} className="h-4" />
            {finalReport && (
              <div className="mt-4">
                <DownloadTxtButton reportText={finalReport} />
              </div>
            )}
          </div>
        </div>

        {/* Input - Fixed to bottom */}
        <div className="sticky bottom-0">
          <div className="p-4 md:p-6 mx-auto">
            <MultimodalInput
              onSubmit={handleSubmit}
              isLoading={isLoading}
              placeholder={
                stage === "initial"
                  ? "What would you like to research?"
                  : stage === "feedback"
                  ? "Please provide your answers to the follow-up questions..."
                  : "Research in progress..."
              }
            />
          </div>
        </div>
      </motion.div>

      {/* Research Progress Panel */}
      <motion.div
        className={`
          pt-10 fixed md:relative
          inset-0 md:inset-auto
          bg-background md:bg-transparent
          md:w-[45%]
          ${showProgress ? "flex" : "hidden md:flex"}
          ${hasStartedResearch ? "md:flex" : "md:hidden"}
        `}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
      >
        <ResearchProgress progress={progress} isLoading={isLoading} />
      </motion.div>

      {/* Mobile Toggle Button - Only show when research has started */}
      {hasStartedResearch && (
        <button
          onClick={() => setShowProgress(!showProgress)}
          className={`
            md:hidden
            fixed
            bottom-24
            right-4
            z-50
            p-3
            bg-thron
            text-white
            rounded-full
            shadow-lg
            transition-transform
            ${showProgress ? "rotate-180" : ""}
          `}
          aria-label="Toggle research progress"
        >
          <PanelRightOpen className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
