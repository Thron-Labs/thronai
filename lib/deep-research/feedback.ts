import { generateObject, generateText } from 'ai';
import { z } from 'zod';

import { createModel, type AIModel, withRateLimitRetry, AI_MODEL_DISPLAY } from './ai/providers';
import { systemPrompt } from './prompt';

// Helper function to parse questions from text
function parseQuestionsFromText(text: string, numQuestions: number): string[] {
  // First try to find numbered questions
  const lines = text.split('\n').filter(line => line.trim());
  const questions = lines
    .filter(line => /^\d+\./.test(line.trim()))
    .map(line => line.replace(/^\d+\.\s*/, '').trim())
    .slice(0, numQuestions);
  
  // If no numbered questions found, try to extract sentences
  if (questions.length === 0) {
    const sentences = text.split(/[.!?]/)
      .filter(s => s.trim().length > 10)
      .map(s => s.trim())
      .slice(0, numQuestions);
    return sentences;
  }
  
  return questions;
}

// Default fallback questions
function getDefaultQuestions(query: string, numQuestions: number): string[] {
  return [
    `What specific aspects of ${query} are you most interested in?`,
    `What is your goal for researching ${query}?`,
    `Do you have any specific requirements or constraints for this research?`,
    `Are there any particular sources or perspectives you want included in the research?`,
    `What level of technical detail are you looking for in the research?`
  ].slice(0, numQuestions);
}

export async function generateFeedback({
  query,
  numQuestions = 3,
  modelId = 'gpt-4o',
  apiKey,
}: {
  query: string;
  numQuestions?: number;
  modelId?: AIModel;
  apiKey?: string;
}): Promise<string[]> {
  if (!query.trim()) {
    return getDefaultQuestions('this topic', numQuestions);
  }

  const model = createModel(modelId, apiKey);
  const modelInfo = AI_MODEL_DISPLAY[modelId];

  try {
    // Try with the primary model first
    if (modelInfo.supportsStructuredOutput) {
      try {
        // Try structured output first
        const result = await withRateLimitRetry(() => 
          generateObject({
            model,
            system: systemPrompt(),
            prompt: `Given the following query from the user, ask some follow up questions to clarify the research direction. Return a maximum of ${numQuestions} questions, but feel free to return less if the original query is clear: <query>${query}</query>`,
            schema: z.object({
              questions: z
                .array(z.string())
                .describe(
                  `Follow up questions to clarify the research direction, max of ${numQuestions}`,
                ),
            }),
          })
        );
        return result.object.questions.slice(0, numQuestions);
      } catch (error) {
        console.error("Error with structured output, falling back to text generation:", error);
        // Fall back to text generation
        const textResponse = await generateText({
          model,
          system: systemPrompt(),
          prompt: `Given the following query from the user, ask some follow up questions to clarify the research direction. Return a maximum of ${numQuestions} questions, but feel free to return less if the original query is clear. Format your response as a numbered list, with one question per line, starting with "1. ". <query>${query}</query>`,
        });
        
        return parseQuestionsFromText(textResponse.toString(), numQuestions);
      }
    } else {
      // For models that don't support structured outputs
      const textResponse = await withRateLimitRetry(() => 
        generateText({
          model,
          system: systemPrompt(),
          prompt: `Given the following query from the user, ask some follow up questions to clarify the research direction. Return a maximum of ${numQuestions} questions, but feel free to return less if the original query is clear. Format your response as a numbered list, with one question per line, starting with "1. ". <query>${query}</query>`,
        })
      );
      
      return parseQuestionsFromText(textResponse.toString(), numQuestions);
    }
  } catch (primaryError) {
    console.error("Error with primary model, falling back to gpt-3.5-turbo:", primaryError);
    
    // Fall back to gpt-3.5-turbo
    try {
      const fallbackModel = createModel('gpt-3.5-turbo', apiKey);
      const textResponse = await generateText({
        model: fallbackModel,
        system: systemPrompt(),
        prompt: `Given the following query from the user, ask some follow up questions to clarify the research direction. Return a maximum of ${numQuestions} questions, but feel free to return less if the original query is clear. Format your response as a numbered list, with one question per line, starting with "1. ". <query>${query}</query>`,
      });
      
      return parseQuestionsFromText(textResponse.toString(), numQuestions);
    } catch (fallbackError) {
      console.error("Final fallback error:", fallbackError);
      // Return default questions if all else fails
      return getDefaultQuestions(query, numQuestions);
    }
  }
}
