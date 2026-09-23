import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private connectedClients = 0;

  afterInit() {
    console.log('🔌 WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.connectedClients++;
    console.log(`🟢 Client connected: ${client.id} (${this.connectedClients} total)`);
  }

  handleDisconnect(client: Socket) {
    this.connectedClients--;
    console.log(`🔴 Client disconnected: ${client.id} (${this.connectedClients} total)`);
  }

  /**
   * Emit a new message event to all connected clients
   */
  emitNewMessage(conversationId: string, message: any) {
    this.server.emit('new_message', {
      conversationId,
      message,
    });
  }

  /**
   * Emit a conversation update event (new message preview, unread count, etc.)
   */
  emitConversationUpdated(conversation: any) {
    this.server.emit('conversation_updated', conversation);
  }

  /**
   * Emit a message status update event (sent -> delivered -> read)
   */
  emitMessageStatus(messageId: string, status: string) {
    this.server.emit('message_status', {
      messageId,
      status,
    });
  }

  /**
   * Emit a conversation deleted event
   */
  emitConversationDeleted(conversationId: string) {
    this.server.emit('conversation_deleted', {
      conversationId,
    });
  }
}
