# OCD Crochet Dashboard - Backend

This is the backend service for the OCD Crochet Shopify Order Management Dashboard, built with Node.js, Express, and TypeScript.

## 🚀 Quick Start

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

3. Build for production:

```bash
npm run build
```

## 📦 Dependencies

- Node.js 18.x
- Express
- TypeScript
- Shopify API
- Firebase Firestore (optional)
- Various security and utility packages

## 🛠️ Development

### Project Structure

```
src/
├── controllers/    # Request handlers
├── routes/         # API routes
├── services/       # Business logic
├── middleware/     # Express middleware
├── types/          # TypeScript type definitions
├── utils/          # Utility functions
└── index.ts        # Application entry point
```

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
PORT=3000
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SHOPIFY_STORE_URL=your-store.myshopify.com
NODE_ENV=development
```

### API Endpoints

- `GET /api/orders` - List and filter orders
- `GET /api/orders/:id` - Get single order
- `PUT /api/orders/:id/status` - Update order status
- `POST /api/orders/bulk` - Bulk operations
- `GET /health` - Health check endpoint

### Security

The backend implements several security measures:

- Helmet for security headers
- CORS configuration
- Rate limiting
- Input validation
- Error handling

## 📚 Documentation

For more information about the project, please refer to the main [PROJECT_OVERVIEW.md](../PROJECT_OVERVIEW.md) file.
