# Inventory Management System

A modern, full-stack inventory management system built with Next.js, TypeScript, and Supabase.

## Features

- **Product Management**: Add, edit, and delete products with detailed information
- **Stock Management**: Track inventory levels, low stock alerts, and stock movements
- **Sales Management**: Record sales transactions and generate reports
- **Shipment Management**: Track incoming and outgoing shipments
- **Dashboard & Reports**: Comprehensive analytics and reporting dashboard
- **Responsive Design**: Mobile-first design that works on all devices

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **State Management**: React hooks and context
- **Package Manager**: pnpm

## Getting Started

### Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm
- Supabase account

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd inventory-system
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Configure your Supabase credentials in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

5. Run the database setup scripts in your Supabase SQL editor:
   - `scripts/01-create-tables.sql`
   - `scripts/02-seed-data.sql`

6. Start the development server:
```bash
pnpm dev
```

7. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
inventory-system/
├── app/                    # Next.js app directory
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── dashboard-reports.tsx
│   ├── product-management.tsx
│   ├── sales-management.tsx
│   ├── shipment-management.tsx
│   └── stock-management.tsx
├── lib/                   # Utility functions and configurations
│   └── supabase/         # Supabase client and server configurations
├── hooks/                 # Custom React hooks
├── scripts/               # Database setup scripts
└── public/                # Static assets
```

## Database Schema

The system uses the following main tables:
- `products`: Product information and details
- `inventory`: Stock levels and movements
- `sales`: Sales transactions
- `shipments`: Incoming and outgoing shipments
- `users`: User management and authentication

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues or have questions, please open an issue on GitHub.

## Screenshots

[Add screenshots of your application here]

---

Built with ❤️ using Next.js and Supabase
