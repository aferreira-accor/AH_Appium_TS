interface DeviceConfig {
  deviceName: string;
  udid: string;
  platformVersion: string;
}

export const filterDevicesByName = <T extends DeviceConfig>(
  devices: T[],
  deviceName?: string
): T[] => {
  if (!deviceName) {
    throw new Error('DEVICE_NAME environment variable is required. Available devices: ' + 
      devices.map(d => d.deviceName).join(', '));
  }
  
  // Exact match only - return the specific device requested
  const filteredDevices = devices.filter(device => device.deviceName === deviceName);
  
  if (filteredDevices.length === 0) {
    throw new Error(`Device with name "${deviceName}" not found in configuration. Available devices: ` + 
      devices.map(d => d.deviceName).join(', '));
  }
  
  // Return only the exact match(es) - should be 1 for unique device names
  return filteredDevices;
};