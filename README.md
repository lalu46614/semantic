# Semantic Bucket Orchestration

A Next.js application that implements a two-step semantic routing system using Google Gemini SDK. The system intelligently routes user messages to appropriate conversation buckets, ensuring context isolation and preventing cross-contamination between different topics.

## Features

- **Semantic Routing**: Uses Gemini's structured output to intelligently route messages to existing buckets or create new ones
- **Bucket Isolation**: Each bucket maintains its own isolated conversation history and file context
- **File Upload Support**: Multimodal support with file attachments linked to specific buckets
- **Modern UI**: Built with Next.js 14, TypeScript, Tailwind CSS, and shadcn/ui components

## Architecture

The system implements a two-step process:

1. **Router (Intent Gatekeeper)**: Analyzes user input using Gemini's structured output to decide:
   - Route to existing bucket (if semantically related)
   - Create new bucket (if hard pivot detected)
   - Request clarification (if ambiguous)

2. **Executor (Bucket Isolation)**: Processes messages with context filtered to only include messages and files from the selected bucket.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file in the root directory:
```
GEMINI_API_KEY=your_api_key_here
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
project-1/
├── app/
│   ├── api/
│   │   ├── chat/route.ts          # Main chat endpoint
│   │   ├── buckets/route.ts        # Bucket CRUD operations
│   │   └── upload/route.ts         # File upload handler
│   ├── layout.tsx                  # Root layout
│   ├── page.tsx                    # Main chat interface
│   └── globals.css                 # Global styles
├── lib/
│   ├── gemini/
│   │   ├── router.ts               # Router service
│   │   └── executor.ts             # Executor service
│   ├── store/
│   │   └── bucket-store.ts         # In-memory state management
│   └── types.ts                    # TypeScript types
├── components/
│   ├── ui/                         # shadcn/ui components
│   ├── BucketSidebar.tsx           # Sidebar with bucket list
│   ├── ChatArea.tsx                # Main chat interface
│   ├── MessageList.tsx             # Message display
│   └── FileUpload.tsx              # File upload component
└── public/
    └── uploads/                    # Local file storage
```

## Usage

1. **Automatic Bucket Creation**: Simply start typing a message! The system will automatically:
   - Create a new bucket if it's a new topic
   - Route to an existing bucket if semantically related
   - Ask for clarification if ambiguous
2. **Manual Bucket Management**: 
   - Click "New Bucket" in the sidebar to manually create a bucket
   - Click on any bucket in the sidebar to view its messages
   - Hover over a bucket and click the trash icon to delete it
3. **Send Messages**: Type a message and press Enter. The router analyzes every message and can:
   - Continue in the current bucket if related
   - Switch to a different existing bucket if better match
   - Create a new bucket if it's a hard pivot to a new topic
4. **Upload Files**: Use the file upload area to attach files to your messages (files are linked to the bucket)

## State Management

The application uses an in-memory store (`bucket-store.ts`) for state management. All data is stored in memory and will be reset when the server restarts. For production use, consider migrating to a persistent database (e.g., Prisma with PostgreSQL).

## API Endpoints

- `POST /api/chat` - Send a message and get AI response
- `GET /api/buckets` - List all buckets
- `POST /api/buckets` - Create a new bucket
- `DELETE /api/buckets?id={bucketId}` - Delete a bucket
- `GET /api/buckets/[bucketId]/messages` - Get messages for a bucket
- `POST /api/upload` - Upload a file

## Technologies

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Google Gemini SDK** - AI model integration
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI component library
- **Radix UI** - Accessible component primitives

## License

MIT

