import { RefreshCw } from 'lucide-react';
import FileUpload from '@/components/FileUpload';
import AnalysisResult from '@/components/AnalysisResult';
import FAQ from '@/components/FAQ';
import FeedbackSection from '@/components/FeedbackSection';
import ContactSection from '@/components/ContactSection';
import { useAnalyzeCV } from '@/hooks/useAnalyzeCV';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/toaster';
import ThemeToggle from '@/components/ThemeToggle';
import logo from '@/assets/logo.png';

const Index = () => {
  const {
    analyzeCV,
    isLoading,
    result,
    reset,
    forceAnalyzeAsCV
  } = useAnalyzeCV();
  const handleFileContent = (content: string) => {
    analyzeCV(content);
  };
  return <div className="min-h-screen">
    <Toaster />

    {/* Top Navigation */}
    <nav className="py-4 px-6 flex items-center justify-between">
      <div className="flex items-center gap-8">
        <img
          src={logo}
          alt="PortTheFolio Logo"
          className="w-20 h-20 transition-all duration-300 hover:drop-shadow-[0_0_15px_hsl(var(--primary)/0.6)]"
        />
        <div className="hidden md:flex items-center gap-6">
          <a href="#upload" className="text-muted-foreground hover:text-foreground transition-colors font-medium">Upload</a>
          <a href="#faq" className="text-muted-foreground hover:text-foreground transition-colors font-medium">FAQ</a>
          <a href="#feedback" className="text-muted-foreground hover:text-foreground transition-colors font-medium">Feedback</a>
          <a href="#contact" className="text-muted-foreground hover:text-foreground transition-colors font-medium">Contact</a>
        </div>
      </div>
      <ThemeToggle />
    </nav>

    {/* Header */}
    <header className="py-12 text-center px-4">
      <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-foreground">
        PortTheFolio
      </h1>
      <p className="text-xl text-muted-foreground mt-3">
        <span className="font-cursive text-foreground italic">"Your Career, Reimagined by AI"</span>
      </p>
      <p className="text-muted-foreground mt-6 max-w-xl mx-auto text-lg leading-relaxed">
        Unlock the potential of your portfolio with AI-driven analysis. Get instant, actionable feedback to elevate your work.
      </p>
    </header>

    {/* Main Content */}
    <main className="container max-w-3xl px-4 pb-16">
      <div className="space-y-8">
        {/* Upload Section */}
        <div id="upload" className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-primary text-center mb-2">
            Upload Your Portfolio
          </h2>
          <p className="text-center text-muted-foreground mb-6">
            Drag & drop or click to select your PDF or image file.
          </p>
          <FileUpload onFileContent={handleFileContent} isLoading={isLoading} />
        </div>

        {/* Analysis Results */}
        {result && <div className="space-y-6">
          <div className="flex justify-end">
            <Button variant="outline" onClick={reset} className="gap-2 rounded-xl">
              <RefreshCw className="w-4 h-4" />
              Analyze Another
            </Button>
          </div>
          <AnalysisResult result={result} onForceAnalyze={forceAnalyzeAsCV} isLoading={isLoading} />
        </div>}

        {/* FAQ Section */}
        <div id="faq">
          <FAQ />
        </div>

        {/* Feedback Section */}
        <div id="feedback">
          <FeedbackSection />
        </div>

        {/* Contact Section */}
        <div id="contact">
          <ContactSection />
        </div>
      </div>
    </main>

    {/* Footer */}
    <footer className="py-10 text-center px-4">
      <p className="text-sm text-muted-foreground">
        © 2025 PortTheFolio by <span className="font-cursive">Sahil Parihar</span>. All rights reserved.
      </p>
      <p className="text-sm text-muted-foreground mt-1">
        Powered by AI for insightful portfolio reviews.
      </p>
    </footer>
  </div>;
};
export default Index;