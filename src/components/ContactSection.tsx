import { Mail, Linkedin } from 'lucide-react';
const ContactSection = () => {
  return <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
      <h2 className="flex items-center gap-3 text-2xl font-bold text-primary mb-2">
        <Mail className="w-7 h-7" />
        Contact Us
      </h2>
      <p className="text-muted-foreground mb-5">Have questions? Follow Me!!!</p>
      
      <div className="space-y-3">
        <a href="https://linkedin.com/in/sahilparihar25" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-primary hover:underline text-base">
          <Linkedin className="w-5 h-5" />
          linkedin.com/in/sahilparihar25
        </a>
      </div>
    </div>;
};
export default ContactSection;