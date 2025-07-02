const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

// Example usage of the Comfy MQTT API
async function testAPI() {
  try {
    console.log('🚀 Testing Comfy MQTT API...\n');

    // 1. Configure a new topic
    console.log('1. Configuring a new topic...');
    const topicConfig = {
      name: 'sensor/temperature',
      schema: {
        temperature: 'number',
        humidity: 'number',
        timestamp: 'string'
      }
    };

    const createResponse = await axios.post(`${BASE_URL}/topics`, topicConfig);
    console.log('✅ Topic configured:', createResponse.data.message);

    // 2. Get all topics
    console.log('\n2. Getting all configured topics...');
    const topicsResponse = await axios.get(`${BASE_URL}/topics`);
    console.log('✅ Topics found:', topicsResponse.data.count);

    // 3. Publish a message
    console.log('\n3. Publishing a message...');
    const message = {
      payload: {
        temperature: 25.5,
        humidity: 60.2,
        timestamp: new Date().toISOString()
      }
    };

    const publishResponse = await axios.post(`${BASE_URL}/topics/sensor/temperature/publish`, message);
    console.log('✅ Message published:', publishResponse.data.message);

    // 4. Get messages for the topic
    console.log('\n4. Getting messages for the topic...');
    const messagesResponse = await axios.get(`${BASE_URL}/topics/sensor/temperature/messages`);
    console.log('✅ Messages retrieved:', messagesResponse.data.count);
    console.log('📊 Latest message:', messagesResponse.data.data[0]);

    // 5. Get topic information
    console.log('\n5. Getting topic information...');
    const topicInfoResponse = await axios.get(`${BASE_URL}/topics/sensor/temperature`);
    console.log('✅ Topic info:', topicInfoResponse.data.data);

    // 6. Health check
    console.log('\n6. Checking service health...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health status:', healthResponse.data.status);

    console.log('\n🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testAPI();
}

module.exports = { testAPI }; 