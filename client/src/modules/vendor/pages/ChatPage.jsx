import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getMessages, sendMessage as sendMessageApi, markChatAsRead } from '../services/vendorApi';
import { useSocket } from '../../../context/SocketContext';
import { useAuth } from '../../../context/AuthContext';
import { goBack } from '../../../utils/navigation';

const ChatPage = () => {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { vendor } = useAuth();
  const { socket } = useSocket();
  const [messages, setMessages] = useState([]);
  const [chatDetails, setChatDetails] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeout = useRef(null);

  useEffect(() => {
    loadMessages();
    if (socket) {
      socket.emit('chat:join', chatId);
      socket.on('chat:message', handleIncomingMessage);
      socket.on('chat:typing', handleTyping);
      markChatAsRead(chatId);
      return () => {
        socket.emit('chat:leave', chatId);
        socket.off('chat:message', handleIncomingMessage);
        socket.off('chat:typing', handleTyping);
      };
    }
  }, [chatId, socket]);

  useEffect(() => { scrollToBottom(); }, [messages]);

  const loadMessages = async () => {
    try { 
      const res = await getMessages(chatId); 
      setMessages(res.data.data.messages);
      setChatDetails(res.data.data.chat);
    } catch (e) {}
    setLoading(false);
  };

  const handleIncomingMessage = (data) => {
    if (data.chatId === chatId) {
      setMessages(prev => {
        if (prev.some(msg => msg._id === data._id)) return prev;
        return [...prev, data];
      });
      setIsTyping(false);
    }
  };

  const handleTyping = (data) => {
    if (data.userId !== vendor?._id) setIsTyping(data.isTyping);
  };

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); };

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    setSending(true);
    try {
      const res = await sendMessageApi(chatId, { content: newMessage.trim(), messageType: 'text' });
      setMessages(prev => {
        if (prev.some(msg => msg._id === res.data.data._id)) return prev;
        return [...prev, res.data.data];
      });
      socket?.emit('chat:stop-typing', { chatId });
      setNewMessage('');
    } catch (e) {}
    setSending(false);
  };

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    socket?.emit('chat:typing', { chatId });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => { socket?.emit('chat:stop-typing', { chatId }); }, 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col h-[100dvh] sm:h-full max-w-4xl mx-auto w-full bg-surface border border-border overflow-hidden rounded-2xl">
        <div className="h-16 bg-background-alt animate-pulse border-b border-border" />
        <div className="flex-1 bg-surface-variant/20 p-4 space-y-4">
          <div className="h-12 w-2/3 bg-slate-100 rounded-2xl animate-pulse" />
          <div className="h-12 w-1/3 bg-slate-100 rounded-2xl animate-pulse ml-auto" />
          <div className="h-12 w-1/2 bg-slate-100 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  const otherParticipant = chatDetails?.participants?.find(p => p.role === 'user');
  const customerName = otherParticipant?.userDetails?.name || 'Customer';
  const salonName = chatDetails?.salonDetails?.name || '';
  const displayId = chatDetails?.chatDisplayId || `CHAT-${chatId.slice(-6).toUpperCase()}`;

  return (
    <div className="flex flex-col h-[100dvh] sm:h-full animate-fade-in max-w-4xl mx-auto w-full bg-surface sm:rounded-2xl shadow-sm sm:border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 pt-[max(1rem,env(safe-area-inset-top,14px))] border-b border-border bg-surface sticky top-0 z-10">
        <button onClick={() => goBack(navigate, '/vendor/chats')} className="p-2 -ml-2 rounded-xl text-on-surface hover:bg-surface-variant transition-colors flex items-center justify-center">
          <span className="material-symbols-outlined text-[24px]">arrow_back</span>
        </button>
        <div>
          <h2 className="font-semibold text-on-surface text-lg">
            {customerName}
            {salonName && <span className="text-sm font-normal text-primary ml-2">• {salonName}</span>}
          </h2>
          <p className="text-xs text-muted-text font-medium">{displayId}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background-alt/50">
        {messages.length === 0 ? (
          <div className="text-center text-muted-text py-16 flex flex-col items-center">
            <span className="material-symbols-outlined text-4xl text-muted-text/30 mb-2">chat</span>
            <p className="text-sm">Start the conversation</p>
          </div>
        ) : messages.map((msg, i) => {
          const isOwn = msg.sender === vendor?._id || msg.sender?._id === vendor?._id;
          return (
            <div key={msg._id || i} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                isOwn ? 'bg-primary text-white rounded-br-md' : 'bg-surface text-on-surface border border-border rounded-bl-md shadow-sm'}`}>
                <p>{msg.content}</p>
                <p className={`text-[10px] mt-1 ${isOwn ? 'text-primary-100' : 'text-muted-text'}`}>
                  {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                </p>
              </div>
            </div>
          );
        })}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-surface border border-border rounded-2xl px-4 py-2 text-xs text-muted-text animate-pulse-soft">
              typing...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom,16px))] bg-surface border-t border-border flex gap-2">
        <input type="text" value={newMessage} onChange={handleInputChange} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Type a message..." className="flex-1 px-4 py-3 rounded-xl bg-background-alt border border-border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-on-surface" />
        <button onClick={handleSend} disabled={!newMessage.trim() || sending} className="px-6 py-3 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary-dark transition-colors disabled:opacity-50 shadow-sm flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px]">send</span>
          {sending ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
};

export default ChatPage;
