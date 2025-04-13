import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface PartialResultsMessageProps {
  message: string;
}

export function PartialResultsMessage({ message }: PartialResultsMessageProps) {
  return (
    <div className="flex items-center gap-2 p-3 mb-4 border border-amber-200 bg-amber-50 rounded-md text-amber-800">
      <AlertTriangle className="h-5 w-5 flex-shrink-0" />
      <span className="text-sm">{message}</span>
    </div>
  );
} 