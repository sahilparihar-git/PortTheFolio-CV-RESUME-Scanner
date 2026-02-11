import { useState, useCallback, useEffect, useRef } from 'react';
import { Upload, FileText, X, ClipboardPaste } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// PDF.js version to load from CDN (use stable version 3.11.174)
const PDFJS_VERSION = '3.11.174';

interface FileUploadProps {
  onFileContent: (content: string) => void;
  isLoading: boolean;
}

// Load PDF.js from CDN (avoids top-level await bundling issues)
const loadPdfJs = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if ((window as any).pdfjsLib) {
      resolve((window as any).pdfjsLib);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.js`;
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib;
      if (pdfjsLib) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.js`;
        resolve(pdfjsLib);
      } else {
        reject(new Error('PDF.js failed to load'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load PDF.js from CDN'));
    document.head.appendChild(script);
  });
};

const FileUpload = ({ onFileContent, isLoading }: FileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [pastedText, setPastedText] = useState('');
  const pdfjsRef = useRef<any>(null);

  const validTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/png',
    'image/jpeg',
    'image/jpg'
  ];

  useEffect(() => {
    if (isLoading) {
      setProgress(0);
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 15;
        });
      }, 300);
      return () => clearInterval(interval);
    } else {
      setProgress(0);
    }
  }, [isLoading]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const extractTextFromPDF = async (file: File): Promise<string> => {
    // Lazy-load PDF.js from CDN
    if (!pdfjsRef.current) {
      pdfjsRef.current = await loadPdfJs();
    }
    const pdfjsLib = pdfjsRef.current;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }

    return fullText.trim();
  };



  const extractTextFromFile = async (file: File): Promise<string> => {
    // Plain text files
    if (file.type === 'text/plain') {
      return await file.text();
    }

    // PDF files - use pdf.js for proper extraction
    if (file.type === 'application/pdf') {
      const text = await extractTextFromPDF(file);
      if (text.length < 50) {
        throw new Error('Could not extract readable text from PDF. The file may be image-based. Please try pasting your content directly.');
      }
      return text;
    }

    // DOCX files - basic extraction (XML-based)
    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const arrayBuffer = await file.arrayBuffer();
      const text = new TextDecoder().decode(arrayBuffer);
      // Extract text between XML tags for DOCX
      const cleanText = text
        .replace(/<[^>]*>/g, ' ')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (cleanText.length < 50) {
        throw new Error('Could not extract readable text from DOCX. Please try a .txt file or paste your content directly.');
      }
      return cleanText;
    }

    // Images - inform user that OCR is not supported
    if (file.type.startsWith('image/')) {
      throw new Error('Image files require OCR which is not currently supported. Please paste your CV text directly or upload a PDF/TXT file.');
    }

    throw new Error('Unsupported file type. Please upload a PDF, TXT, or paste your content directly.');
  };

  const processFile = async (selectedFile: File) => {
    setError(null);

    if (!validTypes.includes(selectedFile.type)) {
      setError('Please upload a PDF, DOCX, TXT, or image file');
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    setFile(selectedFile);

    try {
      const content = await extractTextFromFile(selectedFile);
      console.log('Extracted text length:', content.length, 'Preview:', content.slice(0, 200));
      onFileContent(content);
    } catch (err) {
      console.error('File extraction error:', err);
      setError(err instanceof Error ? err.message : 'Failed to read file');
      setFile(null);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  }, [onFileContent]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const handlePasteSubmit = () => {
    if (pastedText.trim().length < 50) {
      setError('Please paste at least 50 characters of CV/portfolio content');
      return;
    }
    setError(null);
    onFileContent(pastedText.trim());
  };

  const clearFile = () => {
    setFile(null);
    setError(null);
  };

  return (
    <div className="w-full">
      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="upload" className="gap-2">
            <Upload className="w-4 h-4" />
            Upload File
          </TabsTrigger>
          <TabsTrigger value="paste" className="gap-2">
            <ClipboardPaste className="w-4 h-4" />
            Paste Text
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <div
            className={cn(
              "relative border-2 border-dashed rounded-2xl p-10 transition-all duration-300 cursor-pointer",
              "hover:border-primary/40",
              isDragging && "border-primary bg-primary/5",
              !file && "border-border bg-muted/30",
              file && !error && "border-primary/30 bg-muted/30"
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => !isLoading && document.getElementById('file-input')?.click()}
          >
            <input
              id="file-input"
              type="file"
              className="hidden"
              accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
              onChange={handleFileInput}
              disabled={isLoading}
            />

            <div className="flex flex-col items-center gap-3 text-center">
              {file ? (
                <>
                  <div className="w-16 h-16 flex items-center justify-center">
                    <FileText className="w-12 h-12 text-primary" strokeWidth={1} />
                  </div>
                  <div>
                    <p className="text-base font-medium text-foreground">{file.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                    {!isLoading && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Drop another file or click to replace.
                      </p>
                    )}
                  </div>
                  {!isLoading && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        clearFile();
                      }}
                      className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors"
                    >
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  )}
                </>
              ) : (
                <>
                  <div className="w-16 h-16 flex items-center justify-center">
                    <Upload className="w-12 h-12 text-primary" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-base text-foreground">
                      Drag & drop your portfolio file here, or click to select
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      (PDFs & TXT files accepted)
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="paste">
          <div className="space-y-4">
            <Textarea
              placeholder="Paste your CV or portfolio content here..."
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              className="min-h-[200px] resize-y rounded-xl border-border bg-muted/30"
              disabled={isLoading}
            />
            <Button
              onClick={handlePasteSubmit}
              disabled={isLoading || pastedText.trim().length < 50}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-6 rounded-xl text-base"
            >
              <ClipboardPaste className="w-5 h-5 mr-2" />
              Analyze Pasted Content
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Paste at least 50 characters of your CV/portfolio content
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {isLoading && (
        <div className="mt-6 space-y-3">
          <Progress value={progress} className="h-2" />
          <p className="text-center text-primary font-medium">
            AI is analyzing your CV...
          </p>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-destructive text-center">{error}</p>
      )}
    </div>
  );
};

export default FileUpload;
