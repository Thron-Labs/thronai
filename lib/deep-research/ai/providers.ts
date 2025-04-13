import { createOpenAI } from '@ai-sdk/openai';
import { getEncoding } from 'js-tiktoken';

import { RecursiveCharacterTextSplitter } from './text-splitter';

// Model Display Information
export const AI_MODEL_DISPLAY = {
  'gpt-4o': {
    id: 'gpt-4o',
    name: 'GPT-4o',
    logo: '/providers/openai.webp',
    vision: true,
    tokensPerMinute: 40000,
    supportsStructuredOutput: true,
  },
  'gpt-4': {
    id: 'gpt-4',
    name: 'GPT-4',
    logo: '/providers/openai.webp',
    vision: false,
    tokensPerMinute: 10000,
    supportsStructuredOutput: true,
  },
  'gpt-3.5-turbo': {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    logo: '/providers/openai.webp',
    vision: false,
    tokensPerMinute: 60000,
    supportsStructuredOutput: false,
  },
} as const;

export type AIModel = keyof typeof AI_MODEL_DISPLAY;
export type AIModelDisplayInfo = (typeof AI_MODEL_DISPLAY)[AIModel];
export const availableModels = Object.values(AI_MODEL_DISPLAY);

// Create model instances with configurations
export function createModel(modelId: AIModel, apiKey?: string) {
  // Use the API key from the environment if not provided
  const openaiKey = apiKey || process.env.OPENAI_API_KEY;
  
  if (!openaiKey) {
    console.warn('No OpenAI API key provided. Using default configuration.');
  }
  
  const client = createOpenAI({
    apiKey: openaiKey,
  });

  // Only use structuredOutputs for models that support it
  const modelInfo = AI_MODEL_DISPLAY[modelId];
  const options = {
    temperature: 0.2,
    ...(modelInfo.supportsStructuredOutput ? { structuredOutputs: true } : {}),
  };

  return client(modelId, options);
}

// Token handling
const MinChunkSize = 140;
const encoder = getEncoding('o200k_base');

// trim prompt to maximum context size
export function trimPrompt(prompt: string, contextSize = 120_000) {
  if (!prompt) {
    return '';
  }

  const length = encoder.encode(prompt).length;
  if (length <= contextSize) {
    return prompt;
  }

  const overflowTokens = length - contextSize;
  // on average it's 3 characters per token, so multiply by 3 to get a rough estimate of the number of characters
  const chunkSize = prompt.length - overflowTokens * 3;
  if (chunkSize < MinChunkSize) {
    return prompt.slice(0, MinChunkSize);
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap: 0,
  });
  const trimmedPrompt = splitter.splitText(prompt)[0] ?? '';

  // last catch, there's a chance that the trimmed prompt is same length as the original prompt, due to how tokens are split & innerworkings of the splitter, handle this case by just doing a hard cut
  if (trimmedPrompt.length === prompt.length) {
    return trimPrompt(prompt.slice(0, chunkSize), contextSize);
  }

  // recursively trim until the prompt is within the context size
  return trimPrompt(trimmedPrompt, contextSize);
}

// Add a helper function to handle rate limits
export async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000
): Promise<T> {
  let retries = 0;
  
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      if (
        error?.data?.error?.code === 'rate_limit_exceeded' &&
        retries < maxRetries
      ) {
        // Extract wait time from error message if available
        const waitTimeMatch = error?.data?.error?.message?.match(/try again in (\d+\.?\d*)s/i);
        const waitTime = waitTimeMatch 
          ? parseFloat(waitTimeMatch[1]) * 1000 
          : initialDelay * Math.pow(2, retries);
        
        console.log(`Rate limit hit. Waiting ${waitTime/1000}s before retry ${retries + 1}/${maxRetries}`);
        
        // Wait for the specified time
        await new Promise(resolve => setTimeout(resolve, waitTime));
        retries++;
      } else {
        throw error;
      }
    }
  }
}
