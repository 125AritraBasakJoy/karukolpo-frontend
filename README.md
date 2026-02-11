# Karukolpo Frontend

This project is an Angular application for the Karukolpo platform.

## Prerequisites

Before you begin, ensure you have met the following requirements:
*   **Node.js**: Make sure you have Node.js installed. You can download it from [nodejs.org](https://nodejs.org/).
*   **Angular CLI**: Install the Angular CLI globally if you haven't already.
    ```bash
    npm install -g @angular/cli
    ```

## Getting Started

To get a local copy up and running, follow these simple steps.

### 1. Clone the Repository

Open your terminal or command prompt and run the following command to clone the repository:

```bash
git clone https://github.com/your-username/karukolpo-frontend.git
cd karukolpo-frontend
```

### 2. Install Dependencies

Install the project dependencies using npm:

```bash
npm install
```

### 3. Run the Application

Start the development server:

```bash
npm start
```
OR
```bash
ng serve
```

Navigate to `http://localhost:4200/` in your browser. The application will automatically reload if you change any of the source files.

### Admin Portal

To access the admin login page, navigate to:
[http://localhost:4200/admin](http://localhost:4200/admin)

## Build

To build the project for production:

```bash
npm run build
```

The build artifacts will be stored in the `dist/` directory.

## Running Tests

To execute the unit tests via [Karma](https://karma-runner.github.io):

```bash
npm test
```

## Technologies Used

*   [Angular](https://angular.io/)
*   [PrimeNG](https://primeng.org/) - UI Component Library
*   [AG Grid](https://www.ag-grid.com/) - Data Grid
*   [Chart.js](https://www.chartjs.org/) - Charting Library
*   [XLSX](https://github.com/SheetJS/sheetjs) - Spreadsheet Parser and Writer
