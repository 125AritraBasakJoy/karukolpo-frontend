# Karukolpo Frontend

Karukolpo is a premium E-commerce platform dedicated to showcasing and selling exquisite handcrafted goods. This Angular-based frontend application provides a seamless experience for both customers and administrators, combining modern aesthetics with robust management tools.

## 🌟 Key Features

### 🛍️ Customer Storefront
- **Dynamic Home Page**: Featuring curated hero sections, featured products, and seasonal categories.
- **Product Catalog**: Advanced filtering and search capabilities to explore handcrafted items.
- **Seamless Cart Experience**: Real-time cart management with local storage persistence.
- **Order Tracking**: Real-time status updates for placed orders.
- **Responsive Design**: Optimized for mobile, tablet, and desktop viewing.

### 🛡️ Admin Portal
- **Management Dashboard**: Visualized sales data and order statistics using Chart.js.
- **Product & Category Management**: Full CRUD operations for products and categories.
- **Inventory Tracking**: Real-time stock management with barcode generation (JsBarcode).
- **Order Fulfillment**: Complete order lifecycle management from pending to delivered.
- **Reporting Tools**: Export sales and inventory data to Excel (XLSX) or download invoices as PDF (jsPDF).
- **Maintenance Control**: Toggle site-wide maintenance mode for scheduled updates.

## 🏢 Frontend Architecture

<img width="1024" height="559" alt="image" src="https://github.com/user-attachments/assets/bb81bfac-80df-461b-928b-78bfaf5618c6" />

## 🛠️ Technologies Used

- **Framework**: [Angular 20+](https://angular.io/)
- **UI Components**: [PrimeNG](https://primeng.org/) & [PrimeFlex](https://primeflex.org/)
- **Data Grids**: [AG Grid](https://www.ag-grid.com/) for high-performance data handling.
- **Visualization**: [Chart.js](https://www.chartjs.org/) for business insights.
- **Reporting**:
  - [XLSX](https://github.com/SheetJS/sheetjs) for spreadsheet exports.
  - [jsPDF](https://github.com/parallax/jsPDF) and [jsPDF-AutoTable](https://github.com/simonbengtsson/jspdf-autotable) for PDF generation.
- **Utilities**: [RxJS](https://rxjs.dev/) for reactive state management.

## 🚀 Getting Started

### Prerequisites
- **Node.js**: [Download and install Node.js](https://nodejs.org/)
- **Angular CLI**: Install globally:
  ```bash
  npm install -g @angular/cli
  ```

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/karukolpo-frontend.git
   cd karukolpo-frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Development
Start the local server:
```bash
npm start
# OR
ng serve
```
Navigate to `http://localhost:4200/`.

Access the [**🚀 Admin Portal**](http://localhost:4200/admin) for management tasks.

## 📦 Build & Deployment

To build for production:
```bash
npm run build
```
Artifacts will be in the `dist/` directory.

## 🧪 Testing
Run unit tests via Karma:
```bash
npm test
```

## 📄 License
This project is proprietary and for internal use only.
