import { useEffect, useRef, useState } from 'react';
import { listenSosMessages, sendSosMessage, type SosMessage, type SosMessageRole } from '../../data/chat';
import { Phone, Send, X, ShieldAlert, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SosChatBridgeProps {
  sosId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: SosMessageRole;
  phoneToCall?: string; // Tel string of the counterparty
  counterpartyName?: string;
  onClose: () => void;
}

export const SosChatBridge = ({
  sosId,
  currentUserId,
  currentUserName,
  currentUserRole,
  phoneToCall,
  counterpartyName,
  onClose,
}: SosChatBridgeProps) => {
  const [messages, setMessages] = useState<SosMessage[]>([]);
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return listenSosMessages(sosId, setMessages);
  }, [sosId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const msg = text.trim();
    setText('');
    try {
      await sendSosMessage(sosId, currentUserId, currentUserName, currentUserRole, msg);
    } catch (err) {
      console.error('Failed to send message', err);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed inset-0 z-[100] flex flex-col bg-[#0f1016] md:max-w-md md:mx-auto md:shadow-2xl md:border-x md:border-white/10"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#151622]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              {currentUserRole === 'victim' ? (
                <ShieldAlert className="h-5 w-5 text-blue-400" />
              ) : (
                <User className="h-5 w-5 text-blue-400" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-black text-white">Emergency Chat</h2>
              <p className="text-[10px] text-white/50 uppercase tracking-widest">
                End-to-End Encrypted
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {phoneToCall && (
              <a
                href={`tel:${phoneToCall.replace(/\\D/g, '')}`}
                className="h-10 w-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center hover:bg-emerald-500/30 transition"
                aria-label="Call Bridge"
              >
                <Phone className="h-4 w-4" />
              </a>
            )}
            <button
              onClick={onClose}
              className="h-10 w-10 rounded-full bg-white/5 text-white/50 flex items-center justify-center hover:bg-white/10 hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Message List */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-300">
              Connection Secured
            </span>
            <p className="mt-2 text-xs text-white/40">
              You are connected. {counterpartyName ? `Chatting with ${counterpartyName}.` : ''}
            </p>
          </div>

          {messages.map((m) => {
            const isMe = m.senderId === currentUserId;
            return (
              <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                {!isMe && (
                  <span className="text-[10px] text-white/40 mb-1 ml-1 capitalize">
                    {m.senderName} ({m.role})
                  </span>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                    isMe
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-white/10 text-white rounded-bl-none'
                  }`}
                >
                  {m.text}
                </div>
                <span className="text-[9px] text-white/30 mt-1 mx-1">
                  {m.createdAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
            );
          })}
        </div>

        {/* Input Form */}
        <div className="p-4 border-t border-white/10 bg-[#12131a]">
          <form onSubmit={handleSend} className="flex items-center gap-3">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 rounded-full bg-white/5 border border-white/10 px-5 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 focus:bg-blue-500/5 transition"
            />
            <button
              type="submit"
              disabled={!text.trim()}
              className="h-12 w-12 rounded-full bg-blue-600 flex items-center justify-center text-white disabled:opacity-50 disabled:bg-white/10 transition active:scale-95 shrink-0"
            >
              <Send className="h-5 w-5 ml-1" />
            </button>
          </form>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
