import { environment } from './src/environments/environment';

async function testApi() {
    const url = `${environment.baseUrl}/products?skip=0&limit=10`;
    console.log(`Testing API: ${url}`);
    try {
        const response = await fetch(url);
        console.log(`Status: ${response.status}`);
        const data = await response.json();
        console.log(`Data type: ${Array.isArray(data) ? 'Array' : typeof data}`);
        console.log(`First item:`, data[0]);
    } catch (err) {
        console.error(`Error:`, err);
    }
}

// Note: environment needs to be available.
// Since I can't run TS easily here, I'll just check if I can grep for the base URL.
