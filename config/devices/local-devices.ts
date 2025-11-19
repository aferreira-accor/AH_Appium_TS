// Local device configurations for both Android and iOS
// Add your actual device UDIDs and platform versions here

export const localDevices = {
  android: [
    {
      deviceName: "Google Pixel 8",
      udid: "37261FDJH0090W",
      platformVersion: "16.0"
    },
    {
      deviceName: "Google Pixel 9", 
      udid: "emulator-5554",
      platformVersion: "15.0"
    }
  ],
  ios: [
    {
      deviceName: "iPhone 16",
      udid: "B051E998-AF14-4DA1-81CF-EA31B522DF9B",
      platformVersion: "18.1"
    },
    {
      deviceName: "iPhone 13 mini",
      udid: "00008110-001A4DDE3A62401E", 
      platformVersion: "18.1.1"
    }
  ]
};

export interface LocalDeviceConfig {
  deviceName: string;
  udid: string;
  platformVersion: string;
}