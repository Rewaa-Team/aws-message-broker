import { SQS } from 'aws-sdk';
import { ClientConfiguration } from 'aws-sdk/clients/acm';
import { v4 as uuidv4 } from 'uuid';

import { IResponseMessage, IResponseMessages, QueueRequestMessage } from '../types/interfaces';

export class AwsFIFO {
  private readonly fifo;
  private readonly queueURL =
    'https://sqs.us-east-2.amazonaws.com/063696436519';

  constructor(config: ClientConfiguration = {}) {
    const conf = {
      apiVersion: '2012-11-05',
      region: 'us-east-2',
      ...config,
    };
    this.fifo = new SQS(conf);
  }

  private getQueueUrl(queueName: string): string {
    return `${this.queueURL}/${queueName}`;
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
    const params: SQS.SendMessageRequest = {
      ...this.formatMessage(messageDetail),
      QueueUrl: this.getQueueUrl(queueName),
    };

    try {
      const messageResponse = await this.fifo.sendMessage(params).promise();
      return { EntryId: messageResponse.MessageId };
    } catch (err) {
      console.log(err);
      throw err;
    }
  }

  sendMessages(
    queueName: string,
    messageDetails: readonly QueueRequestMessage[]
  ): Promise<IResponseMessages> {
    const batchMessages: SQS.SendMessageBatchRequest = {
      QueueUrl: this.getQueueUrl(queueName),
      Entries: [],
    };
    batchMessages.Entries = messageDetails.map((detail) =>
      this.formatMessage(detail)
    );

    return this.fifo
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
    limit: number = 1,
    visibilityTimeoutInSec: number = 60
  ): Promise<SQS.ReceiveMessageResult> {

    const params = {
      QueueUrl: this.getQueueUrl(queueName),
      MaxNumberOfMessages: limit,
      VisibilityTimeout: visibilityTimeoutInSec,
    };

    try {
      const messageResponse = await this.fifo.receiveMessage(params).promise();
      return messageResponse;
    } catch (err) {
      console.log(err);
      throw err;
    }
  }
}
