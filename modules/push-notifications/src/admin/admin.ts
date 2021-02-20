import {isEmpty, isNil} from 'lodash';
import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import * as grpc from 'grpc';
import {IPushNotificationsProvider} from '../interfaces/IPushNotificationsProvider';

let paths = require("./admin.json").functions
export class AdminHandler {

    private provider: IPushNotificationsProvider;
    private databaseAdapter: any;
    private readonly conduit: ConduitGrpcSdk;

    constructor(server: grpc.Server, conduit: ConduitGrpcSdk, provider: IPushNotificationsProvider) {
        this.conduit = conduit;
        this.provider = provider;
        const self = this;
        conduit.waitForExistence('database-provider').then(() => {
            self.databaseAdapter = conduit.databaseProvider;
        });

        this.conduit.admin.registerAdmin(server, paths.functions, {
            sendNotification: this.sendNotification.bind(this),
            sendManyNotifications: this.sendManyNotifications.bind(this),
            sendToManyDevices: this.sendToManyDevices.bind(this),
            getNotificationTokens: this.getNotificationTokens.bind(this)
        }).catch((err: Error) => {
            console.log("Failed to register admin routes for module!")
            console.error(err);
        });
    }

    updateProvider(provider: IPushNotificationsProvider) {
        this.provider = provider;
    }

    async sendNotification(call: any, callback: any) {
        const {title, body, data, userId} = JSON.parse(call.request.params);
        if (isNil(title) || isNil(userId)) return callback({
            code: grpc.status.INVALID_ARGUMENT,
            message: 'Required fields are missing',
        });
        const params = {
            title,
            body,
            data,
            sendTo: userId
        };
        if (isNil(params)) return callback({
            code: grpc.status.INVALID_ARGUMENT,
            message: 'Required fields are missing',
        });

        let errorMessage = null;
        await this.provider.sendToDevice(params, this.databaseAdapter).catch(e => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        return callback(null, JSON.stringify({message: 'Ok'}));
    }

    async sendManyNotifications(call: any, callback: any) {
        let requestParams = JSON.parse(call.request.params);
        const params = requestParams.map((param: any) => {

            if (isNil(param.title) || isNil(param.userId)) return callback({
                code: grpc.status.INVALID_ARGUMENT,
                message: 'Required fields are missing',
            });

            return {
                sendTo: param.userId,
                title: param.title,
                body: param.body,
                data: param.data
            }
        });
        if (isNil(params)) return callback({
            code: grpc.status.INVALID_ARGUMENT,
            message: 'Required fields are missing',
        });

        let errorMessage = null;
        await this.provider.sendMany(params, this.databaseAdapter).catch(e => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        return callback(null, JSON.stringify({message: 'Ok'}));
    }

    async sendToManyDevices(call: any, callback: any) {
        const {userIds, title, body, data} = JSON.parse(call.request.params);

        if (isNil(title) || isNil(userIds) || isEmpty(userIds)) return callback({
            code: grpc.status.INVALID_ARGUMENT,
            message: 'Required fields are missing',
        });

        const params = {
            sendTo: userIds,
            title,
            body,
            data
        };
        if (isNil(params)) return callback({
            code: grpc.status.INVALID_ARGUMENT,
            message: 'Required fields are missing',
        });

        let errorMessage = null;
        await this.provider.sendToManyDevices(params, this.databaseAdapter).catch(e => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        return callback(null, JSON.stringify({message: 'Ok'}));
    }

    async getNotificationTokens(call: any, callback: any) {
        const {userId} = JSON.parse(call.request.params);
        if (isNil(userId)) {
            return callback({
                code: grpc.status.INVALID_ARGUMENT,
                message: 'User id parameter was not provided'
            });
        }

        let errorMessage = null;
        const tokenDocuments = await this.databaseAdapter.findMany('NotificationToken', {userId}).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        return callback(null, {result: JSON.stringify({tokenDocuments})});
    }
}

