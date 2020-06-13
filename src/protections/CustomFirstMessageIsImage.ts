/*
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { IProtection } from "./IProtection";
import { Mjolnir } from "../Mjolnir";
import { LogLevel, LogService, Permalinks, UserID } from "matrix-bot-sdk";
import { logMessage } from "../LogProxy";
import config from "../config";
import { isTrueJoinEvent, linkify } from "../utils";

export class CustomFirstMessageIsImage implements IProtection {

    private justJoined: { [roomId: string]: string[] } = {};
    // private recentlyKicked: string[] = [];

    constructor() {
    }

    public get name(): string {
        return 'CustomFirstMessageIsImageProtection';
    }

    public async handleEvent(mjolnir: Mjolnir, roomId: string, event: any): Promise<any> {
        if (!this.justJoined[roomId]) this.justJoined[roomId] = [];

        if (event['type'] === 'm.room.member') {
            if (isTrueJoinEvent(event)) {
                this.justJoined[roomId].push(event['state_key']);
                LogService.info('CustomFirstMessageIsImage', `Tracking ${event['state_key']} in ${roomId} as just joined`);
            }

            return; // stop processing (membership event spam is another problem)
        }

        if (event['type'] === 'm.room.message') {
            const content = event['content'] || {};
            const msgtype = content['msgtype'] || 'm.text';
            const formattedBody = content['formatted_body'] || '';
            const isMedia = msgtype === 'm.image' || msgtype === 'm.video' || formattedBody.toLowerCase().includes('<img');
            if (isMedia && this.justJoined[roomId].includes(event['sender'])) {
                await logMessage(LogLevel.WARN, 'CustomFirstMessageIsImage', `Kicking ${event['sender']} for posting an image/video as the first thing after joining in ${roomId} (see below)`, roomId);

                if (!config.noop) {
                    await mjolnir.client.kickUser(event['sender'], roomId, "[automated] first message is image/video protection");
                } else {
                    await logMessage(LogLevel.WARN, 'CustomFirstMessageIsImage', `Tried to kick ${event['sender']} in ${roomId} but Mjolnir is running in no-op mode`, roomId);
                }

                const viaServers = [(new UserID(await mjolnir.client.getUserId())).domain];
                const eventPermalink = Permalinks.forEvent(roomId, event['event_id'], viaServers)

                // https://<homeserverUrl>/_matrix/media/r0/download/<domain>/<mediaId>
                // mxc://<domain>/<mediaId>
                // `<a href="${link}">${name}</a>`
                const file = content['file'] || {}
                const fileMimetype: string = file['mimetype'] || 'NOT_FOUND'
                const mxcUrl: string = file['url'] || 'NOT_FOUND'
                if (mxcUrl !== 'NOT_FOUND') {
                    const MXC = 'mxc://'
                    const mxcParts = mxcUrl.toLowerCase().startsWith(MXC) ? mxcUrl.substr(MXC.length).split('/') : []
                    const domain = encodeURIComponent(mxcParts[0]);
                    const mediaId = mxcParts.length ? encodeURIComponent(mxcParts[1].split('/')[0]) : 'NOT_FOUND'

                    const downloadUrl = `https://${mjolnir.client.homeserverUrl}/_matrix/media/r0/download/${domain}/${mediaId}`
                    await logMessage(LogLevel.WARN, 'CustomFirstMessageIsImage', `Event: ${eventPermalink} | File: ${mjolnir.client.mxcToHttp(mxcUrl)} | Mimetype: ${fileMimetype}`)
                } else {
                    await logMessage(LogLevel.WARN, 'CustomFirstMessageIsImage', `Event: ${linkify(eventPermalink, event['event_id'])} | File: ${mxcUrl} | Mimetype: ${fileMimetype}`)
                }

                //if (this.recentlyKicked.includes(event['sender'])) return; // already handled (will be redacted)
                //mjolnir.redactionHandler.addUser(event['sender']);
                //this.recentlyKicked.push(event['sender']); // flag to reduce spam

                // Redact the event
                if (!config.noop) {
                    await mjolnir.client.redactEvent(roomId, event['event_id'], '[automated] first message is image/media protection');
                } else {
                    await logMessage(LogLevel.WARN, 'CustomFirstMessageIsImage', `Tried to redact ${event['event_id']} in ${roomId} but Mjolnir is running in no-op mode`, roomId);
                }
            }
        }

        const idx = this.justJoined[roomId].indexOf(event['sender']);
        if (idx >= 0) {
            LogService.info('CustomFirstMessageIsImage', `${event['sender']} is no longer considered suspect`);
            this.justJoined[roomId].splice(idx, 1);
        }
    }
}
