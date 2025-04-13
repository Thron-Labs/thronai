import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ErrorMessageProps {
  message: string;
  suggestion?: string;
}

export function ErrorMessage({ message, suggestion }: ErrorMessageProps) {
  return (
    <div className="flex flex-col gap-2 p-4 border border-red-200 bg-red-50 rounded-md text-red-800">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-5 w-5" />
        <span className="font-medium">{message}</span>
      </div>
      {suggestion && (
        <p className="text-sm text-red-600 ml-7">{suggestion}</p>
      )}
      <div className="text-sm text-red-600 ml-7 mt-2">
        <p>Suggestions:</p>
        <ul className="list-disc ml-5 mt-1">
          <li>Try a more specific query</li>
          <li>Use the gpt-3.5-turbo model which has higher rate limits</li>
          <li>Reduce the breadth and depth parameters</li>
        </ul>
      </div>
    </div>
  );
} 