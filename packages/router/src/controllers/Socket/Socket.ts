import { Application } from 'express';
import { createServer, Server as httpServer } from 'http';
import { Server as IOServer, ServerOptions, Socket } from 'socket.io';
import {
  ConduitRouteReturnDefinition,
  ConduitSocket,
  EventResponse,
  JoinRoomResponse,
} from '@quintessential-sft/conduit-sdk';
import { isNil, isArray } from 'lodash';


export class SocketController {
  private readonly httpServer: httpServer;
  private io: IOServer;
  private readonly options: Partial<ServerOptions>;
  private _registeredNamespaces: Map<string, ConduitSocket>;

  constructor(private readonly app: Application) {
    this.httpServer = createServer(app);
    this.options = {};
    this.io = new IOServer(this.httpServer, this.options);
    this.httpServer.listen(process.env.SOCKET_PORT || 3001);
    this._registeredNamespaces = new Map();
  }

  registerConduitSocket(conduitSocket: ConduitSocket) {
    const namespace = conduitSocket.input.path;
    if (this._registeredNamespaces.has(namespace)) {
      return;
    }

    this._registeredNamespaces.set(namespace, conduitSocket);
    this.io.of(namespace).on('connect', socket => {
      conduitSocket.executeRequest({
        event: 'connect',
        socketId: socket.id
      })
      .then((res) => {
        this.handleResponse(res, socket);
      })
      .catch(() => {});

      socket.onAny((event, ...args) => {
        conduitSocket.executeRequest({
          event,
          socketId: socket.id,
          params: args
        })
        .then((res) => {
          this.handleResponse(res, socket);
        })
        .catch((e) => {
          console.error(e);
        });
      });

    });
  }

  private handleResponse(res: EventResponse[] | JoinRoomResponse, socket: Socket) {
    if (isArray(res)) {
      res.forEach((r) => {
        if (isNil(r.receivers)) {
          socket.emit(r.event, ...r.data);
        } else {
          socket.to(r.receivers).emit(r.event, ...r.data);
        }
      });
    } else {
      socket.join(res.rooms);
    }
  }
}
