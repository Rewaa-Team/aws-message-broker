export interface IMessageBroker {
  sendMessage(messageDetail: IRequestMessage): Promise<IResponseMessage>;
  sendMessages(messageDetails: IRequestMessages): Promise<IResponseMessages>;
}

export interface IRequestMessage {
  Detail: any;
  DetailType: string;
  Source?: string;
  EventBusName?: string;
}

export interface IRequestMessages {
  Messages: Array<IRequestMessage>;
}

export interface IResponseMessage {
  EntryId?: string;
}

export interface IResponseMessages {
  FailedEntryCount?: number;
  Messages?: Array<IResponseMessage>;
  FailedEvents?: Array<IResponseMessage>;
}

export interface QueueRequestMessage {
  MessageBody: any;
  DeduplicationId: string;
  MessageGroupId?: string;
}
