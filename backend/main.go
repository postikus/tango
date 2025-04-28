package main

import (
	"log"
	"net/http"
	"sync"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

type Session struct {
	ID        string             `json:"id"`
	Name      string             `json:"name"`
	CreatedAt int64              `json:"createdAt"`
	Clients   map[string]*Client `json:"-"`
	mu        sync.Mutex         `json:"-"`
}

type Client struct {
	ID       string          `json:"id"`
	Name     string          `json:"name"`
	Conn     *websocket.Conn `json:"-"`
	SessionID string          `json:"sessionId"`
}

type Message struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

type InMemoryStore struct {
	Sessions map[string]*Session
	Clients  map[string]*Client
	mu       sync.Mutex
}

func NewInMemoryStore() *InMemoryStore {
	return &InMemoryStore{
		Sessions: make(map[string]*Session),
		Clients:  make(map[string]*Client),
	}
}

var (
	store      = NewInMemoryStore()
	upgrader   = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true // Allow all origins for demo purposes
		},
	}
)

func main() {
	r := gin.Default()

	config := cors.DefaultConfig()
	config.AllowOrigins = []string{"https://tango-clone-frontend.onrender.com", "http://localhost:5173"}
	config.AllowCredentials = true
	config.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	config.AllowHeaders = []string{"Origin", "Content-Type", "Accept", "Authorization"}
	r.Use(cors.New(config))

	api := r.Group("/api")
	{
		api.GET("/sessions", getSessions)
		api.POST("/sessions", createSession)
		api.GET("/sessions/:id", getSession)
		api.DELETE("/sessions/:id", deleteSession)
	}

	r.GET("/ws/:sessionId", handleWebSocket)

	log.Println("Server starting on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatal("Failed to start server: ", err)
	}
}

func getSessions(c *gin.Context) {
	store.mu.Lock()
	defer store.mu.Unlock()

	sessions := make([]*Session, 0, len(store.Sessions))
	for _, session := range store.Sessions {
		sessions = append(sessions, session)
	}

	c.JSON(http.StatusOK, gin.H{
		"sessions": sessions,
	})
}

func createSession(c *gin.Context) {
	var req struct {
		Name string `json:"name" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	store.mu.Lock()
	defer store.mu.Unlock()

	id := generateID()
	session := &Session{
		ID:        id,
		Name:      req.Name,
		CreatedAt: getCurrentTimestamp(),
		Clients:   make(map[string]*Client),
	}

	store.Sessions[id] = session

	c.JSON(http.StatusCreated, session)
}

func getSession(c *gin.Context) {
	id := c.Param("id")

	store.mu.Lock()
	defer store.mu.Unlock()

	session, exists := store.Sessions[id]
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Session not found"})
		return
	}

	c.JSON(http.StatusOK, session)
}

func deleteSession(c *gin.Context) {
	id := c.Param("id")

	store.mu.Lock()
	defer store.mu.Unlock()

	if _, exists := store.Sessions[id]; !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Session not found"})
		return
	}

	for _, client := range store.Sessions[id].Clients {
		if client.Conn != nil {
			client.Conn.Close()
		}
		delete(store.Clients, client.ID)
	}

	delete(store.Sessions, id)
	c.Status(http.StatusNoContent)
}

func handleWebSocket(c *gin.Context) {
	sessionID := c.Param("sessionId")

	store.mu.Lock()
	session, exists := store.Sessions[sessionID]
	if !exists {
		store.mu.Unlock()
		c.JSON(http.StatusNotFound, gin.H{"error": "Session not found"})
		return
	}
	store.mu.Unlock()

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Println("Failed to upgrade connection:", err)
		return
	}

	clientID := generateID()
	client := &Client{
		ID:        clientID,
		Conn:      conn,
		SessionID: sessionID,
	}

	store.mu.Lock()
	store.Clients[clientID] = client
	session.Clients[clientID] = client
	store.mu.Unlock()

	sendMessage(conn, Message{
		Type: "session_joined",
		Payload: gin.H{
			"sessionId": sessionID,
			"clientId":  clientID,
		},
	})

	broadcastToSession(sessionID, Message{
		Type: "client_joined",
		Payload: gin.H{
			"clientId": clientID,
		},
	}, clientID)

	go handleMessages(client, session)
}

func handleMessages(client *Client, session *Session) {
	defer func() {
		if client.Conn != nil {
			client.Conn.Close()
		}

		store.mu.Lock()
		delete(store.Clients, client.ID)
		delete(session.Clients, client.ID)
		store.mu.Unlock()

		broadcastToSession(session.ID, Message{
			Type: "client_left",
			Payload: gin.H{
				"clientId": client.ID,
			},
		}, "")
	}()

	for {
		_, message, err := client.Conn.ReadMessage()
		if err != nil {
			log.Printf("Error reading message: %v", err)
			break
		}

		broadcastToSession(session.ID, Message{
			Type: "screen_data",
			Payload: gin.H{
				"clientId": client.ID,
				"data":     string(message),
			},
		}, client.ID)
	}
}

func broadcastToSession(sessionID string, message Message, excludeClientID string) {
	store.mu.Lock()
	session, exists := store.Sessions[sessionID]
	if !exists {
		store.mu.Unlock()
		return
	}

	for id, client := range session.Clients {
		if id != excludeClientID {
			sendMessage(client.Conn, message)
		}
	}
	store.mu.Unlock()
}

func sendMessage(conn *websocket.Conn, message Message) {
	if conn != nil {
		if err := conn.WriteJSON(message); err != nil {
			log.Printf("Error sending message: %v", err)
		}
	}
}

func generateID() string {
	return "id_" + randomString(8)
}
