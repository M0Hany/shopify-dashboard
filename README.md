# Shopify Order Management Dashboard

A modern, responsive dashboard for managing Shopify orders with advanced filtering, sorting, and timeline tracking capabilities.

## Features

- 📊 Visual grid layout with order cards
- 🔍 Advanced filtering and search
- ⏰ Order timeline tracking
- 📅 Custom due date management
- 🏷️ Status management (Pending, Processing, Shipped, Delivered)
- 📱 Responsive design
- 🌙 Cairo timezone support

## Tech Stack

- **Frontend:**

  - React 18
  - TypeScript
  - TailwindCSS
  - React Query
  - HeadlessUI
  - Heroicons

- **Backend:**
  - Node.js
  - Express
  - Shopify API

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm or yarn
- Shopify store with admin access

### Installation

1. Clone the repository:

```bash
git clone https://github.com/M0Hany/shopify-dashboard.git
cd shopify-dashboard
```

2. Install dependencies:

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

3. Set up environment variables:

```bash
# Backend .env
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SHOPIFY_STORE_URL=your-store.myshopify.com

# Frontend .env
VITE_API_URL=http://localhost:3000
```

4. Start the development servers:

```bash
# Start backend server
cd backend
npm run dev

# Start frontend server
cd frontend
npm run dev
```

## Usage

1. **Order Management:**

   - View all orders in a grid layout
   - Filter orders by status
   - Search by order number or customer details

2. **Timeline Tracking:**

   - View order timelines
   - Set custom due dates
   - Track days remaining

3. **Bulk Actions:**
   - Select multiple orders
   - Export delivery forms
   - Update order statuses

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Deployment

The application is automatically deployed to GitHub Pages when changes are pushed to the main branch. The deployment process includes:

1. Running tests
2. Building the application
3. Deploying to GitHub Pages

To manually trigger a deployment:

1. Go to the Actions tab in your GitHub repository
2. Select the "Deploy to GitHub Pages" workflow
3. Click "Run workflow"

The deployed application will be available at: `https://[your-github-username].github.io/shopify-dashboard/`

### Environment Variables

Make sure to set up the following secrets in your GitHub repository:

- `VITE_API_URL`: Your API endpoint URL
