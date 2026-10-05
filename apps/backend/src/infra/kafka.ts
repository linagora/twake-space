import { KafkaJS } from '@confluentinc/kafka-javascript'
import type { Logger } from 'pino'
import type { Config } from '../config.ts'
import { ACTIVITY_TOPICS, PLATFORM_TOPIC } from '../events/envelope.ts'
import type { IncomingMessage, Outcome } from '../events/router.ts'

export function connectionConfig(
  config: Config
): KafkaJS.ConsumerConstructorConfig {
  const common = {
    'bootstrap.servers': config.KAFKA_BOOTSTRAP,
    'client.id': 'twake-space'
  }
  switch (config.KAFKA_SECURITY) {
    case 'plaintext':
      return { ...common, 'security.protocol': 'plaintext' }
    case 'ssl':
      return {
        ...common,
        'security.protocol': 'ssl',
        'ssl.ca.location': config.KAFKA_SSL_CA,
        'ssl.certificate.location': config.KAFKA_SSL_CERT,
        'ssl.key.location': config.KAFKA_SSL_KEY
      }
    case 'sasl_ssl':
      return {
        ...common,
        'security.protocol': 'sasl_ssl',
        'sasl.mechanisms': 'SCRAM-SHA-512',
        'sasl.username': config.KAFKA_SASL_USERNAME,
        'sasl.password': config.KAFKA_SASL_PASSWORD,
        ...(config.KAFKA_SSL_CA && { 'ssl.ca.location': config.KAFKA_SSL_CA })
      }
  }
}

function kafkaLogger(logger: Logger): KafkaJS.Logger {
  const child = logger.child({ component: 'kafka' })
  const adapter: KafkaJS.Logger = {
    info: (message, extra) => {
      child.info(extra ?? {}, message)
    },
    warn: (message, extra) => {
      child.warn(extra ?? {}, message)
    },
    error: (message, extra) => {
      child.error(extra ?? {}, message)
    },
    debug: (message, extra) => {
      child.debug(extra ?? {}, message)
    },
    namespace: () => adapter,
    setLogLevel: () => undefined
  }
  return adapter
}

export async function startConsumer(
  config: Config,
  logger: Logger,
  handle: (topic: string, message: IncomingMessage) => Promise<Outcome>
): Promise<KafkaJS.Consumer> {
  const consumer = new KafkaJS.Kafka().consumer({
    ...connectionConfig(config),
    kafkaJS: {
      groupId: config.KAFKA_GROUP_ID,
      autoCommit: false,
      fromBeginning: true,
      logger: kafkaLogger(logger)
    }
  })
  await consumer.connect()
  await consumer.subscribe({ topics: [...ACTIVITY_TOPICS, PLATFORM_TOPIC] })
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      await handle(topic, message)
      await consumer.commitOffsets([
        { topic, partition, offset: (BigInt(message.offset) + 1n).toString() }
      ])
    }
  })
  return consumer
}
