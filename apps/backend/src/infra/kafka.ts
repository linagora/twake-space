import { KafkaJS } from '@confluentinc/kafka-javascript'
import type { Logger } from 'pino'
import type { Config } from '../config.ts'
import { ACTIVITY_TOPICS, PLATFORM_TOPIC } from '../events/envelope.ts'
import {
  deadLetterTopic,
  type DeadLetter,
  type IncomingMessage,
  type Outcome
} from '../events/router.ts'

type GlobalConfig = KafkaJS.ProducerConstructorConfig &
  KafkaJS.ConsumerConstructorConfig

export function connectionConfig(config: Config): GlobalConfig {
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

export function kafkaLogger(logger: Logger): KafkaJS.Logger {
  const child = logger.child({ component: 'kafka' })
  const adapter: KafkaJS.Logger = {
    info: (message, extra) => {
      child.info(extra ?? {}, message)
    },
    warn: (message, extra) => {
      child.warn(extra ?? {}, message)
    },
    error: (message, extra) => {
      // eachMessageWithBackoff logs each failed attempt already.
      if (message.startsWith('Consumer encountered error while processing')) {
        child.debug(extra ?? {}, message)
        return
      }
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

type Handle = (topic: string, message: IncomingMessage) => Promise<Outcome>

const FIRST_RETRY_MS = 1000
const MAX_RETRY_MS = 60_000

// Throwing makes the consumer deliver the message again, at once unless its
// partition is paused. Other partitions keep flowing meanwhile.
export function eachMessageWithBackoff(
  consumer: Pick<KafkaJS.Consumer, 'pause' | 'resume' | 'commitOffsets'>,
  handle: Handle,
  logger: Logger
) {
  const failures = new Map<string, number>()
  return async ({
    topic,
    partition,
    message
  }: {
    topic: string
    partition: number
    message: IncomingMessage
  }) => {
    const key = `${topic}|${String(partition)}`
    try {
      await handle(topic, message)
    } catch (error) {
      const failed = (failures.get(key) ?? 0) + 1
      failures.set(key, failed)
      const delayMs = Math.min(MAX_RETRY_MS, FIRST_RETRY_MS * 2 ** (failed - 1))
      logger.warn(
        {
          err: error,
          topic,
          partition,
          offset: message.offset,
          failed,
          delayMs
        },
        'event failed, retrying'
      )
      consumer.pause([{ topic, partitions: [partition] }])
      setTimeout(() => {
        try {
          consumer.resume([{ topic, partitions: [partition] }])
        } catch {
          // Disconnected while waiting: nothing left to resume.
        }
      }, delayMs).unref()
      throw error
    }
    failures.delete(key)
    await consumer.commitOffsets([
      { topic, partition, offset: (BigInt(message.offset) + 1n).toString() }
    ])
  }
}

export async function startConsumer(
  config: Config,
  logger: Logger,
  handle: Handle
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
    eachMessage: eachMessageWithBackoff(consumer, handle, logger)
  })
  return consumer
}

// Topics aren't created on first send: a missing one would fail every rejection.
export async function checkDeadLetterTopics(admin: {
  listTopics(): Promise<string[]>
}): Promise<void> {
  const existing = new Set(await admin.listTopics())
  const missing = [...ACTIVITY_TOPICS, PLATFORM_TOPIC]
    .map(deadLetterTopic)
    .filter(topic => !existing.has(topic))
  if (missing.length > 0) {
    throw new Error(`missing dead letter topics: ${missing.join(', ')}`)
  }
}

export interface DeadLetterProducer {
  send: DeadLetter
  disconnect(): Promise<void>
}

export async function startDeadLetterProducer(
  config: Config,
  logger: Logger
): Promise<DeadLetterProducer> {
  const producer = new KafkaJS.Kafka().producer({
    ...connectionConfig(config),
    'enable.idempotence': true,
    acks: -1,
    kafkaJS: { logger: kafkaLogger(logger) }
  })
  await producer.connect()
  const admin = producer.dependentAdmin()
  await admin.connect()
  try {
    await checkDeadLetterTopics(admin)
  } finally {
    await admin.disconnect()
  }
  return {
    async send(topic, message, reason) {
      await producer.send({
        topic,
        messages: [
          {
            key: message.key ?? null,
            value: message.value,
            headers: {
              ...(message.headers as KafkaJS.IHeaders | undefined),
              'twake-space-reason': reason
            }
          }
        ]
      })
    },
    disconnect: () => producer.disconnect()
  }
}
