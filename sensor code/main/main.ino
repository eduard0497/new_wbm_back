
#include "LoRaWanMinimal_APP.h"
#include "Arduino.h"
#include <NewPing.h>
#include <Wire.h>               
#include "HT_SH1107Wire.h"

/*
 * set LoraWan_RGB to Active,the RGB active in loraWan
 * RGB red means sending;
 * RGB purple means joined done;
 * RGB blue means RxWindow1;
 * RGB yellow means RxWindow2;
 * RGB green means received done;
 */

//Set these OTAA parameters
static uint8_t devEui[] = { 0x0e, 0xe6, 0x82, 0xe9, 0x8d, 0xd5, 0x68, 0xec };
static uint8_t appEui[] = { 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 };
static uint8_t appKey[] = { 0xf6, 0xe9, 0x2e, 0x34, 0x1a, 0x36, 0x60, 0x80, 0xe1, 0x5c, 0x08, 0xdc, 0xe0, 0x5d, 0xd8, 0x39 };

uint16_t userChannelsMask[6]={ 0x00FF,0x0000,0x0000,0x0000,0x0000,0x0000 };

static uint8_t counter=0;

//define echo and trig pin remember:
//echO = One
//Trig = Two
#define ECHO_PIN GPIO1
#define TRIG_PIN GPIO2

//new sonar object with trigger, echo, and max dist (200cm)
NewPing sonar(TRIG_PIN, ECHO_PIN, 200);
//display object for debug display
SH1107Wire  display(0x3c, 500000, SDA, SCL ,GEOMETRY_128_64,GPIO10); // addr, freq, sda, scl, resolution, rst


///////////////////////////////////////////////////
//Some utilities for going into low power mode
TimerEvent_t sleepTimer;
//Records whether our sleep/low power timer expired
bool sleepTimerExpired;

static void wakeUp()
{
  sleepTimerExpired=true;
}

static void lowPowerSleep(uint32_t sleeptime)
{
  sleepTimerExpired=false;
  TimerInit( &sleepTimer, &wakeUp );
  TimerSetValue( &sleepTimer, sleeptime );
  TimerStart( &sleepTimer );
  //Low power handler also gets interrupted by other timers
  //So wait until our timer had expired
  while (!sleepTimerExpired) lowPowerHandler();
  TimerStop( &sleepTimer );
}

///////////////////////////////////////////////////
void setup() {
  //activate serial
	Serial.begin(115200);
  //activate display (most likely debug only)
  display.init();
  display.setTextAlignment(TEXT_ALIGN_LEFT);
  display.setFont(ArialMT_Plain_10);
  display.clear();
  display.drawString(0, 0, "Init Sensor...");
  display.display();

  if (ACTIVE_REGION==LORAMAC_REGION_US915) {
    //TTN uses sub-band 2 in AU915
    LoRaWAN.setSubBand2();
  }
 
  LoRaWAN.begin(LORAWAN_CLASS, ACTIVE_REGION);
  
  //Enable ADR
  LoRaWAN.setAdaptiveDR(true);

  // while (1) {
  //   Serial.print("Joining... ");
  //   LoRaWAN.joinOTAA(appEui, appKey, devEui);
  //   if (!LoRaWAN.isJoined()) {
  //     //In this example we just loop until we're joined, but you could
  //     //also go and start doing other things and try again later
  //     Serial.println("JOIN FAILED! Sleeping for 30 seconds");
  //     lowPowerSleep(30000);
  //   } else {
  //     Serial.println("JOINED");
  //     break;
  //   }
  // }
}

///////////////////////////////////////////////////
void loop()
{
  //Counter is just some dummy data we send for the example
  counter++; 


  //COLLECT SENSOR INFO
  //ping sonic sensor and record cm distance
  uint8_t dist = sonar.ping_cm();
  //ping the battery voltage
  uint16_t voltage = getBatteryVoltage();

  //bundle into a uint8_t array
  //first byte is distance, second and third byte are the two bytes of battery voltage
  uint8_t* voltageBytes = (uint8_t*)&voltage;
  uint8_t data[3];
  data[0] = dist;
  data[1] = voltageBytes[0];
  data[2] = voltageBytes[1];
  

  
  //In this demo we use a timer to go into low power mode to kill some time.
  //You might be collecting data or doing something more interesting instead.
  lowPowerSleep(15000);  

  //Now send the data. The parameters are "data size, data pointer, port, request ack"
  //Here we send confirmed packed (ACK requested) only for the first five (remember there is a fair use policy)
  bool requestack = (counter < 5);
  const char* result;
  if (LoRaWAN.send(3, data, 1, requestack)) {
    result = "SEND OK";
  } else {
    result = "SEND FAILED";
  }

  char message[40];
  sprintf(message, "cnt=%d, dst=%d, vlt=%d\n", counter, dist, voltage);
  Serial.print(message);
  Serial.println(result);

  display.clear();
  display.drawString(0, 0, message);
  display.drawString(0, 10, result);
  display.display();
}

///////////////////////////////////////////////////
//Example of handling downlink data
void downLinkDataHandle(McpsIndication_t *mcpsIndication)
{
  Serial.printf("Received downlink: %s, RXSIZE %d, PORT %d, DATA: ",mcpsIndication->RxSlot?"RXWIN2":"RXWIN1",mcpsIndication->BufferSize,mcpsIndication->Port);
  for(uint8_t i=0;i<mcpsIndication->BufferSize;i++) {
    Serial.printf("%02X",mcpsIndication->Buffer[i]);
  }
  Serial.println();
}
