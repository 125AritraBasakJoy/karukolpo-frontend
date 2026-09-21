import { Injectable, signal } from '@angular/core';

export interface BluetoothPrintResult {
  success: boolean;
  message?: string;
}

/** Well-known BLE service UUIDs used by thermal POS printers. */
const KNOWN_BLE_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard POS Printer Service
  '0000ff00-0000-1000-8000-00805f9b34fb', // ESC/POS BLE Service
  '0000fee7-0000-1000-8000-00805f9b34fb', // Common Thermal POS Service
  '0000ffe0-0000-1000-8000-00805f9b34fb', // Generic BLE serial / HMSoft
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC transparent UART
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2'  // Serial BLE
];

const ENDPOINTS_STORAGE_KEY = 'karukolpo.thermalPrinterEndpoints';

interface StoredEndpoints {
  serviceUuid: string;
  characteristicUuid: string;
}

/**
 * Central service that owns the thermal printer connection.
 *
 * Web Bluetooth's `requestDevice()` ALWAYS shows the pairing chooser. To pair
 * only once we:
 *   1. Reuse the live GATT connection between prints (never disconnect).
 *   2. Otherwise silently reconnect to an already-paired printer via
 *      `navigator.bluetooth.getDevices()` (no chooser, works across reloads).
 *   3. Only show the chooser the very first time (no remembered printer yet).
 *
 * The same "silent-first" strategy is applied to the Web Serial and WebUSB
 * fallbacks via `getPorts()` / `getDevices()`.
 */
@Injectable({ providedIn: 'root' })
export class BluetoothPrinterService {
  /** True while a print job is being sent. */
  readonly printing = signal(false);
  /** True while a live GATT connection to the printer exists. */
  readonly printerConnected = signal(false);
  /** Name of the currently connected / remembered printer, if any. */
  readonly printerName = signal<string | null>(null);

  private bleDevice: any = null;
  private writeCharacteristic: any = null;
  private serialPort: any = null;
  private readonly serialBaudRate = 9600;

  /**
   * Sends raw ESC/POS bytes to the thermal printer.
   * Shows the browser pairing chooser only when no printer has been paired yet.
   */
  async print(data: Uint8Array): Promise<BluetoothPrintResult> {
    if (typeof navigator === 'undefined') {
      return { success: false, message: 'Not running in a browser environment.' };
    }
    if (this.printing()) {
      return { success: false, message: 'A print job is already in progress.' };
    }
    this.printing.set(true);
    try {
      // 1. Web Bluetooth (BLE) — preferred
      if ('bluetooth' in navigator) {
        const res = await this.printViaBle(data);
        if (res) return res;
      }
      // 2. Web Serial (paired Bluetooth COM / USB serial)
      if ('serial' in navigator) {
        const res = await this.printViaSerial(data);
        if (res) return res;
      }
      // 3. WebUSB (native USB class printers)
      if ('usb' in navigator) {
        return await this.printViaUsb(data);
      }
      return {
        success: false,
        message: 'Your browser does not support Bluetooth printing. Please use Google Chrome or Microsoft Edge.'
      };
    } finally {
      this.printing.set(false);
    }
  }

  /** Forgets the remembered BLE printer (revokes permission + clears cache). */
  async forgetDevice(): Promise<void> {
    const device = this.bleDevice;
    this.resetBle();
    try {
      await device?.forget?.();
    } catch {
      // forget() not supported / already forgotten — ignore
    }
  }

  // ------------------------------------------------------------------ BLE

