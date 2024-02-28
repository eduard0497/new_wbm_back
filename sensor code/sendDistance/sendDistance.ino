
#include "LoRaWanMinimal_APP.h"
#include "Arduino.h"
#include <NewPing.h>

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

NewPing sonar(GPIO1, GPIO2, 200);

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
	Serial.begin(115200);

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

  uint8_t dist = sonar.ping_cm();
  
  //In this demo we use a timer to go into low power mode to kill some time.
  //You might be collecting data or doing something more interesting instead.
  lowPowerSleep(15000);  

  //Now send the data. The parameters are "data size, data pointer, port, request ack"
  Serial.printf("\nSending packet with counter=%d dist=%d\n", counter, dist);
  //Here we send confirmed packed (ACK requested) only for the first five (remember there is a fair use policy)
  bool requestack=counter<5?true:false;
  if (LoRaWAN.send(1, &dist, 1, requestack)) {
    Serial.println("Send OK");
  } else {
    Serial.println("Send FAILED");
  }
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
