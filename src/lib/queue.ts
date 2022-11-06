import { SQS } from 'aws-sdk';
import { ClientConfiguration } from 'aws-sdk/clients/acm';
import { v4 as uuidv4 } from 'uuid';

import {
  IResponseMessage,
  IResponseMessages,
  QueueRequestMessage,
} from '../types/interfaces';

export class AwsFIFO {
  private readonly queue;

  constructor(config: ClientConfiguration = {}) {
    const conf = {
      apiVersion: '2012-11-05',
      region: 'us-east-2',
      ...config,
    };
    this.queue = new SQS(conf);
  }

  private getQueueUrl(QueueName: string): Promise<SQS.GetQueueUrlResult> {
    return this.queue.getQueueUrl({ QueueName }).promise();
  }

  private formatMessage(messageDetail: QueueRequestMessage) {
    return {
      Id: uuidv4(),
      MessageBody: JSON.stringify(messageDetail.MessageBody),
      MessageDeduplicationId: messageDetail.DeduplicationId ?? uuidv4(),
      MessageGroupId: messageDetail.MessageGroupId,
    };
  }

  async sendMessage(
    queueName: string,
    messageDetail: QueueRequestMessage
  ): Promise<IResponseMessage> {
    const { QueueUrl } = await this.getQueueUrl(queueName);

    if (!QueueUrl) throw new Error('No queue found');

    const params: SQS.SendMessageRequest = {
      MessageBody: JSON.stringify(messageDetail.MessageBody),
      MessageDeduplicationId: messageDetail.DeduplicationId ?? uuidv4(),
      MessageGroupId: messageDetail.MessageGroupId,
      QueueUrl,
    };

    try {
      const messageResponse = await this.queue.sendMessage(params).promise();
      return { EntryId: messageResponse.MessageId };
    } catch (err) {
      console.log(err);
      throw err;
    }
  }

  async sendMessages(
    queueName: string,
    messageDetails: readonly QueueRequestMessage[]
  ): Promise<IResponseMessages> {
    const { QueueUrl } = await this.getQueueUrl(queueName);

    if (!QueueUrl) throw new Error('No queue found');

    const batchMessages: SQS.SendMessageBatchRequest = {
      QueueUrl,
      Entries: [],
    };
    batchMessages.Entries = messageDetails.map((detail) =>
      this.formatMessage(detail)
    );

    return this.queue
      .sendMessageBatch(batchMessages)
      .promise()
      .then((res) => {
        const response: IResponseMessages = {
          FailedEntryCount: 0,
          Messages: [],
        };
        response.FailedEntryCount = res.Failed?.length;
        response.Messages = res.Successful?.map((ent) => ({
          EntryId: ent.MessageId,
        }));
        response.FailedEvents = res.Failed?.map((ent) => ({
          EntryId: ent.Message,
        }));
        return response;
      });
  }

  async receiveMessages(
    queueName: string,
    limit = 1,
    visibilityTimeoutInSec = 60
  ): Promise<SQS.ReceiveMessageResult> {
    const { QueueUrl } = await this.getQueueUrl(queueName);

    if (!QueueUrl) throw new Error('No queue found');

    const params: SQS.ReceiveMessageRequest = {
      QueueUrl,
      AttributeNames: ['MessageGroupId'],
      MaxNumberOfMessages: limit,
      VisibilityTimeout: visibilityTimeoutInSec,
    };

    try {
      const messageResponse = await this.queue.receiveMessage(params).promise();
      return messageResponse;
    } catch (err) {
      console.log(err);
      throw err;
    }
  }

  async removeMessage(queueName: string, ReceiptHandle: string) {
    try {
      const { QueueUrl } = await this.getQueueUrl(queueName);

      if (!QueueUrl) throw new Error('No queue found');

      const deleteMsg = await this.queue
        .deleteMessage({
          QueueUrl,
          ReceiptHandle,
        })
        .promise();
      console.log(deleteMsg);
    } catch (err) {
      console.log(err);
      throw err;
    }
  }
}