  private async printViaBle(data: Uint8Array): Promise<BluetoothPrintResult | null> {
    const bluetooth = (navigator as any).bluetooth;

    // Fast path: live connection from a previous print
    if (this.writeCharacteristic) {
      try {
        await this.writeChunks(data);
        return { success: true };
      } catch {
        this.resetBle();
      }
    }

    // Silent path: reconnect to an already-paired printer (NO chooser).
    let remembered: any[] = [];
    try {
      remembered = bluetooth.getDevices ? await bluetooth.getDevices() : [];
    } catch {
      remembered = [];
    }

    for (const device of remembered) {
      const { char, reachable } = await this.connectDevice(device);
      if (char) {
        try {
          await this.writeChunks(data);
          return { success: true };
        } catch {
          this.resetBle();
          return { success: false, message: 'Lost connection to the printer while printing. Please try again.' };
        }
      }
      if (reachable) {
        // Connected, but the device cannot receive print data (wrong device
        // paired previously) — forget it so the chooser shows again next time.
        this.forgetBleDevice(device);
      }
    }

    if (remembered.length) {
      // We already have permission for a printer — it is just off / out of
      // range. Never re-open the chooser in this situation.
      return {
        success: false,
        message: 'Could not reach the paired printer. Make sure it is switched on and in range, then try again.'
      };
    }

    // First-time path: show the chooser ONCE and remember the device.
    let device: any;
    try {
      device = await bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: KNOWN_BLE_SERVICES
      });
    } catch (err: any) {
      if (err?.name === 'NotFoundError' || err?.name === 'AbortError') {
        return { success: false, message: 'Bluetooth device selection was cancelled.' };
      }
      return { success: false, message: err?.message || 'Bluetooth pairing failed.' };
    }

    const { char, reachable } = await this.connectDevice(device);
    if (!char) {
      if (reachable) {
        this.forgetBleDevice(device);
        return { success: false, message: 'The selected device cannot receive print data. Please pair the thermal printer.' };
      }
      return {
        success: false,
        message: 'Could not connect to the selected printer. Make sure it is switched on, then try again.'
      };
    }

    try {
      await this.writeChunks(data);
      return { success: true };
    } catch {
      this.resetBle();
      return { success: false, message: 'Lost connection to the printer while printing. Please try again.' };
    }
  }

  /**
   * Connects to a BLE device and locates its writable characteristic.
   * `reachable: false` means the device could not be connected (off / away);
   * `reachable: true` with `char: null` means connected but not a printer.
   */
  private async connectDevice(device: any): Promise<{ char: any; reachable: boolean }> {
    try {
      if (!device?.gatt) return { char: null, reachable: false };
      const server = await this.withTimeout<any>(device.gatt.connect(), 10000);
      const char = await this.findWriteCharacteristic(server);
      if (!char) {
        try { server.disconnect(); } catch { /* ignore */ }
        return { char: null, reachable: true };
      }
      this.bleDevice = device;
      this.writeCharacteristic = char;
      this.printerConnected.set(true);
      this.printerName.set(device.name || 'Thermal Printer');
      this.attachDisconnectListener(device);
      return { char, reachable: true };
    } catch {
      return { char: null, reachable: false };
    }
  }

  private attachDisconnectListener(device: any): void {
    if (device.__kkListenerAttached) return;
    device.__kkListenerAttached = true;
    device.addEventListener?.('gattserverdisconnected', () => {
      if (this.bleDevice === device) this.resetBle();
    });
  }

  private async findWriteCharacteristic(server: any): Promise<any> {
    // 1. Endpoints remembered from a previous session — fastest reconnect
    const stored = this.readStoredEndpoints();
    if (stored) {
      try {
        const service = await server.getPrimaryService(stored.serviceUuid);
        const char = await service.getCharacteristic(stored.characteristicUuid);
        if (char?.properties?.write || char?.properties?.writeWithoutResponse) return char;
      } catch { /* fall through to discovery */ }
    }

    // 2. Known thermal printer services
    for (const serviceUuid of KNOWN_BLE_SERVICES) {
      try {
        const service = await server.getPrimaryService(serviceUuid);
        const char = await this.firstWritableCharacteristic(service);
        if (char) return char;
      } catch { /* service not on this device */ }
    }

    // 3. Full scan of the allowed services
    try {
      const services = await server.getPrimaryServices();
      for (const service of services) {
        const char = await this.firstWritableCharacteristic(service);
        if (char) return char;
      }
    } catch { /* ignore */ }

    return null;
  }

  private async firstWritableCharacteristic(service: any): Promise<any> {
    try {
      const characteristics = await service.getCharacteristics();
      for (const ch of characteristics) {
        if (ch.properties?.write || ch.properties?.writeWithoutResponse) {
          this.persistEndpoints(service.uuid, ch.uuid);
          return ch;
        }
      }
    } catch { /* ignore */ }
    return null;
  }

  private async writeChunks(data: Uint8Array): Promise<void> {
    const char = this.writeCharacteristic;
    if (!char) throw new Error('No printer connection.');
    // Safe 100-byte chunks to avoid Bluetooth MTU overflows
    const chunkSize = 100;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      if (char.writeValueWithoutResponse) {
        await char.writeValueWithoutResponse(chunk);
      } else {
        await char.writeValue(chunk);
      }
      await new Promise(r => setTimeout(r, 25));
    }
  }

  private resetBle(): void {
    this.bleDevice = null;
    this.writeCharacteristic = null;
    this.printerConnected.set(false);
  }

  private forgetBleDevice(device: any): void {
    try { device?.forget?.(); } catch { /* ignore */ }
  }

  // --------------------------------------------------------------- Serial

  private async printViaSerial(data: Uint8Array): Promise<BluetoothPrintResult | null> {
    const serial = (navigator as any).serial;

    let port = this.serialPort;
    if (!port) {
      // Silent-first: reuse an already-granted port (no chooser)
      let ports: any[] = [];
      try {
        ports = serial.getPorts ? await serial.getPorts() : [];
      } catch { /* ignore */ }
      if (ports.length) {
        port = ports[0];
        this.serialPort = port;
      }
    }

    if (!port) {
      try {
        port = await serial.requestPort();
        this.serialPort = port;
      } catch (err: any) {
        if (err?.name === 'NotFoundError' || err?.name === 'AbortError') {
          return { success: false, message: 'Printer selection was cancelled.' };
        }
        console.warn('Web Serial port request failed, trying USB fallback...', err);
        return null; // fall through to USB
      }
    }

    try {
      if (!port.writable) {
        await port.open({ baudRate: this.serialBaudRate });
      }
      const writer = port.writable.getWriter();
      await writer.write(data);
      writer.releaseLock();
      try { await port.close(); } catch { /* ignore */ }
      return { success: true };
    } catch (err: any) {
      if (err?.name === 'NotFoundError' || err?.name === 'AbortError') {
        return { success: false, message: 'Printer selection was cancelled.' };
      }
      console.warn('Web Serial attempt encountered error, trying USB fallback...', err);
      try { if (port.writable) await port.close(); } catch { /* ignore */ }
      return null; // fall through to USB
    }
  }

  // ------------------------------------------------------------------ USB

  private async printViaUsb(data: Uint8Array): Promise<BluetoothPrintResult> {
    const usb = (navigator as any).usb;

    let device: any = null;
    // Silent-first: reuse an already-granted device (no chooser)
    try {
      const granted: any[] = usb.getDevices ? await usb.getDevices() : [];
      if (granted.length) device = granted[0];
    } catch { /* ignore */ }

    if (!device) {
      try {
        device = await usb.requestDevice({ filters: [] });
      } catch (err: any) {
        if (err?.name === 'NotFoundError' || err?.name === 'AbortError') {
          return { success: false, message: 'Device selection was cancelled.' };
        }
        return { success: false, message: err?.message || 'Failed to print.' };
      }
    }

    try {
      await device.open();
      if (device.configuration === null) {
        await device.selectConfiguration(1);
      }
      let targetInterfaceNumber: number | null = null;
      let targetEndpointNumber: number | null = null;

      for (const iface of (device.configuration?.interfaces || [])) {
        const alternate = iface.alternates ? iface.alternates[0] : iface.alternate;
        if (alternate && alternate.endpoints) {
          const outEp = alternate.endpoints.find((ep: any) => ep.direction === 'out');
          if (outEp) {
            targetInterfaceNumber = iface.interfaceNumber;
            targetEndpointNumber = outEp.endpointNumber;
            break;
          }
        }
      }

      if (targetInterfaceNumber !== null && targetEndpointNumber !== null) {
        await device.claimInterface(targetInterfaceNumber);
        await device.transferOut(targetEndpointNumber, data);
        await device.close();
        return { success: true };
      }
      await device.close();
      return { success: false, message: 'No suitable print endpoint found on selected device.' };
    } catch (err: any) {
      if (err?.name === 'NotFoundError' || err?.name === 'AbortError') {
        return { success: false, message: 'Device selection was cancelled.' };
      }
      return { success: false, message: err?.message || 'Failed to print.' };
    }
  }

  // -------------------------------------------------------------- helpers

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: any;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Timed out')), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
  }

  private readStoredEndpoints(): StoredEndpoints | null {
    try {
      const raw = localStorage.getItem(ENDPOINTS_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.serviceUuid && parsed?.characteristicUuid) return parsed;
    } catch { /* ignore */ }
    return null;
  }

  private persistEndpoints(serviceUuid: string, characteristicUuid: string): void {
    try {
      localStorage.setItem(ENDPOINTS_STORAGE_KEY, JSON.stringify({ serviceUuid, characteristicUuid }));
    } catch { /* ignore */ }
  }
}
