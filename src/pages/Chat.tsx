import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MessageCircle, Send, Brain, Sparkles } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

const Chat = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Load chat history when component mounts
  useEffect(() => {
    if (!user) return;

    const loadChatHistory = async () => {
      try {
        const { data: chatHistory, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });

        if (error) throw error;

        if (chatHistory && chatHistory.length > 0) {
          const formattedMessages: Message[] = chatHistory.map((msg, index) => ({
            id: msg.id,
            type: msg.role === 'user' ? 'user' : 'ai',
            content: msg.content,
            timestamp: new Date(msg.created_at)
          }));
          setMessages(formattedMessages);
        } else {
          // Show welcome message if no history
          setMessages([
            {
              id: 'welcome',
              type: 'ai',
              content: 'Привет, дорогая! Меня зовут Gaia, и я твой персональный помощник по женскому здоровью. Как дела сегодня? Расскажи мне о своем самочувствии - я здесь, чтобы поддержать тебя! 💙',
              timestamp: new Date(),
            }
          ]);
        }
      } catch (error) {
        console.error('Error loading chat history:', error);
        // Show welcome message on error
        setMessages([
          {
            id: 'welcome',
            type: 'ai',
            content: 'Привет, дорогая! Меня зовут Gaia, и я твой персональный помощник по женскому здоровью. Как дела сегодня? Расскажи мне о своем самочувствии - я здесь, чтобы поддержать тебя! 💙',
            timestamp: new Date(),
          }
        ]);
      } finally {
        setLoadingHistory(false);
      }
    };

    loadChatHistory();
  }, [user]);

  const handleSendMessage = async () => {
    if (!message.trim() || !user) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: message,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const currentMessage = message;
    setMessage('');
    setLoading(true);

    try {
      const { data: aiResponseData, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          message: currentMessage,
          userId: user.id
        }
      });

      if (error) {
        throw error;
      }

      if (aiResponseData?.response) {
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          type: 'ai',
          content: aiResponseData.response,
          timestamp: new Date(),
        };
        
        setMessages(prev => [...prev, aiResponse]);
      } else {
        throw new Error('Не удалось получить ответ от ИИ');
      }
    } catch (error) {
      console.error('Error getting AI response:', error);
      
      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: 'Извините, произошла ошибка. Попробуйте задать вопрос еще раз.',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorResponse]);
      
      toast({
        title: 'Ошибка',
        description: 'Не удалось получить ответ от Gaia',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full p-4">
      {/* Header */}
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-2 rounded-full bg-primary/10">
          <Brain className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">G<span className="font-bold text-primary">ai</span>a</h1>
          <p className="text-muted-foreground">Персональные советы и поддержка</p>
        </div>
      </div>

      {/* Messages */}
      <Card className="flex-1 flex flex-col">
        <CardContent className="flex-1 p-4 space-y-4 overflow-y-auto max-h-96">
          {loadingHistory ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-2 text-muted-foreground">Загружаю историю сообщений...</span>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-lg ${
                      msg.type === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {msg.type === 'ai' && (
                      <div className="flex items-center space-x-2 mb-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium text-primary">G<span className="font-bold text-primary">ai</span>a</span>
                      </div>
                    )}
                    <p className="text-sm">{msg.content}</p>
                    <p className="text-xs opacity-70 mt-2">
                      {msg.timestamp.toLocaleTimeString('ru-RU', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                </div>
              ))}
              
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-muted p-3 rounded-lg max-w-[80%]">
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      <span className="text-sm text-muted-foreground">Gaia печатает...</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>

        {/* Input */}
        <CardContent className="p-4 border-t">
          <div className="flex space-x-2">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Напишите ваш вопрос или расскажите о самочувствии..."
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!message.trim() || loading}
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Suggestions */}
      <div className="mt-4 space-y-2">
        <p className="text-sm text-muted-foreground">Быстрые вопросы:</p>
        <div className="flex flex-wrap gap-2">
          {[
            'Как себя чувствую сегодня?',
            'Советы по питанию',
            'Рекомендации по тренировкам',
            'Управление настроением'
          ].map((suggestion) => (
            <Button
              key={suggestion}
              variant="outline"
              size="sm"
              onClick={() => setMessage(suggestion)}
              className="text-xs"
            >
              {suggestion}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Chat;