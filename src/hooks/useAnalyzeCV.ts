import { useState } from 'react';
import { toast } from '@/hooks/use-toast';

interface AnalysisResult {
  score: number;
  rejectionReasons: string[];
  fixes: string[];
  summary: string;
  isNotCV?: boolean;
  documentType?: string;
  wasForceAnalyzed?: boolean;
}

export const useAnalyzeCV = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [lastTextContent, setLastTextContent] = useState<string | null>(null);

  const analyzeCV = async (textContent: string, forceAnalyze = false) => {
    setIsLoading(true);
    setResult(null);
    setLastTextContent(textContent);

    try {
      const response = await fetch('/api/analyze-cv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ textContent, forceAnalyze }),
      });

      let data: any;
      try {
        data = await response.json();
      } catch (e) {
        data = {};
      }

      if (!response.ok) {
        console.error('Analysis error:', data?.error || 'Unknown error');
        let errorMsg = data?.error || 'Failed to analyze CV. Please try again.';

        if (response.status === 404) {
          errorMsg = 'API Endpoint not found. If running locally, ensure the development server is running properly via "npm run dev".';
        } else if (response.status === 500) {
          errorMsg = 'Server internal error. Please check the logs.';
        } else if (response.status === 504) {
          errorMsg = 'The analysis timed out. The model might be busy. Please try again.';
        }

        toast({
          title: 'Analysis Failed',
          description: errorMsg,
          variant: 'destructive',
          duration: 10000,
        });
        return;
      }

      // Check if document is not a CV
      if (data?.isNotCV) {
        const msg = data.error || 'This is not a CV or portfolio. Please upload your CV/resume for ATS analysis.';
        setResult({
          isNotCV: true,
          documentType: data.documentType,
          score: 0,
          rejectionReasons: [],
          fixes: [],
          summary: msg,
        });
        toast({
          title: 'Not a CV/Resume',
          description: msg,
          variant: 'destructive'
        });
        return;
      }

      if (data?.error) {
        toast({
          title: 'Analysis Failed',
          description: data.error,
          variant: 'destructive'
        });
        return;
      }

      if (!data || typeof data.score !== 'number') {
        toast({
          title: 'Analysis Failed',
          description: 'Received an invalid response. Please try again.',
          variant: 'destructive'
        });
        return;
      }

      setResult({ ...data, wasForceAnalyzed: forceAnalyze });
      toast({
        title: 'Analysis Complete',
        description: forceAnalyze
          ? 'Analysis complete (advanced mode). ATS score is hidden for non-CV documents.'
          : `Your CV scored ${data.score}/100 for ATS compatibility.`,
      });
    } catch (err) {
      console.error('Unexpected error:', err);
      const isNetworkError = err instanceof TypeError && err.message === 'Failed to fetch';
      toast({
        title: isNetworkError ? 'Connection Failed' : 'Analysis Error',
        description: isNetworkError
          ? 'Could not connect to the server. Please check your internet connection or try again later.'
          : 'An unexpected error occurred during analysis.',
        variant: 'destructive',
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setLastTextContent(null);
  };

  const forceAnalyzeAsCV = () => {
    if (lastTextContent) {
      analyzeCV(lastTextContent, true);
    }
  };

  return { analyzeCV, isLoading, result, reset, forceAnalyzeAsCV };
};
