import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        host: true,
        port: 5174,
        proxy: {
            '/api': {
                target: 'http://localhost:8002',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, ''),
            },
        },
    },
    preview: {
        host: true,
        port: 4174,
    },
});
