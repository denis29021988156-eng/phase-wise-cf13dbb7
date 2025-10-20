import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Send, Brain, Sparkles, ChevronDown, Calendar, Clock } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import EmailPreviewDialog from '@/components/dialogs/EmailPreviewDialog';

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  suggestionId?: string; // ID предложения по переносу
}

interface EmailPreview {
  subject: string;
  body: string;
  recipients: string[];
  eventTitle: string;
}

const Chat = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [movingSuggestion, setMovingSuggestion] = useState<string | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [emailPreview, setEmailPreview] = useState<EmailPreview | null>(null);
  const [currentSuggestionId, setCurrentSuggestionId] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [pendingSuggestions, setPendingSuggestions] = useState<any[]>([]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (!loadingHistory) {
      // Прокрутка вниз к последнему сообщению
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messages, loadingHistory]);

  // Load chat history and suggestions when component mounts
  useEffect(() => {
    if (!user) return;

    const loadChatHistory = async () => {
      try {
        // Try to sync Apple Health data before loading chat
        try {
          const { syncAppleHealthData } = await import('@/utils/syncAppleHealth');
          const synced = await syncAppleHealthData(user.id);
          if (synced) {
            console.log('Apple Health data synced before chat session');
          }
        } catch (healthError) {
          console.log('Could not sync Apple Health data:', healthError);
        }

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

        // Загрузить pending предложения
        const { data: suggestions } = await supabase
          .from('event_move_suggestions')
          .select('*, events(*)')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (suggestions) {
          setPendingSuggestions(suggestions);
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

    // Подписаться на новые сообщения
    const channel = supabase
      .channel('chat-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newMsg = payload.new as any;
          if (newMsg.role === 'assistant') {
            setMessages((prev) => [
              ...prev,
              {
                id: newMsg.id,
                type: 'ai',
                content: newMsg.content,
                timestamp: new Date(newMsg.created_at),
              },
            ]);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'event_move_suggestions',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const newSuggestion = payload.new as any;
          // Перезагрузить предложения
          const { data: suggestions } = await supabase
            .from('event_move_suggestions')
            .select('*, events(*)')
            .eq('user_id', user.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
          
          if (suggestions) {
            setPendingSuggestions(suggestions);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
      const currentLanguage = localStorage.getItem('language') || 'ru';
      const { data: aiResponseData, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          message: currentMessage,
          userId: user.id,
          language: currentLanguage
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

  const handleMoveSuggestion = async (suggestionId: string) => {
    if (!user) return;
    
    setMovingSuggestion(suggestionId);
    setCurrentSuggestionId(suggestionId);
    
    try {
      const currentLanguage = localStorage.getItem('language') || 'ru';
      
      const { data, error } = await supabase.functions.invoke('ai-generate-email-preview', {
        body: { 
          suggestionId,
          language: currentLanguage
        }
      });

      if (error) throw error;

      if (data?.preview) {
        setEmailPreview(data.preview);
        setPreviewDialogOpen(true);
      }
    } catch (error) {
      console.error('Error generating email preview:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось сгенерировать preview письма',
        variant: 'destructive',
      });
    } finally {
      setMovingSuggestion(null);
    }
  };

  const handleSendEmail = async (editedSubject: string, editedBody: string) => {
    if (!user || !currentSuggestionId) return;
    
    setSendingEmail(true);
    
    try {
      const currentLanguage = localStorage.getItem('language') || 'ru';
      
      const { data, error } = await supabase.functions.invoke('ai-handle-event-move', {
        body: { 
          suggestionId: currentSuggestionId,
          customSubject: editedSubject,
          customBody: editedBody,
          language: currentLanguage
        }
      });

      if (error) throw error;

      // Обновить статус предложения локально
      setPendingSuggestions(prev => prev.filter(s => s.id !== currentSuggestionId));

      toast({
        title: 'Отправлено',
        description: data.message || 'Письмо отправлено участникам',
      });

      setPreviewDialogOpen(false);
      setCurrentSuggestionId(null);
      setEmailPreview(null);
    } catch (error) {
      console.error('Error sending email:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось отправить письмо',
        variant: 'destructive',
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleRejectSuggestion = async (suggestionId: string) => {
    if (!user) return;

    try {
      await supabase
        .from('event_move_suggestions')
        .update({ status: 'rejected' })
        .eq('id', suggestionId);

      setPendingSuggestions(prev => prev.filter(s => s.id !== suggestionId));

      toast({
        title: 'Отклонено',
        description: 'Предложение отклонено',
      });
    } catch (error) {
      console.error('Error rejecting suggestion:', error);
    }
  };

  // Show only recent messages if history is collapsed
  const displayedMessages = showFullHistory 
    ? messages 
    : messages.slice(-10); // Show last 10 messages

  const hasHiddenMessages = messages.length > 10 && !showFullHistory;

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
        <CardContent className="flex-1 p-0">
          {hasHiddenMessages && (
            <div className="p-2 border-b flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFullHistory(true)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                <ChevronDown className="h-4 w-4 mr-1" />
                Показать всю историю ({messages.length - displayedMessages.length} скрыто)
              </Button>
            </div>
          )}
          
          <ScrollArea className="h-96 p-4" ref={scrollAreaRef}>
            <div className="space-y-4">
              {loadingHistory ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <span className="ml-2 text-muted-foreground">Загружаю историю сообщений...</span>
                </div>
              ) : (
                <>
                  {displayedMessages.map((msg) => (
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

              {/* Показать pending предложения внизу диалога */}
              {pendingSuggestions.map((suggestion) => (
                <div key={suggestion.id} className="border border-primary/20 rounded-lg p-4 bg-primary/5">
                  <div className="flex items-start space-x-3">
                    <Calendar className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground mb-2">
                        {suggestion.suggestion_text}
                      </p>
                      <p className="text-xs text-muted-foreground mb-3">
                        {suggestion.reason}
                      </p>
                      <div className="flex items-center space-x-2 text-xs text-muted-foreground mb-3">
                        <Clock className="h-3 w-3" />
                        <span>
                          {new Date(suggestion.suggested_new_start).toLocaleDateString('ru-RU', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          onClick={() => handleMoveSuggestion(suggestion.id)}
                          disabled={movingSuggestion === suggestion.id}
                          className="bg-primary hover:bg-primary/90"
                        >
                          {movingSuggestion === suggestion.id ? (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2" />
                              Отправляю...
                            </>
                          ) : (
                            '✉️ Написать участникам'
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRejectSuggestion(suggestion.id)}
                          disabled={movingSuggestion === suggestion.id}
                        >
                          Отклонить
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <div ref={messagesEndRef} />
                </>
              )}
            </div>
          </ScrollArea>
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

      {/* Email Preview Dialog */}
      {emailPreview && (
        <EmailPreviewDialog
          open={previewDialogOpen}
          onOpenChange={setPreviewDialogOpen}
          subject={emailPreview.subject}
          body={emailPreview.body}
          recipients={emailPreview.recipients}
          eventTitle={emailPreview.eventTitle}
          onSend={handleSendEmail}
          sending={sendingEmail}
        />
      )}
    </div>
  );
};

export default Chat;