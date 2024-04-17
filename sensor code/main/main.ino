//disable AT_SUPPORT in the tools menu
#include "LoRaWanMinimal_APP.h"
#include "Arduino.h"
#include <NewPing.h>

#define MAX_DISTANCE 400 // Maximum distance we want to ping for (in centimeters). Maximum sensor distance is rated at 400-500cm.
#define ECHO_PIN GPIO1
#define TRIG_PIN GPIO2

#define NODE_777

// LoRaWAN OTAA parameters
#ifdef NODE_444
static uint8_t devEui[] = { 0xef, 0x5c, 0xbc, 0xc4, 0xae, 0x2a, 0xa0, 0xb7 };
static uint8_t appEui[] = { 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 };
static uint8_t appKey[] = { 0x0c, 0x3c, 0xc7, 0x74, 0x41, 0x48, 0x98, 0x57, 0x6f, 0x25, 0x7f, 0x6d, 0x6d, 0xcd, 0x1d, 0xb2 };
#endif

#ifdef NODE_777
static uint8_t devEui[] = { 0x0e, 0xe6, 0x82, 0xe9, 0x8d, 0xd5, 0x68, 0xec };
static uint8_t appEui[] = { 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 };
static uint8_t appKey[] = { 0xf6, 0xe9, 0x2e, 0x34, 0x1a, 0x36, 0x60, 0x80, 0xe1, 0x5c, 0x08, 0xdc, 0xe0, 0x5d, 0xd8, 0x39 };
#endif

uint16_t userChannelsMask[6] = { 0x00FF, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000 };

//variable data
uint8_t distance = 0;
uint8_t batteryLevel = 0;

unsigned long globalSleepTime = 15000;
float maxVoltage = 4100.0f;
float minVoltage = 2930.0f;

//sleep timer data
TimerEvent_t sleepTimer;
bool sleepTimerExpired;

//ping object
NewPing sonar(TRIG_PIN, ECHO_PIN, MAX_DISTANCE);

void wakeUp() {
  sleepTimerExpired = true;
}

void lowPowerSleep(uint32_t sleeptime) {
  sleepTimerExpired = false;
  TimerInit(&sleepTimer, &wakeUp);
  TimerSetValue(&sleepTimer, sleeptime);
  TimerStart(&sleepTimer);
  while (!sleepTimerExpired) lowPowerHandler();
  TimerStop(&sleepTimer);
}

void setup() {
  Serial.begin(115200);

  if (ACTIVE_REGION == LORAMAC_REGION_US915) {
    LoRaWAN.setSubBand2();
  }

  LoRaWAN.begin(LORAWAN_CLASS, ACTIVE_REGION);
  LoRaWAN.setAdaptiveDR(true);

  while (1) {
    Serial.print("Joining... ");
    LoRaWAN.joinOTAA(appEui, appKey, devEui);
    if (!LoRaWAN.isJoined()) {
      Serial.println("JOIN FAILED! Sleeping for 30 seconds");
      lowPowerSleep(30000);
    } else {
      Serial.println("JOINED");
      break;
    }
  }
}

void loop() {
  delay(1500);

  float batteryVoltage = getBatteryVoltage(); // Get battery voltage
  float percent = (batteryVoltage - minVoltage) * 100.0f / (maxVoltage - minVoltage);
  batteryLevel = (uint8_t)percent;

  Serial.print("Battery: ");
  Serial.print(batteryVoltage);
  Serial.println(" mV");

  Serial.print("Ping: ");
  distance = sonar.ping_cm(); // Get distance in cm
  Serial.print(distance);
  Serial.println(" cm");

  // Prepare data array
  uint8_t data[2];
  data[0] = batteryLevel;
  data[1] = distance;

  Serial.printf("\nSending packet with battery level=%d and distance=%d\n", data[0], data[1]);

  // Send data
  if (LoRaWAN.send(sizeof(data), data, 1, true)) { // Modify as needed for ACK
    Serial.println("Send OK");
  } else {
    Serial.println("Send FAILED");
  }

  lowPowerSleep(globalSleepTime);
}

void downLinkDataHandle(McpsIndication_t *mcpsIndication) {
  Serial.printf("Received downlink: %s, RXSIZE %d, PORT %d, DATA: ", mcpsIndication->RxSlot ? "RXWIN2" : "RXWIN1", mcpsIndication->BufferSize, mcpsIndication->Port);
  for (uint8_t i = 0; i < mcpsIndication->BufferSize; i++) {
    Serial.printf("%02X", mcpsIndication->Buffer[i]);
  }
  Serial.println();

  // Check if we have at least one byte of data to read
  if (mcpsIndication->BufferSize > 0) {
    switch (mcpsIndication->Buffer[0]) {
      case 0x01:
        globalSleepTime = 10000; // Set sleep time to 10 seconds
        break;
      case 0x02:
        globalSleepTime = 20000; // Set sleep time to 20 seconds
        break;
      case 0x03:
        globalSleepTime = 30000; // Set sleep time to 30 seconds
        break;
      default:
        // If the data is not 01, 02, or 03, you might want to keep the sleep time unchanged, or set a default
        break;
    }
  }
}

