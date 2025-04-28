import { useState, useEffect } from 'react';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { ScrollArea } from './components/ui/scroll-area';
import { Separator } from './components/ui/separator';
import { Plus, Video, Users, Trash2 } from 'lucide-react';

interface Session {
  id: string;
  name: string;
  createdAt: number;
}

interface WebSocketMessage {
  type: string;
  payload: any;
}

function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [newSessionName, setNewSessionName] = useState('');
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [messages, setMessages] = useState<string[]>([]);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (activeSession) {
      connectWebSocket(activeSession.id);
    } else if (socket) {
      socket.close();
      setSocket(null);
      setConnected(false);
      setClientId(null);
    }

    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [activeSession]);

  const fetchSessions = async () => {
    try {
      const response = await fetch(`${API_URL}/api/sessions`);
      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  };

  const createSession = async () => {
    if (!newSessionName.trim()) return;

    try {
      const response = await fetch(`${API_URL}/api/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newSessionName }),
      });

      if (response.ok) {
        const session = await response.json();
        setSessions([...sessions, session]);
        setNewSessionName('');
        setActiveSession(session);
      }
    } catch (error) {
      console.error('Error creating session:', error);
    }
  };

  const deleteSession = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/api/sessions/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSessions(sessions.filter(session => session.id !== id));
        if (activeSession && activeSession.id === id) {
          setActiveSession(null);
        }
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  const connectWebSocket = (sessionId: string) => {
    const ws = new WebSocket(`ws://${API_URL.replace('http://', '')}/ws/${sessionId}`);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setConnected(true);
    };

    ws.onmessage = (event) => {
      const message: WebSocketMessage = JSON.parse(event.data);
      
      switch (message.type) {
        case 'session_joined':
          setClientId(message.payload.clientId);
          break;
        case 'client_joined':
          setMessages(prev => [...prev, `Client ${message.payload.clientId} joined`]);
          break;
        case 'client_left':
          setMessages(prev => [...prev, `Client ${message.payload.clientId} left`]);
          break;
        case 'screen_data':
          setMessages(prev => [...prev, `Received data from ${message.payload.clientId}`]);
          break;
        default:
          console.log('Unknown message type:', message.type);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    setSocket(ws);
  };

  const sendTestMessage = () => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ 
        action: 'test', 
        timestamp: new Date().toISOString() 
      }));
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  return (
    <div className="container mx-auto p-4">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Tango Clone</h1>
        <p className="text-gray-500">A simple screen sharing and recording platform</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Sessions</CardTitle>
              <CardDescription>Create or join a session</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-2 mb-4">
                <Input
                  placeholder="New session name"
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                />
                <Button onClick={createSession}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create
                </Button>
              </div>
              
              <ScrollArea className="h-[300px]">
                {sessions.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">No sessions available</p>
                ) : (
                  <div className="space-y-2">
                    {sessions.map((session) => (
                      <div 
                        key={session.id} 
                        className={`p-3 rounded-md flex justify-between items-center cursor-pointer ${
                          activeSession?.id === session.id ? 'bg-primary/10' : 'hover:bg-gray-100'
                        }`}
                        onClick={() => setActiveSession(session)}
                      >
                        <div>
                          <h3 className="font-medium">{session.name}</h3>
                          <p className="text-xs text-gray-500">{formatDate(session.createdAt)}</p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSession(session.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          {activeSession ? (
            <Card>
              <CardHeader>
                <CardTitle>{activeSession.name}</CardTitle>
                <CardDescription>
                  {connected ? (
                    <span className="text-green-500 flex items-center">
                      <span className="h-2 w-2 rounded-full bg-green-500 mr-2"></span>
                      Connected as {clientId}
                    </span>
                  ) : (
                    <span className="text-red-500 flex items-center">
                      <span className="h-2 w-2 rounded-full bg-red-500 mr-2"></span>
                      Disconnected
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="screen">
                  <TabsList className="mb-4">
                    <TabsTrigger value="screen">
                      <Video className="h-4 w-4 mr-2" />
                      Screen
                    </TabsTrigger>
                    <TabsTrigger value="participants">
                      <Users className="h-4 w-4 mr-2" />
                      Participants
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="screen">
                    <div className="bg-gray-100 rounded-md p-4 h-[400px] flex flex-col items-center justify-center">
                      <p className="text-gray-500 mb-4">Screen sharing area</p>
                      <Button onClick={sendTestMessage} disabled={!connected}>
                        Send Test Message
                      </Button>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="participants">
                    <div className="bg-gray-100 rounded-md p-4 h-[400px]">
                      <h3 className="font-medium mb-2">Activity Log</h3>
                      <ScrollArea className="h-[350px]">
                        {messages.length === 0 ? (
                          <p className="text-center text-gray-500 py-4">No activity yet</p>
                        ) : (
                          <div className="space-y-2">
                            {messages.map((message, index) => (
                              <div key={index} className="p-2 border-b">
                                <p>{message}</p>
                                <p className="text-xs text-gray-500">{new Date().toLocaleTimeString()}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
              <CardFooter>
                <p className="text-xs text-gray-500">
                  Session ID: {activeSession.id}
                </p>
              </CardFooter>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 flex flex-col items-center justify-center h-[500px]">
                <h2 className="text-2xl font-bold mb-2">No Active Session</h2>
                <p className="text-gray-500 mb-4">Select or create a session to get started</p>
                <Separator className="my-4" />
                <div className="flex space-x-4">
                  <Button variant="outline" onClick={() => setNewSessionName('Demo Session')}>
                    Create Demo Session
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
