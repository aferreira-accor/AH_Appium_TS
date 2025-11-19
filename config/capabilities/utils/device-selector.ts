import type { DeviceInfo } from '../api/browserstack-devices-api';

export interface DeviceSelectionOptions {
  devices: DeviceInfo[];
  sessionCount: number;
  platform: 'android' | 'ios';
  specificDeviceName?: string;
  useRandomSelection?: boolean;
}

export interface DeviceSelectionResult {
  selectedDevices: DeviceInfo[];
  devicesUsed: number;
}

/**
 * Select devices based on configuration and requirements
 */
export function selectDevices(options: DeviceSelectionOptions): DeviceSelectionResult {
  const { devices, sessionCount, platform, specificDeviceName, useRandomSelection } = options;
  
  if (!devices || devices.length === 0) {
    throw new Error(`No ${platform} devices available for selection`);
  }

  const devicesToUse = Math.min(sessionCount, devices.length);
  let finalDevices: DeviceInfo[];
  
  // If single session and specific device name is provided, use that device
  if (sessionCount === 1 && specificDeviceName?.trim()) {
    const specificDevice = devices.find(device => 
      device.name === specificDeviceName.trim()
    );
    
    if (specificDevice) {
      finalDevices = [specificDevice];
    } else {
      finalDevices = selectDevicesByStrategy(devices, useRandomSelection);
    }
  } else {
    finalDevices = selectDevicesByStrategy(devices, useRandomSelection);
  }
  
  const selectedDevices = finalDevices.slice(0, devicesToUse);
  
  return {
    selectedDevices,
    devicesUsed: devicesToUse
  };
}

/**
 * Select devices using random or sequential strategy
 */
function selectDevicesByStrategy(devices: DeviceInfo[], useRandom?: boolean): DeviceInfo[] {
  if (useRandom) {
    return [...devices].sort(() => Math.random() - 0.5);
  } else {
    return [...devices];
  }
}

/**
 * Get device selection configuration from environment variables
 */
export function getDeviceSelectionConfig(
  platform: 'android' | 'ios',
  buildType?: 'inhouse' | 'sandbox' | 'store'
) {
  // Use only build-type specific randomization env vars (no global fallback)
  let buildSpecificRandom: string | undefined;
  if (platform === 'ios') {
    buildSpecificRandom = buildType === 'store'
      ? process.env[`IOS_STORE_BS_RANDOM_DEVICES`]
      : buildType === 'sandbox'
        ? process.env[`IOS_SANDBOX_BS_RANDOM_DEVICES`]
        : undefined;
  } else {
    buildSpecificRandom = buildType === 'store'
      ? process.env[`ANDROID_STORE_BS_RANDOM_DEVICES`]
      : buildType === 'inhouse'
        ? process.env[`ANDROID_INHOUSE_BS_RANDOM_DEVICES`]
        : undefined;
  }

  const useRandomSelection = buildSpecificRandom === 'true';

  // Build-type specific device name (no generic fallbacks)
  let specificDeviceName: string | undefined;
  if (platform === 'ios') {
    if (buildType === 'store') specificDeviceName = process.env.IOS_STORE_BS_DEVICE_NAME;
    if (buildType === 'sandbox') specificDeviceName = process.env.IOS_SANDBOX_BS_DEVICE_NAME;
  } else {
    if (buildType === 'store') specificDeviceName = process.env.ANDROID_STORE_BS_DEVICE_NAME;
    if (buildType === 'inhouse') specificDeviceName = process.env.ANDROID_INHOUSE_BS_DEVICE_NAME;
  }

  return {
    specificDeviceName,
    useRandomSelection
  };
}