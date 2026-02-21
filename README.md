# ERP Desktop Application

A modern, professional desktop ERP application built with Electron, React, TypeScript, and SQLite.

## Features

### Core Modules ✅
- **Dashboard**: KPIs, charts, and analytics with date filtering
- **User & Role Management**: User creation, role assignment, permissions
- **Company Management**: Multi-company support with company profiles
- **Sales Module**: Customers and Sales Invoices with item management
- **Purchase Module**: Vendors and Purchase Invoices with item management
- **Inventory Module**: Items and Warehouses management
- **Accounting Module**: Chart of Accounts and Journal Entries
- **Expense Module**: Expense tracking with categories and status management
- **Reports Module**: Report selection interface (PDF/Excel export ready)

### Implemented Features ✅
- Modern UI with Ant Design
- Dark/Light mode toggle
- Responsive layout
- Secure IPC communication
- SQLite database with better-sqlite3
- Clean architecture separation
- Global search functionality
- Multi-company support
- Real-time dashboard updates
- Form validation
- CRUD operations for all modules

### Technical Features
- Modern UI with Ant Design
- Dark/Light mode support
- Responsive layout
- Secure IPC communication
- SQLite database with better-sqlite3
- Clean architecture separation
- Performance optimized for 100,000+ records
- Auto-save drafts
- Database backup/restore
- Global search (Ctrl+K)
- Keyboard shortcuts

## Prerequisites

- Node.js 18+ 
- npm or yarn

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

## Development

Run the application in development mode:

```bash
npm run dev
```

This will:
- Start the Vite dev server for the React frontend
- Compile TypeScript for the main process
- Launch Electron with hot reload

## Building

Build the application:

```bash
npm run build
```

This compiles both the main process and renderer process.

## Packaging

Create distributable packages:

```bash
npm run package
```

This uses electron-builder to create platform-specific installers.

## Project Structure

```
ERP/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── main.ts          # Window management
│   │   ├── preload.ts       # IPC bridge
│   │   └── database/        # Database schema and handlers
│   └── renderer/            # React frontend
│       ├── components/      # Reusable components
│       ├── pages/           # Page components
│       ├── context/         # React context
│       └── styles/          # CSS files
├── dist/                    # Compiled output
└── database/                # SQLite database files
```

## Database

The SQLite database is automatically created in the user data directory:
- Windows: `%APPDATA%/ERP Desktop/database/erp.db`
- macOS: `~/Library/Application Support/ERP Desktop/database/erp.db`
- Linux: `~/.config/ERP Desktop/database/erp.db`

## Security

- IPC communication is secured through context isolation
- SQL injection protection via parameterized queries
- No direct database access from renderer process
- Role-based access control

## Performance

- Indexed database tables for fast queries
- Lazy loading of heavy modules
- Optimized React rendering
- Efficient database operations

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
