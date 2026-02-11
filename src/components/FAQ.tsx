import { MessageSquare } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const faqItems = [
  {
    question: "What's the primary purpose of a portfolio?",
    answer: "A portfolio showcases your best work, skills, and experience to potential employers or clients. It serves as tangible evidence of your capabilities and helps you stand out in competitive job markets."
  },
  {
    question: "How many projects should I include in my portfolio?",
    answer: "Quality over quantity is key. Include 4-6 of your best projects that demonstrate a range of skills. Each project should tell a story about the problem you solved and the impact of your work."
  },
  {
    question: "Should I tailor my portfolio for different job applications?",
    answer: "Yes! Tailoring your portfolio to highlight relevant projects and skills for each application significantly increases your chances of success. Consider creating multiple versions for different roles."
  },
  {
    question: "What are common mistakes to avoid in a portfolio?",
    answer: "Common mistakes include: too many projects with little depth, missing context about your role, no quantifiable results, poor visual design, outdated work, and not including contact information."
  }
];

const FAQ = () => {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
      <h2 className="flex items-center gap-3 text-2xl font-bold text-primary mb-2">
        <MessageSquare className="w-7 h-7" />
        Frequently Asked Questions
      </h2>
      <p className="text-muted-foreground mb-6">
        Common questions about portfolios and how to make them shine.
      </p>
      
      <Accordion type="single" collapsible className="w-full space-y-3">
        {faqItems.map((item, index) => (
          <AccordionItem 
            key={index} 
            value={`item-${index}`} 
            className="border border-border rounded-xl px-5 data-[state=open]:bg-muted/30"
          >
            <AccordionTrigger className="text-left text-primary hover:no-underline py-5 text-lg">
              {item.question}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground pb-5 text-base">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};

export default FAQ;
