#include <Wire.h>               
#include "HT_SH1107Wire.h"
#include <NewPing.h>

#define ECHO_PIN GPIO1
#define TRIG_PIN GPIO2

SH1107Wire  display(0x3c, 500000, SDA, SCL ,GEOMETRY_128_64,GPIO10); // addr, freq, sda, scl, resolution, rst
NewPing sonar(TRIG_PIN, ECHO_PIN, 200);

void setup() {

  display.init();
  display.setTextAlignment(TEXT_ALIGN_LEFT);
  display.setFont(ArialMT_Plain_10);

  Serial.begin(115200);
}

void loop() {
  // put your main code here, to run repeatedly:
  int dist = sonar.ping_cm();
  char message[30];
  sprintf(message, "Distance: %d cm\n", dist);
  Serial.print(message);

  display.clear();
  display.drawString(0, 0, message);
  display.display();

  delay(1000);

}
