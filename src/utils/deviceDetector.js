export const hasCamera = async () => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.some(device => device.kind === 'videoinput');
  } catch (error) {
    console.warn('Error checking for camera:', error);
    return false;
  }
}; 