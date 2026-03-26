import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { motion } from 'motion/react';
import { 
  Sparkles, 
  Search, 
  Send, 
  BookOpen, 
  ShieldCheck, 
  Zap, 
  X,
  MessageSquare,
  Bot
} from 'lucide-react';
import Markdown from 'react-markdown';
import { toast } from 'sonner';

export default function ProductConsultant() {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setResponse('');
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `As an Amway product expert, answer the following question about Nutrilite, Artistry, or other Amway products: ${query}. Provide key benefits, usage tips, and target audience. Use a professional and encouraging tone.`,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      setResponse(result.text || 'No response generated.');
      toast.success('Product insights generated!');
    } catch (error) {
      console.error('AI Error:', error);
      toast.error('Failed to get product info. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 p-4 bg-emerald-500 text-neutral-950 rounded-2xl shadow-2xl shadow-emerald-500/20 hover:scale-110 transition-all z-40 group"
      >
        <Bot className="w-6 h-6 group-hover:animate-bounce" />
        <span className="absolute right-full mr-4 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-neutral-900 border border-white/10 rounded-xl text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
          AI Product Consultant
        </span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-neutral-900 border border-white/10 rounded-3xl p-8 max-w-2xl w-full max-h-[80vh] flex flex-col gap-6"
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold tracking-tighter">AI Product Consultant</h2>
                  <p className="text-xs text-neutral-500 font-bold uppercase tracking-widest">Powered by Gemini</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/5 rounded-xl">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
              <input 
                type="text" 
                placeholder="Ask about Nutrilite, Artistry, or any product..." 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-12 pr-16 py-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-emerald-500/50 transition-all text-sm font-medium"
              />
              <button 
                disabled={loading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-emerald-500 text-neutral-950 rounded-xl hover:bg-emerald-400 transition-all disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
              {loading ? (
                <div className="space-y-4 animate-pulse">
                  <div className="h-4 bg-white/5 rounded-full w-3/4" />
                  <div className="h-4 bg-white/5 rounded-full w-1/2" />
                  <div className="h-4 bg-white/5 rounded-full w-2/3" />
                </div>
              ) : response ? (
                <div className="prose prose-invert prose-sm max-w-none">
                  <div className="markdown-body">
                    <Markdown>{response}</Markdown>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-8">
                  {[
                    { icon: ShieldCheck, title: "Nutrilite Benefits", q: "What are the benefits of Nutrilite Double X?" },
                    { icon: BookOpen, title: "Usage Tips", q: "How should I use Artistry Skin Nutrition?" },
                    { icon: Zap, title: "Target Audience", q: "Who is the target audience for XS Energy Drinks?" },
                    { icon: MessageSquare, title: "Sales Points", q: "Give me 3 key sales points for G&H Body Care." }
                  ].map((item, i) => (
                    <button 
                      key={i}
                      onClick={() => setQuery(item.q)}
                      className="p-4 bg-white/5 border border-white/5 rounded-2xl text-left hover:bg-white/10 hover:border-emerald-500/30 transition-all group"
                    >
                      <item.icon className="w-5 h-5 text-emerald-500 mb-3" />
                      <p className="text-sm font-bold group-hover:text-emerald-500 transition-colors">{item.title}</p>
                      <p className="text-[10px] text-neutral-500 mt-1 line-clamp-1">{item.q}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}
