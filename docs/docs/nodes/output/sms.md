---
title: SMS Node
---

:::info PRO Feature
This feature is available in the <span className="pro-badge">PRO</span> subscription tier. [Learn more about PRO](https://pricing.agentic-signal.com/)
:::

# SMS Node

The **SMS Node** allows you to send SMS messages using a Waveshare SIM7600G-H 4G dongle connected to your server or PC via serial port.

![SMS Node](/img/nodes/sms-preview.webp)

:::warning Important
If you are running **Agentic Signal** from Docker (see [Quick Start guide](../../getting-started/web-app/quick-start?activeTab=docker)), only serial ports explicitly mapped from the host into the container will be discoverable and usable by the SMS Node.


**TIP:** For the SMS node to work, you must select the serial port that corresponds to the modem's AT command interface. On Windows, this is usually the port with `AT` in its name (e.g., `Simcom HS-USB AT PORT 9001 (COM13)`).

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import { NodeSchemaTab } from '@site/src/components/NodeSchemaTab';

<Tabs>
    <TabItem value="windows" label="Windows" default>
        You only need to forward the COM port that corresponds to the modem's AT interface (the one with `AT` in its name). For example:

        ```sh
        docker run --device='//./COM13' ...
        ```
    </TabItem>
    <TabItem value="linux" label="Linux">
        Forward only the device that provides the AT command interface (e.g., `/dev/ttyUSB2`):

        ```sh
        docker run --device=/dev/ttyUSB2 ...
        ```
    </TabItem>
    <TabItem value="macos" label="macOS">
        Forward the serial device path for the modem's AT interface, usually `/dev/tty.usbmodem*` or `/dev/tty.SIMCOM*`.

        ```sh
        docker run --device=/dev/tty.usbmodem14101 ...
        ```
    </TabItem>
</Tabs>
:::

## Configuration

The SMS Node is configured using the serial port and optional baud rate settings. The node also validates the upstream JSON payload before sending the message.

<Tabs>
    <TabItem value="settings" label="Node Settings" default>
        Configure the connected modem by selecting the correct `serial port` and, if needed, the `baud rate`.

        ![SMS Node Configuration](/img/nodes/sms-params.webp)
    </TabItem>
    <TabItem value="input-format" label="Expected Input Format">
        The node expects a JSON object from upstream nodes matching the following schema:

        <div className="fullWidthTable">

        | Field         | Type   | Required | Description                                                                                  |
        |---------------|--------|----------|----------------------------------------------------------------------------------------------|
        | `phoneNumber` | string | Yes      | Recipient phone number in E.164 format (e.g. `+12025551234`).                                 |
        | `message`     | string | Yes      | SMS message text, max 160 characters for a single SMS.                                       |

        </div>

        ![SMS Node Configuration](/img/nodes/sms-params.webp)
    </TabItem>
    <TabItem value="config-schema" label="Configuration Schema">
        <NodeSchemaTab nodeType="sms" />
    </TabItem>
</Tabs>

---

## Features
- Sends SMS to any phone number using a 4G dongle
- Supports serial port autodiscovery (dropdown selection)
- Configurable baud rate
- Input validation and error reporting

## PREREQUISITES
- A Waveshare SIM7600G-H 4G dongle (or compatible)
- Install the Waveshare driver if needed for your OS (double-check with https://www.waveshare.com/wiki/SIM7600G-H_4G_DONGLE):
  - Windows: [`https://files.waveshare.com/upload/2/24/SIMCOM_Windows_USB_Drivers_V1.0.2.zip`](https://files.waveshare.com/upload/2/24/SIMCOM_Windows_USB_Drivers_V1.0.2.zip)
  - Linux: [`https://files.waveshare.com/upload/4/42/SIM7X00-Driver.7z`](https://files.waveshare.com/upload/4/42/SIM7X00-Driver.7z)
- SIM card with SMS capability
- The dongle must be connected to your server/PC and recognized as a serial port (e.g. `/dev/ttyUSB2` on Linux, `COM3` on Windows)
- SIM PIN must be unlocked by the OS or modem manager before use

## How it works
1. The node opens the selected serial port and communicates with the dongle using AT commands.
2. It sends the SMS using the standard GSM AT command sequence (`AT+CMGF=1`, `AT+CMGS=...`).
3. Errors (e.g. port not found, SIM locked, network issues) are reported in the logs dialog.

## Notes
- The SIM PIN must be unlocked by your OS (Windows Cellular settings, Linux ModemManager, etc) before the node can send SMS.
- If your setup requires entering the PIN manually, unlock the SIM before using this node.
- Serial port autodiscovery is available, but you can always enter a port manually if needed.

## Troubleshooting
- If you see errors about the port or SIM, check that the dongle is connected and the SIM is unlocked.
- On Linux, you may need to add your user to the `dialout` group or run as root to access serial ports.
- On Windows, ensure the correct COM port is selected and not in use by another program.
