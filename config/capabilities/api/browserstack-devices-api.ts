import 'dotenv/config';
import axios from 'axios';

// Constants
const API_TIMEOUT = 10000;

// Types
export interface DeviceInfo {
  name: string;
  version: string;
}

export interface BrowserStackDevice {
  os: string;
  os_version: string;
  device: string;
  realMobile: boolean;
}

/**
 * Create authenticated BrowserStack API client
 */
function createBrowserStackClient() {
  const username = process.env.BROWSERSTACK_USERNAME;
  const accessKey = process.env.BROWSERSTACK_ACCESS_KEY;

  if (!username || !accessKey) {
    throw new Error(`BrowserStack credentials not found in environment variables. Username: ${!!username}, AccessKey: ${!!accessKey}`);
  }

  return axios.create({
    baseURL: 'https://api-cloud.browserstack.com',
    auth: {
      username,
      password: accessKey
    },
    timeout: API_TIMEOUT,
    headers: { 
      'Content-Type': 'application/json',
      'User-Agent': 'AH_Appium_TS/1.0.0'
    }
  });
}

/**
 * Fetch devices from BrowserStack API with error handling
 */
async function fetchDevicesFromAPI(): Promise<BrowserStackDevice[]> {
  const client = createBrowserStackClient();
  
  try {
    console.log('Making API request to BrowserStack for devices...');
    const { data: devices } = await client.get<BrowserStackDevice[]>('/app-automate/devices.json');
    
    if (!devices || devices.length === 0) {
      throw new Error('No devices found on BrowserStack');
    }
    
    console.log(`Found ${devices.length} total devices from BrowserStack`);
    return devices;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 0;
      const statusText = error.response?.statusText || 'Unknown';
      const message = error.response?.data?.message || error.message;
      
      console.error(`BrowserStack Devices API error: ${status} ${statusText} - ${message}`);
      
      if (status === 401) {
        throw new Error('BrowserStack authentication failed. Please check your BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY.');
      } else if (status === 429) {
        throw new Error('BrowserStack API rate limit exceeded. Please try again later.');
      } else if (status >= 500) {
        throw new Error('BrowserStack API server error. Please try again later.');
      } else {
        throw new Error(`BrowserStack Devices API error: ${status} - ${message}`);
      }
    }
    
    console.error(`Failed to fetch devices from BrowserStack:`, error);
    throw error;
  }
}

/**
 * Filter devices by platform (Android/iOS)
 */
function filterDevicesByPlatform(devices: BrowserStackDevice[], platform: 'android' | 'ios'): BrowserStackDevice[] {
  const platformDevices = devices.filter(device => {
    const osName = device.os.toLowerCase();
    
    // Filter by platform
    const isPlatformMatch = platform === 'android' ? osName === 'android' : osName === 'ios';
    
    return isPlatformMatch;
  });
  
  if (platformDevices.length === 0) {
    const availableOS = [...new Set(devices.map(d => d.os))].join(', ');
    throw new Error(`No ${platform} devices found on BrowserStack. Available OS: ${availableOS}`);
  }
  
  return platformDevices;
}

/**
 * Sort devices by OS version (newest first)
 */
function sortDevicesByVersion(devices: BrowserStackDevice[]): BrowserStackDevice[] {
  return devices.sort((a, b) => {
    // Parse version numbers for proper numeric sorting
    const parseVersion = (version: string): number[] => {
      return version.split('.').map(part => parseFloat(part) || 0);
    };
    
    const versionA = parseVersion(a.os_version);
    const versionB = parseVersion(b.os_version);
    
    // Compare version parts
    for (let i = 0; i < Math.max(versionA.length, versionB.length); i++) {
      const partA = versionA[i] || 0;
      const partB = versionB[i] || 0;
      
      if (partA !== partB) {
        return partB - partA; // Newer version first
      }
    }
    
    // If versions are identical, sort by device name alphabetically
    return a.device.localeCompare(b.device);
  });
}

/**
 * Convert BrowserStack device to DeviceInfo format
 */
function convertToDeviceInfo(device: BrowserStackDevice): DeviceInfo {
  return {
    name: device.device,
    version: device.os_version
  };
}

/**
 * Fetch all devices for a platform
 */
export async function fetchDevices(platform: 'android' | 'ios'): Promise<DeviceInfo[]> {
  console.log(`🔄 Fetching ${platform} devices from BrowserStack...`);
  
  const allDevices = await fetchDevicesFromAPI();
  const platformDevices = filterDevicesByPlatform(allDevices, platform);
  const sortedDevices = sortDevicesByVersion(platformDevices);
  
  console.log(`Found ${platformDevices.length} ${platform} devices`);
  
  return sortedDevices.map(convertToDeviceInfo);
}

/**
 * Get Android devices (convenience function)
 */
export async function getAndroidDevices(): Promise<DeviceInfo[]> {
  return await fetchDevices('android');
}

/**
 * Get iOS devices (convenience function)  
 */
export async function getIOSDevices(): Promise<DeviceInfo[]> {
  return await fetchDevices('ios');
}