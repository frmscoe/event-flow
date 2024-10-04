// SPDX-License-Identifier: Apache-2.0
process.env.MAX_CPU = '1';
process.env.STARTUP_TYPE = 'nats';
process.env.RULE_NAME = 'EFRuP';
process.env.RULE_VERSION = '1.0.0';
process.env.INTERDICTION_PRODUCER = 'interdiction-service';
process.env.FUNCTION_NAME = 'interdiction-service';
process.env.PRODUCER_STREAM = 'interdiction-service';
process.env.CONSUMER_STREAM = 'interdiction-service';
process.env.STREAM_SUBJECT = 'interdiction-service';
process.env.APM_URL = 'http://url.example.com';
process.env.APM_ACTIVE = 'false';
process.env.APM_SERVICE_NAME = 'event-flow';
process.env.SERVER_URL = 'http://url.example.com';
