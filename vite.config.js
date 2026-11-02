import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    base: './',
    plugins: [react()],
    server: {
        port: 3000,
        host: true,
        allowedHosts: [
            "monogamy-reforest-boaster.ngrok-free.dev"
        ],
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:5001',
                changeOrigin: true,
            },
            '/socket.io': {
                target: 'http://127.0.0.1:5001',
                ws: true,
                changeOrigin: true,
            }
        }
    }
})
