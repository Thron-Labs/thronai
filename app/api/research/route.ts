import { NextRequest } from "next/server";

import {
  deepResearch,
  generateFeedback,
  writeFinalReport,
} from "@/lib/deep-research";
import { createModel, type AIModel } from "@/lib/deep-research/ai/providers";

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
  return "An error occurred during research. Please try again or use a different model.";
}

export async function POST(req: NextRequest) {
  try {
    const {
      query,
      breadth = 3,
      depth = 2,
      modelId = "gpt-4o",
    } = await req.json();

    // Retrieve API keys from secure cookies
    const openaiKey = req.cookies.get("openai-key")?.value;
    const firecrawlKey = req.cookies.get("firecrawl-key")?.value;

    // Add API key validation
    if (process.env.NEXT_PUBLIC_ENABLE_API_KEYS === "true") {
      if (!openaiKey || !firecrawlKey) {
        return Response.json(
          { error: "API keys are required but not provided" },
          { status: 401 }
        );
      }
    }

    console.log("\n🔬 [RESEARCH ROUTE] === Request Started ===");
    console.log("Query:", query);
    console.log("Model ID:", modelId);
    console.log("Configuration:", {
      breadth,
      depth,
    });
    console.log("API Keys Present:", {
      OpenAI: openaiKey ? "✅" : "❌",
      FireCrawl: firecrawlKey ? "✅" : "❌",
    });

    try {
      const model = createModel(modelId as AIModel, openaiKey);
      console.log("\n🤖 [RESEARCH ROUTE] === Model Created ===");
      console.log("Using Model:", modelId);

      const encoder = new TextEncoder();
      const stream = new TransformStream();
      const writer = stream.writable.getWriter();

      (async () => {
        try {
          console.log("\n🚀 [RESEARCH ROUTE] === Research Started ===");

          const feedbackQuestions = await generateFeedback({ query });
          await writer.write(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "progress",
                step: {
                  type: "query",
                  content: "Generated feedback questions",
                },
              })}\n\n`
            )
          );

          try {
            const { learnings, visitedUrls } = await deepResearch({
              query,
              breadth,
              depth,
              model,
              firecrawlKey,
              onProgress: async (update: string) => {
                console.log("\n📊 [RESEARCH ROUTE] Progress Update:", update);
                await writer.write(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "progress",
                      step: {
                        type: "research",
                        content: update,
                      },
                    })}\n\n`
                  )
                );
              },
            });

            console.log("\n✅ [RESEARCH ROUTE] === Research Completed ===");
            console.log("Learnings Count:", learnings.length);
            console.log("Visited URLs Count:", visitedUrls.length);

            // If we have at least some learnings, generate a report
            if (learnings.length > 0) {
              const report = await writeFinalReport({
                prompt: query,
                learnings,
                visitedUrls,
                model,
              });

              await writer.write(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "result",
                    feedbackQuestions,
                    learnings,
                    visitedUrls,
                    report,
                  })}\n\n`
                )
              );
            } else {
              // No learnings were gathered
              throw new Error("Unable to gather research results. Please try again with a different query or model.");
            }
          } catch (researchError) {
            // Check if it's a rate limit error
            const errorStr = String(researchError);
            if (
              errorStr.includes('rate_limit_exceeded') || 
              errorStr.includes('tokens per min') || 
              errorStr.includes('TPM') ||
              errorStr.includes('AI_RetryError')
            ) {
              // Try with a smaller model as fallback
              await writer.write(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "progress",
                    step: {
                      type: "research",
                      content: "Rate limit reached with primary model. Trying with a smaller model...",
                    },
                  })}\n\n`
                )
              );
              
              const fallbackModel = createModel('gpt-3.5-turbo', openaiKey);
              const { learnings, visitedUrls } = await deepResearch({
                query,
                breadth: Math.max(breadth - 1, 1), // Reduce breadth for fallback
                depth: Math.max(depth - 1, 1),     // Reduce depth for fallback
                model: fallbackModel,
                firecrawlKey,
                onProgress: async (update: string) => {
                  console.log("\n📊 [RESEARCH ROUTE] Fallback Progress Update:", update);
                  await writer.write(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "progress",
                        step: {
                          type: "research",
                          content: update,
                        },
                      })}\n\n`
                    )
                  );
                },
              });
              
              if (learnings.length > 0) {
                const report = await writeFinalReport({
                  prompt: query,
                  learnings,
                  visitedUrls,
                  model: fallbackModel,
                });

                await writer.write(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "result",
                      feedbackQuestions,
                      learnings,
                      visitedUrls,
                      report,
                      note: "Research was completed with a fallback model due to rate limits."
                    })}\n\n`
                  )
                );
              } else {
                throw new Error("Unable to complete research even with fallback model.");
              }
            } else {
              throw researchError; // Re-throw if it's not a rate limit error
            }
          }
        } catch (error) {
          console.error("\n❌ [RESEARCH ROUTE] === Research Process Error ===");
          
          // Only log the full error details in development
          if (process.env.NODE_ENV === 'development') {
            console.error("Detailed error:", error);
          } else {
            console.error("Error type:", error instanceof Error ? error.constructor.name : typeof error);
          }
          
          // Try to recover with a fallback approach
          try {
            await writer.write(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "progress",
                  step: {
                    type: "research",
                    content: "Encountered an issue. Attempting to continue with limited results...",
                  },
                })}\n\n`
              )
            );
            
            // Generate a simple report even if research failed
            const fallbackReport = `# Research Report on ${query}

## Summary
The research system encountered technical limitations while processing your query "${query}". 

## Key Points
- The query may be too complex or broad for the current system capabilities
- Consider breaking your research into smaller, more focused queries
- Try using a different model or reducing the breadth/depth parameters

## Recommendations
1. Try a more specific query
2. Use the gpt-3.5-turbo model which has higher rate limits
3. Reduce the breadth parameter to 2 and depth to 1

We apologize for the inconvenience and are continuously working to improve our research capabilities.`;

            await writer.write(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "result",
                  feedbackQuestions: [],
                  learnings: [],
                  visitedUrls: [],
                  report: fallbackReport,
                  note: "Research could not be completed due to technical limitations. This is a fallback report."
                })}\n\n`
              )
            );
          } catch (fallbackError) {
            // If even the fallback fails, send a sanitized error message
            const sanitizedMessage = sanitizeErrorMessage(error);
            
            await writer.write(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "error",
                  message: sanitizedMessage,
                })}\n\n`
              )
            );
          }
        } finally {
          await writer.close();
        }
      })();

      return new Response(stream.readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
          "X-Accel-Buffering": "no", // Prevents buffering for Nginx
          "Accept-Ranges": "none", // Explicitly disable range requests
        },
      });
    } catch (error) {
      console.error("\n💥 [RESEARCH ROUTE] === Route Error ===");
      console.error("Error:", error);
      
      // Sanitize the error message
      const sanitizedMessage = sanitizeErrorMessage(error);
      
      return Response.json({ error: sanitizedMessage }, { status: 500 });
    }
  } catch (error) {
    console.error("\n💥 [RESEARCH ROUTE] === Parse Error ===");
    console.error("Error:", error);
    return Response.json({ 
      error: "Could not process your research request. Please check your input and try again." 
    }, { status: 400 });
  }
}
