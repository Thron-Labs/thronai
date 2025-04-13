import { NextRequest, NextResponse } from "next/server";

import { AIModel } from "@/lib/deep-research/ai/providers";
import { generateFeedback } from "@/lib/deep-research/feedback";

// Helper function to sanitize error messages
function sanitizeErrorMessage(error: any): string {
  // Check if it's a rate limit error
  const errorMessage = error?.toString() || String(error);
  
  if (
    errorMessage.includes("rate_limit_exceeded") || 
    errorMessage.includes("tokens per min") ||
    errorMessage.includes("TPM")
  ) {
    return "Rate limit exceeded. Please try again in a moment or use a different model with higher rate limits.";
  }
  
  // Generic error message that doesn't expose sensitive information
  return "An error occurred. Please try again or use a different model.";
}

export async function POST(req: NextRequest) {
  try {
    const { query, numQuestions, modelId = "gpt-4o" } = await req.json();

    // Retrieve API key(s) from secure cookies
    const openaiKey = req.cookies.get("openai-key")?.value;
    const firecrawlKey = req.cookies.get("firecrawl-key")?.value;

    // Add API key validation
    if (process.env.NEXT_PUBLIC_ENABLE_API_KEYS === "true") {
      if (!openaiKey || !firecrawlKey) {
        return NextResponse.json(
          { error: "API keys are required but not provided" },
          { status: 401 }
        );
      }
    }

    console.log("\n🔍 [FEEDBACK ROUTE] === Request Started ===");
    console.log("Query:", query);
    console.log("Model ID:", modelId);
    console.log("Number of Questions:", numQuestions);
    console.log("API Keys Present:", {
      OpenAI: openaiKey ? "✅" : "❌",
      FireCrawl: firecrawlKey ? "✅" : "❌",
    });

    try {
      if (!query || typeof query !== 'string' || !query.trim()) {
        return NextResponse.json({ 
          questions: [
            "What topic would you like to research?",
            "What specific aspects are you interested in?",
            "What is your goal for this research?"
          ].slice(0, numQuestions || 3)
        });
      }

      const questions = await generateFeedback({
        query,
        numQuestions,
        modelId: modelId as AIModel,
        apiKey: openaiKey,
      });

      console.log("\n✅ [FEEDBACK ROUTE] === Success ===");
      console.log("Generated Questions:", questions);
      console.log("Number of Questions Generated:", questions.length);

      return NextResponse.json({ questions });
    } catch (error) {
      console.error("\n❌ [FEEDBACK ROUTE] === Generation Error ===");
      console.error("Error:", error);
      
      // Sanitize the error message
      const sanitizedMessage = sanitizeErrorMessage(error);
      
      // Return default questions on error
      return NextResponse.json({ 
        questions: [
          `What specific aspects of ${query} are you most interested in?`,
          `What is your goal for researching ${query}?`,
          `Do you have any specific requirements or constraints for this research?`
        ].slice(0, numQuestions || 3),
        error: sanitizedMessage
      });
    }
  } catch (error) {
    console.error("\n💥 [FEEDBACK ROUTE] === Route Error ===");
    console.error("Error:", error);

    return NextResponse.json(
      {
        error: "Could not generate feedback questions",
        questions: [
          "What topic would you like to research?",
          "What specific aspects are you interested in?",
          "What is your goal for this research?"
        ]
      },
      { status: 500 }
    );
  }
}
