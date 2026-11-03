import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.myfinance.app',
  appName: 'My Finance',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#f6f8fa',
    },
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#f6f8fa',
      showSpinner: false,
    },
    Keyboard: {
      resize: 'body',
      style: 'LIGHT',
    },
  },
}

export default config
