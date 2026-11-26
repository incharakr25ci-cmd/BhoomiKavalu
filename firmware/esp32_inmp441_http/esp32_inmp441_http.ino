/*
 * ==============================================================================
 * BHOOMI KAVALU - ESP32 + INMP441 I2S ACOUSTIC SENSOR NODE (HTTP CLIENT)
 * ==============================================================================
 * Architecture:
 *   ESP32 + INMP441 Microphone  --->  Wi-Fi (HTTP POST)  --->  Python FastAPI Backend
 *   Backend ML (2-Class: Elephant/Tiger)  --->  Firebase Realtime DB  --->  React Dashboard
 *
 * Requirements:
 *   - Arduino ESP32 Core 3.3.12 / 2.x compatible.
 *   - Completely removes old UDP approach (zero UDP code).
 *   - High-fidelity 22050 Hz 16-bit mono sampling matching ML training pipeline.
 *   - Streams structured 3-second WAV audio chunks via HTTP POST with automatic retry.
 *   - LED status indicators & serial diagnostics.
 * ==============================================================================
 * WIRING DIAGRAM (INMP441 to ESP32 DevKit):
 *   INMP441 Pin     ESP32 Pin      Description
 *   -------------------------------------------------
 *   VDD             3.3V           Power (3.3V ONLY, DO NOT USE 5V)
 *   GND             GND            Ground
 *   SD (DIN)        GPIO 32        Serial Data
 *   WS (LRCLK)      GPIO 15        Word Select / Left-Right Clock
 *   SCK (BCLK)      GPIO 14        Bit Clock
 *   L/R             GND            Channel Select (GND = Left channel)
 * ==============================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include "driver/i2s.h"

// ================= USER CONFIGURATION =================
// Replace with your local Wi-Fi credentials
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Replace with your laptop/server IP running Bhoomi Kavalu backend (e.g. 192.168.1.100)
const char* SERVER_HOST   = "192.168.1.100";
const uint16_t SERVER_PORT = 8000;
const char* NODE_ID       = "NODE_001";

// Status LED (GPIO 2 is onboard LED on most ESP32 Dev boards)
#define LED_PIN 2

// ================= I2S CONFIGURATION =================
#define I2S_PORT          I2S_NUM_0
#define I2S_SCK_PIN       14   // BCLK
#define I2S_WS_PIN        15   // LRCLK / WS
#define I2S_SD_PIN        32   // DIN / SD

// Audio parameters matching 2-class ML model:
// Models: models/wildlife_audio_classifier_2class.pkl (Elephant, Tiger)
#define SAMPLE_RATE       22050
#define RECORD_SECONDS    3
#define WAV_HEADER_SIZE   44
#define TOTAL_SAMPLES     (SAMPLE_RATE * RECORD_SECONDS)
#define AUDIO_DATA_SIZE   (TOTAL_SAMPLES * sizeof(int16_t))
#define TOTAL_WAV_SIZE    (WAV_HEADER_SIZE + AUDIO_DATA_SIZE)

// Static audio buffer in RAM (~132 KB, safely within ESP32 internal SRAM)
static uint8_t wav_buffer[TOTAL_WAV_SIZE];

// ================= WAV HEADER GENERATOR =================
void create_wav_header(uint8_t *header, uint32_t wavDataSize, uint32_t sampleRate) {
  uint32_t totalFileSize = wavDataSize + 36;
  uint32_t byteRate = sampleRate * 1 * sizeof(int16_t); // sampleRate * channels * bytesPerSample

  // RIFF Chunk Descriptor
  header[0] = 'R'; header[1] = 'I'; header[2] = 'F'; header[3] = 'F';
  header[4] = (uint8_t)(totalFileSize & 0xFF);
  header[5] = (uint8_t)((totalFileSize >> 8) & 0xFF);
  header[6] = (uint8_t)((totalFileSize >> 16) & 0xFF);
  header[7] = (uint8_t)((totalFileSize >> 24) & 0xFF);
  header[8] = 'W'; header[9] = 'A'; header[10] = 'V'; header[11] = 'E';

  // "fmt " Sub-chunk
  header[12] = 'f'; header[13] = 'm'; header[14] = 't'; header[15] = ' ';
  header[16] = 16; header[17] = 0; header[18] = 0; header[19] = 0; // Subchunk1Size = 16 for PCM
  header[20] = 1; header[21] = 0;                                    // AudioFormat = 1 (PCM)
  header[22] = 1; header[23] = 0;                                    // NumChannels = 1 (Mono)
  header[24] = (uint8_t)(sampleRate & 0xFF);
  header[25] = (uint8_t)((sampleRate >> 8) & 0xFF);
  header[26] = (uint8_t)((sampleRate >> 16) & 0xFF);
  header[27] = (uint8_t)((sampleRate >> 24) & 0xFF);
  header[28] = (uint8_t)(byteRate & 0xFF);
  header[29] = (uint8_t)((byteRate >> 8) & 0xFF);
  header[30] = (uint8_t)((byteRate >> 16) & 0xFF);
  header[31] = (uint8_t)((byteRate >> 24) & 0xFF);
  header[32] = 2; header[33] = 0;                                    // BlockAlign = 2 bytes (1 channel * 16-bit)
  header[34] = 16; header[35] = 0;                                   // BitsPerSample = 16 bits

  // "data" Sub-chunk
  header[36] = 'd'; header[37] = 'a'; header[38] = 't'; header[39] = 'a';
  header[40] = (uint8_t)(wavDataSize & 0xFF);
  header[41] = (uint8_t)((wavDataSize >> 8) & 0xFF);
  header[42] = (uint8_t)((wavDataSize >> 16) & 0xFF);
  header[43] = (uint8_t)((wavDataSize >> 24) & 0xFF);
}

// ================= I2S INITIALIZATION =================
bool init_i2s() {
  Serial.println("[I2S] Initializing INMP441 Microphone Driver...");

  // Standard I2S configuration compatible with Arduino ESP32 Core 3.x and 2.x
  i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = i2s_comm_format_t(I2S_COMM_FORMAT_STAND_I2S),
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 8,
    .dma_buf_len = 512,
    .use_apll = false,
    .tx_desc_auto_clear = false,
    .fixed_mclk = 0
  };

  i2s_pin_config_t pin_config = {
    .bck_io_num = I2S_SCK_PIN,
    .ws_io_num = I2S_WS_PIN,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num = I2S_SD_PIN
  };

  esp_err_t err = i2s_driver_install(I2S_PORT, &i2s_config, 0, NULL);
  if (err != ESP_OK) {
    Serial.printf("[I2S ERROR] Failed to install I2S driver: %d\n", err);
    return false;
  }

  err = i2s_set_pin(I2S_PORT, &pin_config);
  if (err != ESP_OK) {
    Serial.printf("[I2S ERROR] Failed to set I2S pins: %d\n", err);
    return false;
  }

  i2s_zero_dma_buffer(I2S_PORT);
  Serial.println("[I2S] INMP441 Driver installed successfully.");
  return true;
}

// ================= WI-FI CONNECTION =================
void connect_wifi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.println();
  Serial.print("[WiFi] Connecting to: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start_time = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start_time < 15000) {
    delay(500);
    Serial.print(".");
    digitalWrite(LED_PIN, !digitalRead(LED_PIN)); // Toggle LED
  }

  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(LED_PIN, HIGH);
    Serial.println();
    Serial.println("[WiFi] Connected successfully!");
    Serial.print("[WiFi] ESP32 IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    digitalWrite(LED_PIN, LOW);
    Serial.println();
    Serial.println("[WiFi ERROR] Connection failed. Will retry next cycle.");
  }
}

// ================= SEND AUDIO VIA HTTP POST =================
bool send_audio_http(const uint8_t *payload, size_t payload_size) {
  if (WiFi.status() != WL_CONNECTED) {
    connect_wifi();
    if (WiFi.status() != WL_CONNECTED) return false;
  }

  HTTPClient http;
  http.setTimeout(8000); // 8 second timeout

  String url = String("http://") + SERVER_HOST + ":" + SERVER_PORT + "/api/esp32/audio?node_id=" + NODE_ID;
  Serial.printf("[HTTP] Transmitting %u bytes to: %s\n", payload_size, url.c_str());

  if (!http.begin(url)) {
    Serial.println("[HTTP ERROR] Unable to connect to server endpoint");
    return false;
  }

  http.addHeader("Content-Type", "audio/wav");
  http.addHeader("X-Node-ID", NODE_ID);

  int httpCode = http.POST((uint8_t*)payload, payload_size);

  if (httpCode > 0) {
    Serial.printf("[HTTP] Response code: %d\n", httpCode);
    if (httpCode == HTTP_CODE_OK) {
      String response = http.getString();
      Serial.printf("[HTTP] Server Result: %s\n", response.c_str());
      http.end();
      return true;
    }
  } else {
    Serial.printf("[HTTP ERROR] POST failed, error: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
  return false;
}

// ================= SETUP =================
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("==================================================");
  Serial.println("         BHOOMI KAVALU - ACOUSTIC NODE 1          ");
  Serial.println("    ESP32 + INMP441 HTTP Audio Streamer v2.0      ");
  Serial.println("==================================================");

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  // Initialize Pre-computed WAV Header in buffer
  create_wav_header(wav_buffer, AUDIO_DATA_SIZE, SAMPLE_RATE);

  // Initialize I2S INMP441 Microphone
  if (!init_i2s()) {
    Serial.println("[FATAL] I2S initialization failed. Halting.");
    while (true) {
      digitalWrite(LED_PIN, HIGH);
      delay(100);
      digitalWrite(LED_PIN, LOW);
      delay(100);
    }
  }

  // Connect to Wi-Fi
  connect_wifi();

  Serial.println("[READY] System initialized. Starting acoustic monitoring...");
}

// ================= MAIN LOOP =================
void loop() {
  // Ensure Wi-Fi is connected
  if (WiFi.status() != WL_CONNECTED) {
    connect_wifi();
  }

  Serial.printf("\n[AUDIO] Sampling %d seconds of live audio (%d Hz)...\n", RECORD_SECONDS, SAMPLE_RATE);
  digitalWrite(LED_PIN, HIGH); // Turn on LED while recording

  // Pointer to audio payload region in wav_buffer (right after 44-byte WAV header)
  uint8_t *audio_dest = wav_buffer + WAV_HEADER_SIZE;
  size_t bytes_to_read = AUDIO_DATA_SIZE;
  size_t total_bytes_read = 0;

  unsigned long record_start = millis();

  // Read I2S in chunks of DMA buffers
  while (total_bytes_read < bytes_to_read) {
    size_t bytes_read = 0;
    size_t chunk_request = (bytes_to_read - total_bytes_read > 2048) ? 2048 : (bytes_to_read - total_bytes_read);

    esp_err_t result = i2s_read(
      I2S_PORT,
      (void*)(audio_dest + total_bytes_read),
      chunk_request,
      &bytes_read,
      portMAX_DELAY
    );

    if (result == ESP_OK && bytes_read > 0) {
      total_bytes_read += bytes_read;
    } else {
      Serial.printf("[I2S ERROR] Read error: %d\n", result);
      break;
    }
  }

  unsigned long record_duration = millis() - record_start;
  digitalWrite(LED_PIN, LOW); // Turn off LED after recording

  Serial.printf("[AUDIO] Recorded %u bytes in %lu ms.\n", total_bytes_read, record_duration);

  // Quick RMS calculation for local sound intensity check
  int16_t *samples = (int16_t*)(wav_buffer + WAV_HEADER_SIZE);
  size_t num_samples = total_bytes_read / sizeof(int16_t);
  int64_t sum_sq = 0;
  int16_t max_amp = 0;

  for (size_t i = 0; i < num_samples; i++) {
    int16_t val = samples[i];
    sum_sq += (int64_t)val * val;
    if (abs(val) > max_amp) max_amp = abs(val);
  }

  float rms = (num_samples > 0) ? sqrt((double)sum_sq / num_samples) : 0;
  Serial.printf("[AUDIO STATS] Peak: %d | RMS: %.2f\n", max_amp, rms);

  // Send WAV chunk to Bhoomi Kavalu Backend via HTTP POST
  bool sent = send_audio_http(wav_buffer, TOTAL_WAV_SIZE);
  if (sent) {
    Serial.println("[STATUS] Audio transmitted and analyzed successfully.");
    // Blink LED once to indicate success
    digitalWrite(LED_PIN, HIGH);
    delay(100);
    digitalWrite(LED_PIN, LOW);
  } else {
    Serial.println("[STATUS] Failed to deliver audio to backend.");
  }

  // Brief pause before next sampling window (0.5s)
  delay(500);
}
