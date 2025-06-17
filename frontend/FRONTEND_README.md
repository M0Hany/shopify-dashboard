# OCD Crochet Dashboard - Frontend

This is the frontend application for the OCD Crochet Shopify Order Management Dashboard, built with React, TypeScript, and Vite.

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

- React 18.2.0
- TypeScript
- TailwindCSS
- React Query
- React Router
- HeadlessUI
- Heroicons

## 🛠️ Development

### Project Structure

```
src/
├── components/     # Reusable UI components
├── pages/         # Page components
├── hooks/         # Custom React hooks
├── services/      # API services
├── types/         # TypeScript type definitions
├── utils/         # Utility functions
└── App.tsx        # Main application component
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
VITE_API_URL=http://localhost:3000
VITE_SHOPIFY_STORE_URL=your-store.myshopify.com
VITE_SHOPIFY_API_KEY=your_api_key
```

### ESLint Configuration

The project uses ESLint with TypeScript and React plugins. Configuration can be found in `.eslintrc.json`.

### Prettier Configuration

Code formatting is handled by Prettier. Configuration can be found in `.prettierrc`.

## 📚 Documentation

For more information about the project, please refer to the main [PROJECT_OVERVIEW.md](../PROJECT_OVERVIEW.md) file.

## 🚀 Deployment

The frontend is automatically deployed to GitHub Pages when changes are pushed to the main branch. You can access the live version at:
https://m0hany.github.io/shopify-dashboard/
