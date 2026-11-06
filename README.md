# PulseVote – Real-Time Polling Application

PulseVote is a live polling application that allows users to create polls, share them with others, vote, and view updated results.

## Features

- Create polls with multiple options.
- Share polls using unique links.
- Submit votes.
- View vote counts and percentages.
- Receive real-time updates using WebSockets and Redis.
- Store poll information in MongoDB.

## Technology Stack

**Frontend:** React, JavaScript, CSS  
**Backend:** Go, Gin  
**Database:** MongoDB  
**Real-time communication:** Redis Pub/Sub, WebSockets

## Project Structure

```text
PulseVote/
├── backend/
│   ├── main.go
│   ├── models/
│   └── go.mod
├── frontend/
│   ├── src/
│   └── package.json
└── .gitignore
```

## Run Locally

### Backend

```bash
cd backend
go mod tidy
go run .
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Configure your MongoDB connection using a local `.env` file. Start Redis separately before running the backend.

## Developer

Dhivyalakshmi Mohan