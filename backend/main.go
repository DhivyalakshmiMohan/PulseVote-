
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readpref"

	"pulsevote/models"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return r.Header.Get("Origin") == "http://localhost:5173"
	},
}

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: .env file not found")
	}

	mongoURI := os.Getenv("MONGODB_URI")
	if mongoURI == "" {
		log.Fatal("MONGODB_URI is missing")
	}

	// Connect to MongoDB
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(mongoURI))
	if err != nil {
		log.Fatal("MongoDB connection failed:", err)
	}
	defer client.Disconnect(context.Background())

	if err := client.Ping(ctx, readpref.Primary()); err != nil {
		log.Fatal("MongoDB ping failed:", err)
	}

	log.Println("MongoDB connected successfully!")

	pollCollection := client.Database("pulsevote").Collection("polls")

	// Connect to Redis
	redisClient := redis.NewClient(&redis.Options{
		Addr: "127.0.0.1:6379",
	})

	if err := redisClient.Ping(context.Background()).Err(); err != nil {
		log.Fatal("Redis connection failed:", err)
	}
	defer redisClient.Close()

	log.Println("Redis connected successfully!")

	router := gin.Default()

	// CORS configuration for local React development
	router.Use(cors.New(cors.Config{
		AllowOrigins: []string{"http://localhost:5173"},
		AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders: []string{"Origin", "Content-Type", "Authorization"},
	}))

	// Health check
	router.GET("/api/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "PulseVote backend is running!",
		})
	})

	// CREATE POLL
	router.POST("/api/polls", func(c *gin.Context) {
		var request struct {
			Question string   `json:"question"`
			Options  []string `json:"options"`
		}

		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}

		question := strings.TrimSpace(request.Question)

		if question == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Question is required"})
			return
		}

		if len(request.Options) < 2 || len(request.Options) > 5 {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Provide between 2 and 5 options",
			})
			return
		}

		var pollOptions []models.PollOption
		seen := make(map[string]bool)

		for _, option := range request.Options {
			option = strings.TrimSpace(option)
			key := strings.ToLower(option)

			if option == "" {
				c.JSON(http.StatusBadRequest, gin.H{
					"error": "Options cannot be empty",
				})
				return
			}

			if seen[key] {
				c.JSON(http.StatusBadRequest, gin.H{
					"error": "Options must be unique",
				})
				return
			}

			seen[key] = true

			pollOptions = append(pollOptions, models.PollOption{
				ID:    uuid.NewString(),
				Text:  option,
				Votes: 0,
			})
		}

		poll := models.Poll{
			Question:   question,
			Options:    pollOptions,
			TotalVotes: 0,
			CreatedAt:  time.Now(),
		}

		result, err := pollCollection.InsertOne(c.Request.Context(), poll)
		if err != nil {
			log.Println("Create poll error:", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Could not create poll",
			})
			return
		}

		insertedID := result.InsertedID.(primitive.ObjectID)

		c.JSON(http.StatusCreated, gin.H{
			"message": "Poll created successfully",
			"pollId":  insertedID.Hex(),
		})
	})

	// GET POLL
	router.GET("/api/polls/:id", func(c *gin.Context) {
		id, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid poll ID"})
			return
		}

		var poll models.Poll

		err = pollCollection.FindOne(
			c.Request.Context(),
			bson.M{"_id": id},
		).Decode(&poll)

		if errors.Is(err, mongo.ErrNoDocuments) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Poll not found"})
			return
		}

		if err != nil {
			log.Println("Get poll error:", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Could not fetch poll",
			})
			return
		}

		c.JSON(http.StatusOK, poll)
	})

	// VOTE ON POLL
	router.POST("/api/polls/:id/vote", func(c *gin.Context) {
		idString := c.Param("id")

		objectID, err := primitive.ObjectIDFromHex(idString)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid poll ID"})
			return
		}

		var request struct {
			OptionID string `json:"optionId"`
			VoterID  string `json:"voterId"`
		}

		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid vote request"})
			return
		}

		request.OptionID = strings.TrimSpace(request.OptionID)
		request.VoterID = strings.TrimSpace(request.VoterID)

		if request.OptionID == "" || request.VoterID == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Option ID and voter ID are required",
			})
			return
		}

		filter := bson.M{
			"_id":        objectID,
			"options.id": request.OptionID,
			"voters":     bson.M{"$ne": request.VoterID},
		}

		update := bson.M{
			"$inc": bson.M{
				"options.$.votes": 1,
				"totalVotes":      1,
			},
			"$addToSet": bson.M{
				"voters": request.VoterID,
			},
		}

		result, err := pollCollection.UpdateOne(
			c.Request.Context(),
			filter,
			update,
		)

		if err != nil {
			log.Println("Vote update error:", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Could not save vote",
			})
			return
		}

		if result.MatchedCount == 0 {
			var poll models.Poll

			err := pollCollection.FindOne(
				c.Request.Context(),
				bson.M{"_id": objectID},
			).Decode(&poll)

			if errors.Is(err, mongo.ErrNoDocuments) {
				c.JSON(http.StatusNotFound, gin.H{"error": "Poll not found"})
				return
			}

			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"error": "Could not check poll",
				})
				return
			}

			optionExists := false
			for _, option := range poll.Options {
				if option.ID == request.OptionID {
					optionExists = true
					break
				}
			}

			if !optionExists {
				c.JSON(http.StatusBadRequest, gin.H{
					"error": "Invalid option",
				})
				return
			}

			c.JSON(http.StatusConflict, gin.H{
				"error": "You have already voted",
			})
			return
		}

		// Publish vote update to Redis
		err = redisClient.Publish(
			c.Request.Context(),
			"poll:"+idString,
			"updated",
		).Err()

		if err != nil {
			log.Println("Redis publish error:", err)
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Vote submitted successfully",
		})
	})

	// WEBSOCKET: REAL-TIME POLL UPDATES
	router.GET("/ws/polls/:id", func(c *gin.Context) {
		pollID := c.Param("id")

		objectID, err := primitive.ObjectIDFromHex(pollID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid poll ID"})
			return
		}

		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Println("WebSocket upgrade error:", err)
			return
		}
		defer conn.Close()

		pubsub := redisClient.Subscribe(
			context.Background(),
			"poll:"+pollID,
		)
		defer pubsub.Close()

		if _, err := pubsub.Receive(context.Background()); err != nil {
			log.Println("Redis subscription error:", err)
			return
		}

		sendPoll := func() error {
			var poll models.Poll

			err := pollCollection.FindOne(
				context.Background(),
				bson.M{"_id": objectID},
			).Decode(&poll)

			if err != nil {
				return err
			}

			return conn.WriteJSON(poll)
		}

		if err := sendPoll(); err != nil {
			log.Println("Initial poll send error:", err)
			return
		}

		for range pubsub.Channel() {
			if err := sendPoll(); err != nil {
				log.Println("WebSocket send error:", err)
				return
			}
		}
	})

	log.Println("PulseVote server starting on port 8080")
	log.Fatal(router.Run(":8080"))
}
