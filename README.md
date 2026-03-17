# DevOps

A modern, responsive AWS DevOps platform built with **React**, **TypeScript**, **Node.js**, and **Express**.

## Features

- 📊 Executive dashboard with KPI metrics  
- ⚡ Fast and responsive UI with React  
- 🎨 Beautiful design with Material-UI  
- 🚀 Express.js backend API  
- 📝 Full TypeScript support  
- 🛠️ Vite for fast development  

## Project Structure

```
devops/
├── client/                    # React TypeScript frontend
│   ├── src/
│   │   ├── App.tsx           # Main dashboard component
│   │   ├── App.css           # Styling
│   │   ├── main.tsx          # Entry point
│   │   └── index.css         # Global styles
│   ├── public/
│   │   └── index.html        # HTML template
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── server/                    # Node.js Express backend
│   ├── src/
│   │   └── index.ts          # Express server
│   ├── package.json
│   └── tsconfig.json
├── package.json              # Root package.json
└── README.md
```

## Prerequisites

- **Node.js** 16+ and **npm** 8+

## Installation

Install all dependencies:

```bash
npm run install-all
```

## Usage

### Development Mode

Run both client and server simultaneously:

```bash
npm run dev
```

Or run them separately:

```bash
# Terminal 1: Start the backend server
npm run dev:server

# Terminal 2: Start the frontend client
npm run dev:client
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:3001

### Production Build

```bash
npm run build
```

Start production server:

```bash
npm start
```

## API Endpoints

### Health Check
- **GET** `/api/health`
- Returns server status

### Chat
- **POST** `/api/chat`
- **Body**: `{ "message": "your message" }`
- **Response**: `{ "message": "agent response" }`

## Environment Variables

Create a `.env` file in the `server/` directory:

```env
PORT=3001
NODE_ENV=development
```

See `server/.env.example` for reference.

## Development

### Type Checking

```bash
npm run type-check
```

### Build TypeScript

```bash
npm run build
```

## Technologies

**Frontend:**
- React 18
- TypeScript
- Vite
- Axios

**Backend:**
- Node.js
- Express
- TypeScript
- Cors

## License

MIT
