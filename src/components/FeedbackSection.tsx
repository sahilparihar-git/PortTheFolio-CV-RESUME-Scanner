import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';

const FeedbackSection = () => {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
      <h2 className="flex items-center gap-3 text-2xl font-bold text-secondary mb-2">
        <Send className="w-7 h-7" />
        Share Your Feedback
      </h2>
      <p className="text-muted-foreground mb-6">
        We'd love to hear what you think about PortTheFolio!
      </p>
      
      <div className="w-full overflow-hidden rounded-xl relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-card z-10">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-secondary animate-spin" />
              <span className="text-muted-foreground text-sm">Loading form...</span>
            </div>
          </div>
        )}
        <iframe
          src="https://docs.google.com/forms/d/e/1FAIpQLSczCMEUZfoULDoojJCBgurNrGKD3i50rBFCbxWVparzwVPW-g/viewform?embedded=true"
          width="100%"
          frameBorder="0"
          marginHeight={0}
          marginWidth={0}
          className="w-full h-[800px] md:h-[650px]"
          onLoad={() => setIsLoading(false)}
        >
          Loading…
        </iframe>
      </div>
    </div>
  );
};

export default FeedbackSection;
