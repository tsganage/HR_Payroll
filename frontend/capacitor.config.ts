import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.novota.hrpayroll',
    appName: 'HR Payroll',
    webDir: 'dist',
    server: {
        androidScheme: 'https',
    },
    plugins: {
        Geolocation: {
            // Required for background geo-fence checks
        },
        Camera: {
            // Selfie attendance
        },
    },
};

export default config;
