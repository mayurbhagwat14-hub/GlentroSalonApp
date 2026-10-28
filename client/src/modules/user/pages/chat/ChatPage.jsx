import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getMessages, sendMessage as sendMessageApi, markChatAsRead } from '../../services/userApi';
import { useSocket } from '../../../../context/SocketContext';
import { useAuth } from '../../../../context/AuthContext';
import { goBack } from '../../../../utils/navigation';
import Button from '../../../../components/common/Button';
import { ChatSkeleton } from '../../components/skeletons/ChatSkeleton';

const ChatPage = () => {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
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
    if (data.userId !== user._id) setIsTyping(data.isTyping);
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

  if (loading) return <ChatSkeleton />;

  const isAdminChat = chatDetails?.chatType === 'user-admin';
  const otherParticipant = chatDetails?.participants?.find(p => p.role === (isAdminChat ? 'admin' : 'vendor'));
  const vendorName = isAdminChat ? 'Admin Support' : (otherParticipant?.vendorDetails?.name || 'Vendor');
  const salonName = chatDetails?.salonDetails?.name || '';
  const displayId = chatDetails?.chatDisplayId || `CHAT-${chatId.slice(-6).toUpperCase()}`;

  return (
    <div className="flex flex-col h-[calc(100dvh-72px-env(safe-area-inset-bottom))] md:h-[calc(100vh-120px)] animate-fade-in max-w-4xl mx-auto w-full bg-white sm:rounded-2xl shadow-sm sm:border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 pt-[max(1.25rem,calc(env(safe-area-inset-top,0px)+0.75rem))] border-b border-slate-100 bg-white sticky top-0 z-10">
        <button onClick={() => goBack(navigate, '/chat')} className="p-2 -ml-2 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center justify-center">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <div>
          <h2 className="font-semibold text-slate-800 text-lg">
            {vendorName}
            {salonName && <span className="text-sm font-normal text-primary-600 ml-2">• {salonName}</span>}
          </h2>
          <p className="text-xs text-slate-500 font-medium">{displayId}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 py-4 px-2">
        {messages.length === 0 ? (
          <div className="text-center text-text-muted py-12 flex flex-col items-center">
            <span className="material-symbols-outlined text-4xl text-muted-text/30 mb-2">chat</span>
            <p className="text-sm">Start the conversation</p>
          </div>
        ) : messages.map((msg, i) => {
          const isOwn = msg.sender === user._id || msg.sender?._id === user._id;
          return (
            <div key={msg._id || i} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                isOwn ? 'bg-primary-600 text-white rounded-br-md' : 'bg-white text-text-primary border border-gray-100 rounded-bl-md'}`}>
                <p>{msg.content}</p>
                <p className={`text-[10px] mt-1 ${isOwn ? 'text-primary-200' : 'text-text-muted'}`}>
                  {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) : ''}
                </p>
              </div>
            </div>
          );
        })}
        {isTyping && <div className="flex justify-start"><div className="bg-gray-100 rounded-2xl px-4 py-2 text-sm text-text-muted animate-pulse-soft">typing...</div></div>}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 bg-white p-3 pb-[max(1rem,env(safe-area-inset-bottom,16px))] flex gap-2 rounded-t-2xl">
        <input type="text" value={newMessage} onChange={handleInputChange} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Type a message..." className="flex-1 px-4 py-3 rounded-xl bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200" />
        <Button onClick={handleSend} loading={sending} disabled={!newMessage.trim()}>Send</Button>
      </div>
    </div>
  );
};

export default ChatPage;
