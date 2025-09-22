import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MessageCircle, Send, Brain, Sparkles } from 'lucide-react';

const Chat = () => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([
    {
      id: '1',
      type: 'ai',
      content: 'Привет! Я ваш ИИ-помощник по женскому здоровью. Как дела сегодня? Расскажите о своем самочувствии.',
      timestamp: new Date(),
    }
  ]);
  const [loading, setLoading] = useState(false);

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: message,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setMessage('');
    setLoading(true);

    // Simulate AI response
    setTimeout(() => {
      const aiResponse = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: 'Спасибо за ваше сообщение! Это демо-версия ИИ-чата. В полной версии здесь будут персонализированные советы на основе вашего цикла и самочувствия.',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, aiResponse]);
      setLoading(false);
    }, 1500);
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
          <h1 className="text-2xl font-bold text-foreground">ИИ-помощник</h1>
          <p className="text-muted-foreground">Персональные советы и поддержка</p>
        </div>
      </div>

      {/* Messages */}
      <Card className="flex-1 flex flex-col">
        <CardContent className="flex-1 p-4 space-y-4 overflow-y-auto max-h-96">
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
                    <span className="text-sm font-medium text-primary">ИИ-помощник</span>
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
                  <span className="text-sm text-muted-foreground">ИИ печатает...</span>
                </div>
              </div>
            </div>
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